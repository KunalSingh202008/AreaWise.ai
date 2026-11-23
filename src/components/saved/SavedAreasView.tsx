import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import type { CommunityReport, Locality } from '../../types';
import { getJson, readJson } from '../../api';
import { authenticatedFetch, useAuth } from '../../context/AuthContext';

interface Props {
  onSelectLocality: (id: string) => void;
  onOpenCompare: (selectedIds: string[]) => void;
  onOpenReport: (locality: Locality) => void;
}
interface SavedPlace {
  id: string;
  name: string;
  region: string;
}

export function SavedAreasView({ onSelectLocality, onOpenCompare, onOpenReport }: Props) {
  const { user, loading, accountError, comparisons, reloadAccount, toggleSaveLocality, setPreferredProfile } = useAuth();
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [error, setError] = useState('');
  const uid = user?.id;
  const signature = user?.savedLocalityIds.join(',');

  useEffect(() => {
    if (!uid) return;
    const abort = new AbortController();
    async function load<T>(path: string) {
      return readJson<T>(await authenticatedFetch('/api/v1/me/' + path, { signal: abort.signal }));
    }
    Promise.all([
      load<{ places: SavedPlace[] }>('saved'),
      load<{ reports: CommunityReport[] }>('reports'),
    ]).then(([saved, authored]) => {
      if (!abort.signal.aborted) {
        setPlaces(saved.places);
        setReports(authored.reports);
      }
    }).catch((error: unknown) => {
      if (!abort.signal.aborted) setError(error instanceof Error ? error.message : 'Dashboard data unavailable.');
    });
    return () => abort.abort();
  }, [uid, signature]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not update your dashboard.');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Bookmark className="h-6 w-6 text-emerald-600" /> My research</h1>
      {loading && <p role="status" className="text-sm text-slate-500">Loading account…</p>}
      {!loading && !user && <p className="text-sm text-slate-600 dark:text-slate-400">Sign in to see saved places, comparisons and your community submissions.</p>}
      {(error || accountError) && <p role="alert" className="text-sm text-rose-600">{error || accountError}</p>}
      {user && (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm">Preferred profile
            <select value={user.preferredProfile} className="rounded border border-slate-300 bg-transparent p-2 text-xs dark:border-slate-700"
              onChange={(event) => setPreferredProfile(event.target.value as LocalityProfile)}>
              {(['family', 'student', 'commuter', 'investor'] as const).map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>

          <section className="space-y-3" aria-label="Saved places">
            <h2 className="font-bold">Saved places</h2>
            {!places.length && <p className="text-sm text-slate-500">Save a location from its locality profile.</p>}
            <ul className="grid gap-3 md:grid-cols-2">
              {places.map((place) => (
                <li key={place.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <button onClick={() => onSelectLocality(place.id)} className="font-semibold underline">{place.name}</button>
                  <p className="text-xs text-slate-500">{place.region}</p>
                  <div className="mt-3 flex gap-3 text-xs">
                    <button onClick={() => void run(async () => onOpenReport(await getJson<Locality>(`/api/v1/locations/${encodeURIComponent(place.id)}`)))} className="underline">Evidence brief</button>
                    <button onClick={() => void run(() => toggleSaveLocality(place.id))} className="underline">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3" aria-label="Saved comparisons">
            <h2 className="font-bold">Saved comparisons</h2>
            {!comparisons.length && <p className="text-sm text-slate-500">Save a comparison to reopen it here.</p>}
            <ul className="space-y-2">
              {comparisons.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <button onClick={() => onOpenCompare(item.placeIds)} className="font-semibold underline">{item.title}</button>
                  <button className="text-xs underline" onClick={() => void run(async () => {
                    const response = await authenticatedFetch(`/api/v1/me/comparisons/${item.id}`, { method: 'DELETE' });
                    if (response.status !== 204) await readJson(response);
                    await reloadAccount();
                  })}>Remove</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-3" aria-label="My community submissions">
            <h2 className="font-bold">My community submissions</h2>
            {!reports.length && <p className="text-sm text-slate-500">No submissions yet.</p>}
            <ul className="space-y-2">
              {reports.map((report) => <li key={report.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <strong>{report.title}</strong> · {report.localityName}
                <p className="text-xs text-slate-500">{report.status.replaceAll('_', ' ')}</p>
              </li>)}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

type LocalityProfile = 'family' | 'student' | 'commuter' | 'investor';
