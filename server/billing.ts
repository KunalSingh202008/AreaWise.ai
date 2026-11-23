import { createHash, randomUUID } from 'node:crypto';
import { Router, raw } from 'express';
import { pool } from '../src/db';
import { resolveAccount, spendDailyQuota } from './accounts';
import { requireSignedIn, session } from './auth';
import { findPlace, getPublicLocality } from './geography';
import { HttpError, route, validText } from './http';
import { isValidRazorpaySignature, razorpaySandbox, sandboxCredentials } from './razorpay';
import { renderEvidenceCsv } from './reports';

type Tier = 'plus' | 'premium' | 'professional';
interface Plan {
  code: string;
  title: string;
  kind: 'report' | 'subscription';
  amountPaise: number;
  providerPlanId?: string;
  cycles?: number;
  tier?: Tier;
}
interface Checkout {
  id: string;
  kind: Plan['kind'];
  title: string;
  amount_paise: number;
  provider_id: string | null;
  provider_plan_id: string | null;
  state: string;
  place_id: string | null;
  state_event_at: string;
  period_end: Date | null;
}

function configuredPlans(): Plan[] {
  if (!sandboxCredentials()) return [];
  const raw = process.env.RAZORPAY_SANDBOX_PLANS;
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || value.length > 12) throw new Error();
    const seen = new Set<string>();
    for (const plan of value) {
      if (!plan || typeof plan.code !== 'string' || !/^[a-z0-9-]{1,40}$/.test(plan.code) || seen.has(plan.code) ||
          !validText(plan.title, 1, 100) || !Number.isInteger(plan.amountPaise) || plan.amountPaise < 100 || plan.amountPaise > 5000000 ||
          !['report', 'subscription'].includes(plan.kind)) throw new Error();
      if (plan.kind === 'subscription' && (!/^plan_[a-zA-Z0-9]+$/.test(plan.providerPlanId) ||
          !Number.isInteger(plan.cycles) || plan.cycles < 1 || plan.cycles > 120 ||
          !['plus', 'premium', 'professional'].includes(plan.tier))) throw new Error();
      seen.add(plan.code);
    }
    return value;
  } catch {
    throw new HttpError(503, 'The test-mode price list is unavailable.');
  }
}

export async function getSandboxTier(userId: number): Promise<Tier | null> {
  if (!sandboxCredentials()) return null;
  const { rows: [row] } = await pool.query<{ tier: Tier }>(`
    SELECT c.tier FROM billing_checkouts c
    WHERE c.user_id = $1 AND c.kind = 'subscription' AND c.period_end > now()
      AND c.state IN ('active','pending','cancel_requested','completed')
      AND EXISTS (
        SELECT 1 FROM billing_charges p WHERE p.checkout_id = c.id AND p.amount_paise > (
          SELECT COALESCE(sum(f.amount_paise),0) FROM billing_refunds f WHERE f.provider_payment_id = p.provider_payment_id
        ) AND p.charged_at = (SELECT max(p2.charged_at) FROM billing_charges p2 WHERE p2.checkout_id = c.id)
      )
    ORDER BY CASE c.tier WHEN 'professional' THEN 3 WHEN 'premium' THEN 2 ELSE 1 END DESC LIMIT 1
  `, [userId]);
  return row?.tier ?? null;
}

function checkoutResponse(row: Checkout, key: string) {
  if (!row.provider_id || row.state !== 'checkout') {
    throw new HttpError(409, 'This checkout cannot be opened. Check your test billing history.');
  }
  return {
    id: row.id, key, kind: row.kind, title: row.title, amountPaise: row.amount_paise,
    providerId: row.provider_id, currency: 'INR', mode: 'test',
  };
}

export const billingRoutes = Router();
billingRoutes.get('/plans', route(async (_req, res) => {
  const plans = configuredPlans().map(({ code, title, kind, amountPaise, tier }) => ({ code, title, kind, amountPaise, tier }));
  res.json({ mode: 'test', enabled: plans.length > 0, plans });
}));
billingRoutes.use(requireSignedIn);

