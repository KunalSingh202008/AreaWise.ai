import { useEffect, useState, type FormEvent } from 'react';
import { readJson } from '../../api';
import { authenticatedFetch } from '../../context/AuthContext';
import { observationCategories, type PlaceSummary, type ReviewedObservation } from '../../types';
import { PlaceSearch } from '../geography/PlaceSearch';

const endpoint = '/api/v1/admin/observations';
const input = 'mt-1 block w-full rounded-md border border-slate-300 bg-transparent p-2 text-sm font-normal dark:border-slate-700';
const primary = 'rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60';
const fields = [
  { name: 'metric', label: 'Measurement name', maxLength: 120 },
  { name: 'value', label: 'Reported value', maxLength: 120 },
  { name: 'unit', label: 'Unit (optional)', maxLength: 40 },
  { name: 'observationDate', label: 'Observation date', type: 'date' },
  { name: 'publisher', label: 'Publisher', maxLength: 150 },
  { name: 'geographicLevel', label: 'Geographic scope', maxLength: 180 },
  { name: 'referenceUrl', label: 'Evidence link', type: 'url', maxLength: 2048 },
  { name: 'licenseUrl', label: 'Licence or permission link', type: 'url', maxLength: 2048 },
] as const;

async function submitObservation(path: string, data: object) {
  return readJson<ReviewedObservation>(await authenticatedFetch(endpoint + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }));
}

export function ObservationReview({ onChange }: { onChange: () => void }) {
  const [place, setPlace] = useState<PlaceSummary | null>(null);
  const [observations, setObservations] = useState<ReviewedObservation[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const placeId = place?.id;

  useEffect(() => {
    const abort = new AbortController();
    const filter = placeId ? '?' + new URLSearchParams({ placeId }) : '';
    authenticatedFetch(endpoint + filter, { signal: abort.signal })
      .then((response) => readJson<{ observations: ReviewedObservation[] }>(response))
      .then((result) => {
        if (!abort.signal.aborted) setObservations(result.observations);
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Could not load observations.');
      })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [placeId, revision]);

  function selectPlace(selection: PlaceSummary | null) {
    if (selection?.id !== placeId) {
      setPlace(selection);
      setActionError('');
      setNotice('');
      refresh();
    }
  }

  function refresh() {
    setLoading(true);
    setLoadError('');
    setRevision((previous) => previous + 1);
  }

  async function apply(path: string, data: object, form: HTMLFormElement, status: string) {
    setActionError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await submitObservation(path, data);
      form.reset();
      const container = form.closest('details');
      if (container) container.open = false;
      setNotice(`${status} ${result.metric} for ${result.placeName}.`);
      refresh();
      onChange();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the observation.');
    } finally {
      setBusy(false);
    }
  }

  function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!placeId || busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    void apply('', {
      ...Object.fromEntries(data), placeId,
      commercialReuseConfirmed: data.has('commercialReuseConfirmed'),
      geographicMatchConfirmed: data.has('geographicMatchConfirmed'),
    }, form, 'Published');
  }

  function withdraw(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const reason = new FormData(form).get('reason');
    void apply(`/${encodeURIComponent(id)}/withdraw`, { reason }, form, 'Withdrew');
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="font-bold">Review locality evidence</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">Select the exact catalogue place to publish a measurement with its original source and geographic scope.</p>
      <fieldset disabled={busy}>
        <PlaceSearch key={placeId ?? 'all'} label="Find a place to review" onSelect={selectPlace} showRecordDetails />
        {place && (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <a className="font-semibold underline" href={`/localities/${encodeURIComponent(place.id)}`}>{place.name}</a>
            <span>{[place.district, place.region, place.pincode, place.kind === 'postal' ? 'Postal entry' : null].filter(Boolean).join(' · ')}</span>
            <span>{place.id} · {place.center.lat}, {place.center.lng}</span>
            <a className="underline" href={place.source.recordUrl} target="_blank" rel="noreferrer">Catalogue record</a>
            <button type="button" className="underline" onClick={() => selectPlace(null)}>Clear selection</button>
          </div>
        )}
      </fieldset>
      {notice && <p role="status" className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{notice}</p>}
      {actionError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{actionError}</p>}
      {place && (
        <form key={place.id} onSubmit={publish}>
          <fieldset disabled={busy} className="grid gap-3 text-sm font-semibold sm:grid-cols-2">
            {fields.map(({ name, label, ...attributes }) => (
              <label key={name}>{label}
                <input {...attributes} name={name} required={name !== 'unit'} className={input} />
              </label>
            ))}
            <label>Category
              <select className={input} name="category" required defaultValue="">
                <option value="" disabled>Choose a category</option>
                {Object.entries(observationCategories).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">Limitations
              <textarea className={input} name="limitations" maxLength={600} rows={2} required />
            </label>
            <label className="flex items-start gap-2 font-normal sm:col-span-2">
              <input className="mt-1" type="checkbox" name="commercialReuseConfirmed" required />
              <span>I checked that the source permits commercial reuse and included the applicable terms.</span>
            </label>
            <label className="flex items-start gap-2 font-normal sm:col-span-2">
              <input className="mt-1" type="checkbox" name="geographicMatchConfirmed" required />
              <span>I checked the source geography against the selected place and described the scope and limits.</span>
            </label>
            <div className="sm:col-span-2"><button className={primary} type="submit">Publish observation</button></div>
          </fieldset>
        </form>
      )}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{place ? `Recent observations for ${place.name}` : 'Recent observations across India'}</h3>
        {loading && <p role="status" className="text-sm text-slate-500">Loading observations…</p>}
        {!loading && loadError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{loadError}{' '}
          <button className="underline" type="button" onClick={refresh}>Retry</button>
        </p>}
        {!loading && !loadError && (observations.length === 0
          ? <p className="text-sm text-slate-500">No reviewed observations.</p>
          : <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {observations.map((observation) => (
              <li key={observation.id} className="space-y-1 py-3 text-sm">
                <p className="font-semibold">{observation.metric} · {[observation.value, observation.unit].filter(Boolean).join(' ')}</p>
                <p className="text-slate-600 dark:text-slate-400">
                  <a className="underline" href={`/localities/${encodeURIComponent(observation.placeId)}`}>{observation.placeName}</a>
                  {' · '}{observation.observationDate} · {observation.geographicLevel} · {observation.status === 'published' ? 'Published' : 'Withdrawn'}
                </p>
                <p className="break-words">{observation.limitations}</p>
                <p className="flex flex-wrap gap-x-3 text-xs">
                  <a className="underline" href={observation.referenceUrl} target="_blank" rel="noreferrer">{observation.publisher}</a>
                  <a className="underline" href={observation.licenseUrl} target="_blank" rel="noreferrer">Licence</a>
                </p>
                {observation.status === 'published' && (
                  <details>
                    <summary className="w-fit cursor-pointer text-xs font-semibold text-rose-700 dark:text-rose-400">Withdraw</summary>
                    <form className="mt-2 max-w-lg space-y-2" onSubmit={(event) => withdraw(event, observation.id)}>
                      <fieldset disabled={busy} className="space-y-2">
                        <label className="block text-xs font-semibold">Withdrawal reason for the audit log
                          <textarea name="reason" maxLength={400} className={input} rows={2} required />
                        </label>
                        <button type="submit" className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold disabled:opacity-60 dark:border-slate-700">Withdraw observation</button>
                      </fieldset>
                    </form>
                  </details>
                )}
              </li>
            ))}
          </ul>)}
      </div>
    </section>
  );
}
