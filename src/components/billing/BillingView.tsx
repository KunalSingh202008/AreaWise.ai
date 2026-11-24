import { useEffect, useRef, useState } from 'react';
import { downloadTextFile, getJson, readJson } from '../../api';
import { authenticatedFetch, useAuth } from '../../context/AuthContext';
import type { PlaceSummary } from '../../types';
import { PlaceSearch } from '../geography/PlaceSearch';

interface Plan {
  code: string;
  title: string;
  kind: 'report' | 'subscription';
  amountPaise: number;
  tier?: string;
}
interface Checkout {
  id: string;
  providerId: string;
  key: string;
  title: string;
  kind: Plan['kind'];
  amountPaise: number;
  currency: 'INR';
}
interface History {
  tier: string | null;
  checkouts: { id: string; title: string; kind: Plan['kind']; amountPaise: number; state: string; periodEnd: string | null; placeId: string | null }[];
  charges: { paymentId: string; invoiceId: string | null; amountPaise: number; chargedAt: string }[];
  refunds: { refundId: string; paymentId: string; amountPaise: number; refundedAt: string }[];
}
interface CheckoutOptions {
  key: string;
  name: string;
  description: string;
  order_id?: string;
  subscription_id?: string;
  amount?: number;
  currency?: 'INR';
  handler: () => void;
  modal: { ondismiss: () => void };
}
type RazorpayConstructor = new (options: CheckoutOptions) => { open(): void };
const browser = window as typeof window & { Razorpay?: RazorpayConstructor };

let loader: Promise<RazorpayConstructor> | undefined;
function loadCheckout() {
  if (browser.Razorpay) return Promise.resolve(browser.Razorpay);
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    const fail = () => {
      script.remove();
      loader = undefined;
      reject(new Error('Razorpay checkout could not load.'));
    };
    script.onload = () => browser.Razorpay ? resolve(browser.Razorpay) : fail();
    script.onerror = fail;
    document.head.append(script);
  });
  return loader;
}

const price = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount / 100);

