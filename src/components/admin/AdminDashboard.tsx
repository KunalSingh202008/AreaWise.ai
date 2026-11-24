import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { authenticatedFetch } from '../../context/AuthContext';
import { readJson } from '../../api';
import type { CommunityReport } from '../../types';
import { ObservationReview } from './ObservationReview';

interface SourceRun {
  id: string;
  dataset: string;
  name: string;
  publisher: string;
  sourceUrl: string;
  licenseUrl: string;
  importedAt: string;
  rowCount: number;
  sha256: string;
  active: boolean;
}
interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

async function load<T>(path: string, signal: AbortSignal) {
  return readJson<T>(await authenticatedFetch('/api/v1/admin/' + path, { signal }));
}

export function AdminDashboard() {
  const [sources, setSources] = useState<SourceRun[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [auditRevision, setAuditRevision] = useState(0);
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditError, setAuditError] = useState('');

  useEffect(() => {
    const abort = new AbortController();
    Promise.allSettled([
      load<SourceRun[]>('data-sources', abort.signal).then((value) => { if (!abort.signal.aborted) setSources(value); }),
      load<Record<string, number>>('scoring-weights', abort.signal).then((value) => { if (!abort.signal.aborted) setWeights(value); }),
      load<{ reports: CommunityReport[] }>('community/reports', abort.signal).then((value) => { if (!abort.signal.aborted) setReports(value.reports); }),
    ]).then((results) => {
      if (abort.signal.aborted) return;
      const failed = results.find((entry) => entry.status === 'rejected');
      if (failed?.status === 'rejected') setError(failed.reason instanceof Error ? failed.reason.message : 'Administrator data unavailable.');
      setLoading(false);
    });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    const abort = new AbortController();
    load<AuditEntry[]>('audit-logs', abort.signal)
      .then((value) => { if (!abort.signal.aborted) setAudit(value); })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setAuditError(error instanceof Error ? error.message : 'Could not load audit activity.');
      })
      .finally(() => { if (!abort.signal.aborted) setAuditLoading(false); });
    return () => abort.abort();
  }, [auditRevision]);

  function refreshAudit() {
    setAuditLoading(true);
    setAuditError('');
    setAuditRevision((current) => current + 1);
  }

  async function moderate(id: string, status: CommunityReport['status']) {
    setError('');
    setUpdating(id);
    try {
      const report = await authenticatedFetch(`/api/v1/community/reports/${encodeURIComponent(id)}/moderate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, officialResponse: notes[id] }),
      }).then((response) => readJson<CommunityReport>(response));
      setReports((previous) => previous.map((item) => item.id === id ? report : item));
      refreshAudit();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update report.');
    } finally {
      setUpdating(null);
    }
  }

  const panel = 'space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold"><ShieldCheck className="h-6 w-6 text-emerald-600" /> Administration</h1>
      {loading && <p role="status" className="text-sm text-slate-500">Loading administrator records…</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}

      <section className={panel}>
        <h2 className="font-bold">Dataset imports</h2>
        {!loading && !sources.length && <p className="text-sm text-slate-500">No dataset imports recorded.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {sources.map((source) => (
            <li key={source.id} className="space-y-1 py-3 text-sm">
              <p className="font-semibold">{source.name} · {source.active ? 'Active' : 'Archived'}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{source.publisher} · {source.rowCount.toLocaleString('en-IN')} records · {source.importedAt.slice(0, 10)}</p>
              <p className="flex flex-wrap gap-3 text-xs"><a href={source.sourceUrl} className="underline">Source archive</a><a href={source.licenseUrl} className="underline">Licence</a><span className="break-all font-mono" title={source.sha256}>SHA-256 {source.sha256.slice(0, 12)}…</span></p>
            </li>
          ))}
        </ul>
      </section>

      <ObservationReview onChange={refreshAudit} />

      <section className={panel}>
        <h2 className="font-bold">Community moderation</h2>
        {!loading && !reports.length && <p className="text-sm text-slate-500">No reports in this workspace.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {reports.map((report) => (
            <li key={report.id} className="space-y-2 py-3 text-sm">
              <p className="font-semibold">{report.title} · {report.localityName}</p>
              <p className="whitespace-pre-wrap text-sm">{report.description}</p>
              <p className="text-xs text-slate-500">{report.status.replaceAll('_', ' ')}</p>
              <label className="block text-xs font-semibold">
                Public moderation note
                <textarea maxLength={1200} value={notes[report.id] ?? report.officialResponse ?? ''}
                  onChange={(event) => setNotes((previous) => ({ ...previous, [report.id]: event.target.value }))}
                  className="mt-1 block w-full max-w-lg rounded-md border border-slate-300 bg-transparent p-2 dark:border-slate-700" />
              </label>
              <div className="flex flex-wrap gap-2">
                {([['verified', 'Publish'], ['action_taken', 'Action taken'], ['rejected', 'Reject'], ['under_review', 'Return to review']] as const).map(([status, label]) => (
                  <button key={status} disabled={!!updating}
                    onClick={() => void moderate(report.id, status)}
                    className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold dark:border-slate-700">{label}</button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={panel}>
        <h2 className="font-bold">Scoring weights</h2>
        <p className="text-xs text-slate-500">Weights are published with the scoring methodology version.</p>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {Object.entries(weights).map(([key, value]) => (
            <div key={key} className="flex justify-between rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-800">
              <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
              <dd>{Math.round(value * 10000) / 100}%</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={panel}>
        <h2 className="font-bold">Audit activity</h2>
        {auditLoading && <p role="status" className="text-sm text-slate-500">Loading audit activity…</p>}
        {auditError && <p role="alert" className="text-sm text-rose-600">{auditError}{' '}
          <button className="underline" type="button" onClick={refreshAudit}>Retry</button>
        </p>}
        {!auditLoading && !auditError && !audit.length && <p className="text-sm text-slate-500">No audit entries recorded.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {audit.map((entry) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-2 py-2 text-xs">
              <span className="font-semibold">{entry.action.replaceAll('_', ' ')}</span>
              <span>{new Date(entry.timestamp).toLocaleString('en-IN')}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
