import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from './http';

export function sandboxCredentials() {
  const key = process.env.RAZORPAY_KEY_ID?.trim();
  const secret = process.env.RAZORPAY_KEY_SECRET?.trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  return key && /^rzp_test_[a-zA-Z0-9]+$/.test(key) && secret && webhookSecret
    ? { key, secret, webhookSecret }
    : null;
}

export function isValidRazorpaySignature(body: Buffer, signature: string | undefined, secret: string) {
  if (!signature || !/^[\da-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}

export interface SandboxPaymentProvider {
  createOrder(amountPaise: number, receipt: string): Promise<string>;
  createSubscription(planId: string, amountPaise: number, cycles: number, checkoutId: string): Promise<string>;
  cancelSubscription(id: string): Promise<void>;
}

export function razorpaySandbox(): SandboxPaymentProvider {
  const credentials = sandboxCredentials();
  if (!credentials) throw new HttpError(503, 'Razorpay Test Mode is unavailable.');
  const auth = Buffer.from(`${credentials.key}:${credentials.secret}`).toString('base64');

  async function request(path: string, body?: object) {
    let result: Response;
    try {
      result = await fetch('https://api.razorpay.com/v1' + path, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'error',
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw new HttpError(502, 'The payment sandbox could not confirm the request.');
    }
    if (!result.ok) throw new HttpError(502, 'Razorpay Test Mode could not complete the request.');
    return result.json();
  }

  return {
    async createOrder(amountPaise, receipt) {
      const result = await request('/orders', { amount: amountPaise, currency: 'INR', receipt });
      if (!/^order_[a-zA-Z0-9]+$/.test(result.id) || result.amount !== amountPaise || result.currency !== 'INR') {
        throw new HttpError(502, 'The sandbox returned an unexpected checkout.');
      }
      return result.id;
    },
    async createSubscription(planId, amountPaise, cycles, checkoutId) {
      const plan = await request(`/plans/${planId}`);
      if (plan.id !== planId || plan.item?.amount !== amountPaise || plan.item?.currency !== 'INR' ||
          plan.period !== 'monthly' || plan.interval !== 1) {
        throw new HttpError(409, 'The sandbox subscription plan and displayed monthly price differ.');
      }
      const result = await request('/subscriptions', {
        plan_id: planId, total_count: cycles, customer_notify: 0, notes: { areawise_checkout_id: checkoutId },
      });
      if (!/^sub_[a-zA-Z0-9]+$/.test(result.id) || result.plan_id !== planId) {
        throw new HttpError(502, 'The sandbox returned an unexpected subscription.');
      }
      return result.id;
    },
    async cancelSubscription(id) {
      await request(`/subscriptions/${id}/cancel`, { cancel_at_cycle_end: 1 });
    },
  };
}
