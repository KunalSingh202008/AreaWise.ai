import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Locality, PlaceSummary } from '../../types';
import { readJson } from '../../api';
import { authenticatedFetch, useAuth } from '../../context/AuthContext';
import { PlaceSearch } from '../geography/PlaceSearch';

interface Props {
  places: PlaceSummary[];
  initialSelectedIds: string[];
  onSelectLocality: (id: string) => void;
  onAskCopilot: (ids: string[]) => void;
}

interface Comparison {
  localities: Locality[];
  comparisonMatrix: { categoryKey: string; categoryLabel: string; scores: Record<string, number | null> }[];
}

export function LocalityComparison({ places, initialSelectedIds, onSelectLocality, onAskCopilot }: Props) {
  const { user, reloadAccount } = useAuth();
  const [saveStatus, setSaveStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [selection, setSelection] = useState<string[] | null>(initialSelectedIds.length ? initialSelectedIds : null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [error, setError] = useState('');
  const ids = selection ?? places.slice(0, 2).map((place) => place.id);
  const signature = ids.join(',');

  useEffect(() => {
    if (!signature.includes(',')) return;
    const abort = new AbortController();
    fetch('/api/v1/comparisons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: signature.split(',') }),
      signal: abort.signal,
    }).then((response) => readJson<Comparison>(response))
      .then((value) => { if (!abort.signal.aborted) setComparison(value); })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Could not compare selected places.');
      });
    return () => abort.abort();
  }, [signature]);

  function select(next: string[]) {
    setSelection(next);
    setSaveStatus('');
    setError('');
    setComparison(null);
  }

  const labelFor = (id: string) => names[id]
    ?? comparison?.localities.find((place) => place.id === id)?.name
    ?? places.find((place) => place.id === id)?.name
    ?? id;

  const profiles = [
    ['familyScore', 'Family'],
    ['studentScore', 'Student'],
    ['commuterScore', 'Commuter'],
    ['investorScore', 'Investor'],
  ] as const;
  const rows = comparison ? [
    { label: 'AreaScore', values: comparison.localities.map((locality) => locality.scores.overallScore ?? 'Withheld') },
    { label: 'Score evidence coverage', values: comparison.localities.map((locality) => `${locality.scores.coverageScore}%`) },
    { label: 'Score confidence', values: comparison.localities.map((locality) => locality.scores.confidenceScore ?? 'Unavailable') },
    ...profiles.map(([key, label]) => ({
      label: `${label} profile`,
      values: comparison.localities.map((locality) => locality.profileScores[key] ?? 'Unavailable'),
    })),
    ...comparison.comparisonMatrix.map((field) => ({
      label: field.categoryLabel, values: comparison.localities.map((locality) => field.scores[locality.id] ?? 'Unavailable'),
    })),
  ] : [];

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Compare localities</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Choose two to five places and compare their coverage, scores and evidence.</p>
      </header>
      {ids.length < 5 && <PlaceSearch label="Add a place by name or PIN" onSelect={(place) => {
        if (ids.includes(place.id)) return;
        setNames((previous) => ({ ...previous, [place.id]: place.name }));
        select([...ids, place.id]);
      }} />}
      <ul aria-label="Selected places" className="flex flex-wrap gap-2">
        {ids.map((id) => (
          <li key={id}>
            <button onClick={() => select(ids.filter((item) => item !== id))}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold dark:border-slate-700">
              {labelFor(id)} <X className="h-3 w-3" aria-label="Remove" />
            </button>
          </li>
        ))}
      </ul>
      {ids.length < 2 && <p role="status" className="text-sm text-slate-500">Select at least two places.</p>}
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      {ids.length >= 2 && !comparison && !error && <p role="status" className="text-sm text-slate-500">Loading comparison…</p>}
      {comparison && (
        <>
          {user && <form className="flex flex-wrap items-end gap-2" onSubmit={async (event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setSaveStatus('');
            setSaving(true);
            try {
              await authenticatedFetch('/api/v1/me/comparisons', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: data.get('title'), placeIds: ids }),
              }).then((response) => readJson(response));
              await reloadAccount();
              setSaveStatus('Comparison saved to My research.');
            } catch (error) {
              setSaveStatus(error instanceof Error ? error.message : 'Could not save comparison.');
            } finally {
              setSaving(false);
            }
          }}>
            <label className="space-y-1 text-xs font-semibold">
              Comparison title
              <input name="title" type="text" maxLength={120} required className="block rounded-lg border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-700" />
            </label>
            <button disabled={saving} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white">Save comparison</button>
            {saveStatus && <p role="status" className="text-xs">{saveStatus}</p>}
          </form>}
          <button className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold dark:border-slate-700" onClick={() => onAskCopilot(ids)}>
            Ask Copilot about these places
          </button>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-slate-100 dark:bg-slate-800">
                <tr>
                  <th scope="col" className="p-3">Measure</th>
                  {comparison.localities.map((place) => (
                    <th scope="col" key={place.id} className="min-w-32 p-3">
                      <button className="text-emerald-700 underline dark:text-emerald-300" onClick={() => onSelectLocality(place.id)}>{place.name}</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800">
                    <th scope="row" className="p-3 text-xs font-semibold">{row.label}</th>
                    {row.values.map((value, index) => (
                      <td key={comparison.localities[index].id} className="p-3 tabular-nums">{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Comparison sources">
            {comparison.localities.map((place) => (
              <div key={place.id} className="rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800">
                <h2 className="font-bold">{place.name}</h2>
                {place.geography && <a href={place.geography.source.recordUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs underline">GeoNames source record</a>}
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                  {place.observations?.length || 'No'} reviewed measurements
                  {place.pincode && ` · PIN ${place.pincode}`}
                </p>
              </div>
            ))}
          </section>
        </>
      )}
    </div>
  );
}