export function BillingView() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [history, setHistory] = useState<History | null>(null);
  const [reportPlace, setReportPlace] = useState<PlaceSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const requestKeys = useRef<Record<string, string>>({});

  useEffect(() => {
    const abort = new AbortController();
    getJson<{ plans: Plan[] }>('/api/v1/billing/plans', abort.signal)
      .then((value) => { if (!abort.signal.aborted) setPlans(value.plans); })
      .catch((error: unknown) => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Test plans unavailable.'); });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const abort = new AbortController();
    authenticatedFetch('/api/v1/billing/history', { signal: abort.signal }).then((response) => readJson<History>(response))
      .then((value) => { if (!abort.signal.aborted) setHistory(value); })
      .catch((error: unknown) => { if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Could not load test activity.'); });
    return () => abort.abort();
  }, [user?.id]);

  async function refreshHistory() {
    await run(async () => setHistory(await authenticatedFetch('/api/v1/billing/history').then((response) => readJson<History>(response))));
  }

  async function run(action: () => Promise<unknown>) {
    setError('');
    try { await action(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Test billing action failed.'); }
  }

  async function purchase(plan: Plan) {
    if (!user || busy) return;
    const itemKey = plan.code + (plan.kind === 'report' ? '/' + reportPlace?.id : '');
    const idempotencyKey = requestKeys.current[itemKey] ??= crypto.randomUUID();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const [Razorpay, checkout] = await Promise.all([
        loadCheckout(),
        authenticatedFetch('/api/v1/billing/checkouts', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
          body: JSON.stringify({ code: plan.code, placeId: plan.kind === 'report' ? reportPlace?.id : undefined }),
        }).then((response) => readJson<Checkout>(response)),
      ]);
      const instance = new Razorpay({
        name: 'AreaWise AI · Test Mode', description: checkout.title, key: checkout.key,
        ...(checkout.kind === 'report'
          ? { order_id: checkout.providerId, amount: checkout.amountPaise, currency: checkout.currency }
          : { subscription_id: checkout.providerId }),
        handler: () => {
          setBusy(false);
          setNotice('Checkout returned. Refresh test activity after Razorpay sends confirmation.');
          void refreshHistory();
        },
        modal: { ondismiss: () => { setBusy(false); void refreshHistory(); } },
      });
      instance.open();
    } catch (error) {
      setBusy(false);
      setError(error instanceof Error ? error.message : 'Could not open test checkout.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Plans and test billing</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Razorpay Test Mode uses test payment details. Search, maps and basic evidence briefs are available without a purchase.</p>
      </header>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {plans === null && !error && <p role="status" className="text-sm text-slate-500">Loading test plans…</p>}
      {plans?.length === 0 && <p className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">Test checkout is unavailable in this environment.</p>}
      {plans?.some((plan) => plan.kind === 'report') && (
        <section className="space-y-2">
          <PlaceSearch label="Select a place for the evidence CSV" onSelect={setReportPlace} />
          {reportPlace && <p className="text-sm">Evidence export for <strong>{reportPlace.name}</strong></p>}
        </section>
      )}
      {plans && plans.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Test plans">
          {plans.map((plan) => (
            <article key={plan.code} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-bold">{plan.title}</h2>
              <p className="text-xl font-extrabold">{price(plan.amountPaise)}<span className="text-xs font-normal text-slate-500">{plan.kind === 'subscription' ? ' / month' : ' / export'}</span></p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{plan.kind === 'report' ? 'Source-attributed CSV for the selected place.'
                : plan.tier === 'professional' ? 'Research workspaces and increased Copilot allowance.'
                  : 'Increased Copilot allowance in Test Mode.'}</p>
              <button disabled={!user || busy || (plan.kind === 'report' && !reportPlace)} onClick={() => void purchase(plan)}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">
                {user ? 'Open test checkout' : 'Sign in to test checkout'}
              </button>
            </article>
          ))}
        </section>
      )}
      {user && (
        <section className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800" aria-label="Test activity">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-bold">Your test activity</h2><button className="text-xs underline" onClick={() => void refreshHistory()}>Refresh status</button>
          </div>
          {history?.tier && <p className="text-sm">Active test plan · <strong>{history.tier}</strong></p>}
          {history && !history.checkouts.length && <p className="text-sm text-slate-500">No test checkouts yet.</p>}
          {history?.checkouts.map((checkout) => (
            <div key={checkout.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-200 py-2 text-sm dark:border-slate-800">
              <span>{checkout.title} · {price(checkout.amountPaise)} · {checkout.state.replaceAll('_', ' ')}
                {checkout.periodEnd && ` · through ${checkout.periodEnd.slice(0, 10)}`}</span>
              {checkout.kind === 'report' && checkout.state === 'paid' && (
                <button className="text-xs underline" onClick={() => void run(async () => {
                  await downloadTextFile(await authenticatedFetch(`/api/v1/billing/checkouts/${checkout.id}/report.csv`), 'areawise-test-evidence.csv');
                })}>Download evidence CSV</button>
              )}
              {checkout.kind === 'subscription' && ['active', 'pending'].includes(checkout.state) && (
                <button className="text-xs underline" onClick={() => void run(async () => {
                  await authenticatedFetch(`/api/v1/billing/checkouts/${checkout.id}/cancel`, { method: 'POST' }).then((response) => readJson(response));
                  await refreshHistory();
                })}>Cancel after current cycle</button>
              )}
            </div>
          ))}
          {history && (history.charges.length > 0 || history.refunds.length > 0) && (
            <details className="border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
              <summary className="cursor-pointer font-semibold">Recorded captures and refunds</summary>
              <ul className="mt-2 space-y-1">
                {history.charges.map((entry) => <li key={entry.paymentId}>Capture · {price(entry.amountPaise)} · {entry.paymentId}{entry.invoiceId && ` · Provider invoice ${entry.invoiceId}`}</li>)}
                {history.refunds.map((entry) => <li key={entry.refundId}>Refund · {price(entry.amountPaise)} · {entry.refundId}</li>)}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