billingRoutes.post('/checkouts', route(async (req, res) => {
  const key = req.get('Idempotency-Key');
  const { code, placeId } = req.body ?? {};
  if (!key || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(key)) {
    throw new HttpError(400, 'A checkout request identifier is required.');
  }
  const plan = configuredPlans().find((item) => item.code === code);
  const credentials = sandboxCredentials();
  if (!plan || !credentials) throw new HttpError(503, 'This Razorpay Test Mode checkout is unavailable.');
  const place = plan.kind === 'report' && validText(placeId, 1, 48) ? await findPlace(placeId) : null;
  if (plan.kind === 'report' && !place) throw new HttpError(400, 'Select an available place for the report.');
  const { id: userId } = await resolveAccount(session(res));
  const requestId = randomUUID();
  const inserted = await pool.query(`
    INSERT INTO billing_checkouts (id, user_id, request_key, kind, sku, title, amount_paise, tier, provider_plan_id, place_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    ON CONFLICT (user_id, request_key) DO NOTHING RETURNING id
  `, [requestId, userId, key, plan.kind, plan.code, plan.title, plan.amountPaise,
    plan.kind === 'subscription' ? plan.tier : null, plan.kind === 'subscription' ? plan.providerPlanId : null, place?.id ?? null]);
  if (!inserted.rowCount) {
    const { rows: [existing] } = await pool.query<Checkout & { sku: string }>(
      'SELECT * FROM billing_checkouts WHERE user_id = $1 AND request_key = $2', [userId, key]);
    if (existing.sku !== plan.code || existing.place_id !== (place?.id ?? null)) throw new HttpError(409, 'The checkout request was already used.');
    return res.json(checkoutResponse(existing, credentials.key));
  }

  try {
    await spendDailyQuota(userId, 'checkout', 10);
    const provider = razorpaySandbox();
    const providerId = plan.kind === 'report'
      ? await provider.createOrder(plan.amountPaise, 'aw_' + requestId.replaceAll('-', ''))
      : await provider.createSubscription(plan.providerPlanId!, plan.amountPaise, plan.cycles!, requestId);
    const { rows: [checkout] } = await pool.query<Checkout>(`
      UPDATE billing_checkouts SET provider_id = $2, state = 'checkout' WHERE id = $1 RETURNING *
    `, [requestId, providerId]);
    return res.status(201).json(checkoutResponse(checkout, credentials.key));
  } catch (error) {
    await pool.query("UPDATE billing_checkouts SET state = 'needs_review' WHERE id = $1 AND state = 'preparing'", [requestId]);
    throw error;
  }
}));

