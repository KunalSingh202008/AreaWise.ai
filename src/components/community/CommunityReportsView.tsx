import { useEffect, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import type { CommunityReport, Locality } from '../../types';
import { getJson, readJson } from '../../api';
import { authenticatedFetch, useAuth } from '../../context/AuthContext';
import { PlaceSearch } from '../geography/PlaceSearch';

interface Props {
  locality: Locality;
  onSelectLocality: (id: string) => void;
}

const categories = [
  ['drainage', 'Drainage and waterlogging'], ['roads', 'Roads and traffic'], ['water_supply', 'Water supply'],
  ['street_lighting', 'Street lighting'], ['waste', 'Waste'], ['air_noise', 'Air and noise'],
] as const;

export function CommunityReportsView({ locality, onSelectLocality }: Props) {
  const { user } = useAuth();
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [category, setCategory] = useState('');
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedLoading, setFeedLoading] = useState(true);

  useEffect(() => {
    const abort = new AbortController();
    const query = new URLSearchParams({ localityId: locality.id });
    if (category) query.set('category', category);
    getJson<{ reports: CommunityReport[] }>('/api/v1/community/reports?' + query, abort.signal)
      .then((value) => { if (!abort.signal.aborted) setReports(value.reports); })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Reports unavailable.');
      })
      .finally(() => { if (!abort.signal.aborted) setFeedLoading(false); });
    return () => abort.abort();
  }, [locality.id, category]);

  async function confirmReport(id: string) {
    setError('');
    setBusy(true);
    try {
      const value = await authenticatedFetch(`/api/v1/community/reports/${encodeURIComponent(id)}/vote`, {
        method: 'POST',
      }).then((response) => readJson<{ upvotes: number }>(response));
      setReports((previous) => previous.map((report) => report.id === id ? { ...report, upvotes: value.upvotes } : report));
      setConfirmed((previous) => [...previous, id]);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not confirm report.');
    } finally {
      setBusy(false);
    }
  }

  const input = 'w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-700';
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Community reports</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">{locality.name} · Reports are published after moderation.</p>
        <PlaceSearch onSelect={(place) => onSelectLocality(place.id)} />
      </header>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {status && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{status}</p>}
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <section className="space-y-3">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">Category
            <select value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                setFeedLoading(true);
                setReports([]);
                setError('');
              }}
              className="rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
              <option value="">All categories</option>
              {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          {feedLoading && <p role="status" className="text-sm text-slate-500">Loading published reports…</p>}
          {!feedLoading && !reports.length && <p className="text-sm text-slate-600 dark:text-slate-400">No published reports for this selection.</p>}
          {reports.map((report) => (
            <article key={report.id} className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-bold">{report.title}</h2>
                <span className="text-xs text-slate-500">{report.status === 'action_taken' ? 'Action recorded' : 'Published community report'}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm">{report.description}</p>
              {report.officialResponse && <p className="rounded bg-slate-100 p-2 text-sm dark:bg-slate-800">Moderation note · {report.officialResponse}</p>}
              <button disabled={!user || busy || confirmed.includes(report.id)} onClick={() => void confirmReport(report.id)}
                className="flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 disabled:opacity-60">
                <ThumbsUp aria-hidden className="h-4 w-4" /> {confirmed.includes(report.id) ? 'Confirmed' : 'Confirm'} · {report.upvotes}
              </button>
            </article>
          ))}
        </section>
        <section className="h-fit space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-bold">Report a civic issue</h2>
          {!user ? <p className="text-sm text-slate-500">Sign in to submit or confirm a report.</p> : (
            <form className="space-y-3" onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = Object.fromEntries(new FormData(form));
              setError('');
              setStatus('');
              setBusy(true);
              try {
                await authenticatedFetch('/api/v1/community/reports', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ ...values, localityId: locality.id }),
                }).then((response) => readJson<CommunityReport>(response));
                form.reset();
                setStatus('Your report is awaiting moderation. Follow it in your saved areas dashboard.');
              } catch (error) {
                setError(error instanceof Error ? error.message : 'Could not submit report.');
              } finally {
                setBusy(false);
              }
            }}>
              <label className="block space-y-1 text-xs font-semibold">Category
                <select name="category" className={input}>
                  {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
              </label>
              <label className="block space-y-1 text-xs font-semibold">Title
                <input name="title" className={input} required minLength={5} maxLength={140} />
              </label>
              <label className="block space-y-1 text-xs font-semibold">Description
                <textarea name="description" rows={4} className={input} required minLength={10} maxLength={2000} />
              </label>
              <p className="text-xs text-slate-500">Describe the public issue. Avoid names, phone numbers and private addresses. The map uses the selected place’s centre.</p>
              <button type="submit" disabled={busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Submit for review</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
