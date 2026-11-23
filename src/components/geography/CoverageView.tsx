import { useEffect, useState } from 'react';
import { getJson } from '../../api';
import type { CatalogueCoverage, CoverageCounts } from '../../types';

const endpoint = '/api/v1/locations/coverage';
const count = new Intl.NumberFormat('en-IN');
const formatDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'Asia/Kolkata' });
const columns = [
  ['places', 'Place records'], ['postalEntries', 'Postal entries'], ['pincodes', 'Distinct PINs'],
  ['facilities', 'Facility points'], ['reviewedPlaces', 'Places with reviewed evidence'],
  ['observations', 'Reviewed observations'],
] as const satisfies [keyof CoverageCounts, string][];

type CoverageResult = { data: CatalogueCoverage; error?: never } | { error: string; data?: never };

function useCoverage(region: string) {
  const [result, setResult] = useState<(CoverageResult & { region: string }) | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const url = region ? `${endpoint}?${new URLSearchParams({ region })}` : endpoint;
    getJson<CatalogueCoverage>(url, controller.signal).then(
      (data) => { if (!controller.signal.aborted) setResult({ region, data }); },
      (error: unknown) => {
        if (!controller.signal.aborted) setResult({ region, error: error instanceof Error ? error.message : 'Coverage is unavailable.' });
      },
    );
    return () => controller.abort();
  }, [region]);
  return result?.region === region ? result : null;
}

function CountryCoverage({ country }: { country: CatalogueCoverage }) {
  const [region, setRegion] = useState('');
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {columns.map(([metric, label]) => (
          <div key={metric} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <dt className="text-sm text-slate-600 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 text-2xl font-bold tabular-nums">{count.format(country.totals[metric])}</dd>
          </div>
        ))}
      </dl>
      <section className="space-y-4">
        <h2 className="text-xl font-bold">State and district breakdown</h2>
        <label className="flex flex-wrap items-center gap-3 text-sm">
          State or union territory
          <select value={region} onChange={(event) => setRegion(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white p-2 dark:border-slate-600 dark:bg-slate-900">
            <option value="">All states and union territories</option>
            {country.areas.flatMap(({ name }) => name ? <option key={name} value={name}>{name}</option> : [])}
          </select>
        </label>
        {region ? <DistrictCoverage key={region} region={region} /> : <CoverageTable coverage={country} />}
      </section>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Active source snapshots</h2>
        <ul className="space-y-2 text-sm">
          {country.sources.map((source) => (
            <li key={source.sourceUrl}>
              <a href={source.sourceUrl} className="underline">{source.name}</a>
              {' · Imported '}{formatDate.format(new Date(source.importedAt))}
              {' · '}<a href={source.licenseUrl} className="underline">Licence</a>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function DistrictCoverage({ region }: { region: string }) {
  const result = useCoverage(region);
  if (!result) return <p role="status">Loading districts…</p>;
  return result.data ? <CoverageTable coverage={result.data} /> : <p role="alert">{result.error}</p>;
}

function CoverageTable({ coverage }: { coverage: CatalogueCoverage }) {
  const label = coverage.region ? 'Source district' : 'State or union territory';
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" role="region" aria-label={`${label} coverage`} tabIndex={0}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{coverage.region ? `District coverage in ${coverage.region}` : 'Coverage by state and union territory'}</caption>
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            <th scope="col" className="p-3">{label}</th>
            {columns.map(([metric, title]) => <th scope="col" key={metric} className="p-3 text-right">{title}</th>)}
            <th scope="col" className="p-3">Latest observation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {coverage.areas.map((area) => (
            <tr key={area.name ?? ''}>
              <th scope="row" className="p-3 font-medium">{area.name ?? 'Unassigned'}</th>
              {columns.map(([metric]) => <td key={metric} className="p-3 text-right tabular-nums">{count.format(area[metric])}</td>)}
              <td className="p-3 whitespace-nowrap">{area.lastObservationDate ?? 'Unavailable'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CoverageView() {
  const result = useCoverage('');
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-5 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-black">India data coverage</h1>
        <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
          Counts come from active source snapshots. State and union territory labels are matched to government names where possible. District labels follow the publisher. Reviewed observations are listed on individual place profiles. AreaScores require enough eligible indicator data.
        </p>
      </header>
      {!result && <p role="status">Loading data coverage…</p>}
      {result?.error && <p role="alert">{result.error}</p>}
      {result?.data && <CountryCoverage country={result.data} />}
    </div>
  );
}