billingRoutes.get('/history', route(async (_req, res) => {
  const { id } = await resolveAccount(session(res));
  const [checkouts, charges, refunds, tier] = await Promise.all([
    pool.query(`SELECT id, kind, title, amount_paise AS "amountPaise", place_id AS "placeId",
      state, period_end AS "periodEnd", created_at AS "createdAt"
      FROM billing_checkouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]),
    pool.query(`SELECT p.checkout_id AS "checkoutId", p.provider_payment_id AS "paymentId",
      p.amount_paise AS "amountPaise", p.provider_invoice_id AS "invoiceId", p.charged_at AS "chargedAt"
      FROM billing_charges p JOIN billing_checkouts c ON c.id = p.checkout_id
      WHERE c.user_id = $1 ORDER BY p.charged_at DESC LIMIT 100`, [id]),
    pool.query(`SELECT f.provider_refund_id AS "refundId", f.provider_payment_id AS "paymentId",
      f.amount_paise AS "amountPaise", f.refunded_at AS "refundedAt"
      FROM billing_refunds f JOIN billing_charges p USING (provider_payment_id)
      JOIN billing_checkouts c ON c.id = p.checkout_id
      WHERE c.user_id = $1 ORDER BY f.refunded_at DESC LIMIT 100`, [id]),
    getSandboxTier(id),
  ]);
  res.json({ checkouts: checkouts.rows, charges: charges.rows, refunds: refunds.rows, tier, mode: 'test' });
}));

billingRoutes.post('/checkouts/:id/cancel', route(async (req, res) => {
  const { id } = await resolveAccount(session(res));
  const { rows: [item] } = await pool.query<Checkout>(`
    SELECT * FROM billing_checkouts WHERE id::text = $1 AND user_id = $2 AND kind = 'subscription'
  `, [req.params.id, id]);
  if (!item?.provider_id) throw new HttpError(404, 'Subscription unavailable.');
  if (item.state === 'cancel_requested' || item.state === 'cancelled') return res.json({ state: item.state });
  if (!['active', 'pending'].includes(item.state)) throw new HttpError(409, 'This subscription cannot be cancelled yet.');
  await razorpaySandbox().cancelSubscription(item.provider_id);
  await pool.query("UPDATE billing_checkouts SET state = 'cancel_requested' WHERE id = $1 AND state IN ('active','pending')", [item.id]);
  return res.json({ state: 'cancel_requested' });
}));

billingRoutes.get('/checkouts/:id/report.csv', route(async (req, res) => {
  const { id } = await resolveAccount(session(res));
  const { rows: [item] } = await pool.query<{ place_id: string }>(`
    SELECT c.place_id FROM billing_checkouts c JOIN billing_charges p ON p.checkout_id = c.id
    WHERE c.id::text = $1 AND c.user_id = $2 AND c.kind = 'report' AND c.state = 'paid'
      AND p.amount_paise > (SELECT COALESCE(sum(f.amount_paise), 0)
        FROM billing_refunds f WHERE f.provider_payment_id = p.provider_payment_id)
    LIMIT 1
  `, [req.params.id, id]);
  if (!item) throw new HttpError(404, 'Report purchase unavailable.');
  const place = await getPublicLocality(item.place_id);
  if (!place) throw new HttpError(404, 'Place unavailable.');
  res.attachment('areawise-test-evidence.csv').send(renderEvidenceCsv([place]));
}));

interface Entity {
  id?: unknown;
  status?: unknown;
  amount?: unknown;
  currency?: unknown;
  order_id?: unknown;
  payment_id?: unknown;
  invoice_id?: unknown;
  plan_id?: unknown;
  current_end?: unknown;
  created_at?: unknown;
  captured?: unknown;
}
interface ProviderEvent {
  event: string;
  created_at: number;
  payload: Record<string, { entity?: Entity } | undefined>;
}

function providerId(value: unknown, prefix: string): value is string {
  return typeof value === 'string' && value.length <= 64 && value.startsWith(prefix + '_') && /^[a-zA-Z0-9_]+$/.test(value);
}
function amount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 5000000;
}
function timestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value < 4102444800;
}

export async function applySandboxEvent(eventId: string, digest: string, event: ProviderEvent) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const deduplicated = await client.query(`
      INSERT INTO billing_events (event_id, event_type, digest) VALUES ($1,$2,$3)
      ON CONFLICT DO NOTHING RETURNING event_id
    `, [eventId, event.event, digest]);
    if (!deduplicated.rowCount) {
      const previous = await client.query<{ digest: string }>('SELECT digest FROM billing_events WHERE event_id = $1', [eventId]);
      if (previous.rows[0]?.digest !== digest) throw new HttpError(409, 'Conflicting payment event.');
      await client.query('COMMIT');
      return { accepted: true, duplicate: true };
    }

    const payment = event.payload.payment?.entity;
    const subscription = event.payload.subscription?.entity;
    const refund = event.payload.refund?.entity;
    const providerRef = providerId(subscription?.id, 'sub') ? subscription.id
      : providerId(payment?.order_id, 'order') ? payment.order_id : null;
    const { rows: [checkout] } = providerRef ? await client.query<Checkout>(
      'SELECT * FROM billing_checkouts WHERE provider_id = $1 FOR UPDATE', [providerRef],
    ) : { rows: [] };
    let applied = false;

    if (event.event === 'refund.processed' && providerId(refund?.id, 'rfnd') && providerId(refund?.payment_id, 'pay') &&
        amount(refund.amount) && refund.status === 'processed' && timestamp(refund.created_at)) {
      await client.query(`
        INSERT INTO billing_refunds (provider_refund_id, provider_payment_id, amount_paise, refunded_at)
        VALUES ($1,$2,$3,to_timestamp($4)) ON CONFLICT DO NOTHING
      `, [refund.id, refund.payment_id, refund.amount, refund.created_at]);
      applied = true;
    }

    const orderCapture = checkout?.kind === 'report' && ['payment.captured', 'order.paid'].includes(event.event);
    const subscriptionCharge = checkout?.kind === 'subscription' && event.event === 'subscription.charged' &&
      subscription?.plan_id === checkout.provider_plan_id && timestamp(subscription.current_end) && subscription.current_end > event.created_at;
    if ((orderCapture || subscriptionCharge) && providerId(payment?.id, 'pay') &&
        payment.status === 'captured' && payment.captured !== false && payment.currency === 'INR' &&
        payment.amount === checkout.amount_paise && timestamp(payment.created_at)) {
      const recorded = await client.query(`
        INSERT INTO billing_charges (provider_payment_id, checkout_id, amount_paise, provider_invoice_id, charged_at)
        VALUES ($1,$2,$3,$4,to_timestamp($5)) ON CONFLICT DO NOTHING RETURNING checkout_id
      `, [payment.id, checkout.id, payment.amount, providerId(payment.invoice_id, 'inv') ? payment.invoice_id : null, payment.created_at]);
      if (recorded.rowCount) {
        if (orderCapture) {
          await client.query("UPDATE billing_checkouts SET state = 'paid' WHERE id = $1", [checkout.id]);
        } else {
          await client.query(`
            UPDATE billing_checkouts
            SET period_end = GREATEST(period_end, to_timestamp($2)),
                state = CASE WHEN $3 >= state_event_at AND state NOT IN ('cancelled','completed','cancel_requested') THEN 'active' ELSE state END,
                state_event_at = GREATEST(state_event_at, $3)
            WHERE id = $1
          `, [checkout.id, subscription?.current_end, event.created_at]);
        }
        applied = true;
      }
    }

    if (event.event === 'payment.failed' && checkout?.kind === 'report' && checkout.state === 'checkout') {
      await client.query("UPDATE billing_checkouts SET state = 'payment_failed' WHERE id = $1", [checkout.id]);
      applied = true;
    }

    const stateEvents: Record<string, string> = {
      'subscription.pending': 'pending', 'subscription.halted': 'pending',
      'subscription.paused': 'paused', 'subscription.cancelled': 'cancelled', 'subscription.completed': 'completed',
      'subscription.resumed': 'active',
    };
    const state = Object.hasOwn(stateEvents, event.event) ? stateEvents[event.event] : undefined;
    if (state && checkout?.kind === 'subscription' && subscription?.plan_id === checkout.provider_plan_id &&
        event.created_at >= Number(checkout.state_event_at) && !['cancelled','completed'].includes(checkout.state)) {
      await client.query('UPDATE billing_checkouts SET state = $2, state_event_at = $3 WHERE id = $1',
        [checkout.id, state, event.created_at]);
      applied = true;
    }
    await client.query('COMMIT');
    return { accepted: true, applied };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export const billingWebhook = [
  raw({ type: 'application/json', limit: '192kb' }),
  route(async (req, res) => {
    const credentials = sandboxCredentials();
    if (!credentials) throw new HttpError(503, 'Test-mode webhooks are unavailable.');
    const eventId = req.get('x-razorpay-event-id');
    if (!Buffer.isBuffer(req.body) || !isValidRazorpaySignature(req.body, req.get('x-razorpay-signature'), credentials.webhookSecret)) {
      throw new HttpError(401, 'Invalid payment event signature.');
    }
    if (!eventId || !/^[a-zA-Z0-9_-]{4,128}$/.test(eventId)) throw new HttpError(400, 'Invalid payment event identifier.');
    let event: ProviderEvent;
    try { event = JSON.parse(req.body.toString('utf8')); }
    catch { throw new HttpError(400, 'Invalid payment event.'); }
    if (!event || !validText(event.event, 1, 80) || !timestamp(event.created_at) || !event.payload || typeof event.payload !== 'object') {
      throw new HttpError(400, 'Invalid payment event fields.');
    }
    res.json(await applySandboxEvent(eventId, createHash('sha256').update(req.body).digest('hex'), event));
  }),
];

export const sandboxBillingSummary = route(async (_req, res) => {
  const [checkouts, captures, refunds] = await Promise.all([
    pool.query('SELECT state, count(*)::int AS count FROM billing_checkouts GROUP BY state ORDER BY state'),
    pool.query('SELECT count(*)::int AS count, COALESCE(sum(amount_paise),0)::text AS total FROM billing_charges'),
    pool.query('SELECT count(*)::int AS count, COALESCE(sum(f.amount_paise),0)::text AS total FROM billing_refunds f JOIN billing_charges p USING (provider_payment_id)'),
  ]);
  res.json({ mode: 'test', checkouts: checkouts.rows, captures: captures.rows[0], refunds: refunds.rows[0] });
});
