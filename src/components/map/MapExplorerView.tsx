import { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';
import type { CommunityReport, Facility, Locality } from '../../types';
import { getJson } from '../../api';
import { PlaceSearch } from '../geography/PlaceSearch';
import { InteractiveLocalityMap } from './InteractiveLocalityMap';

interface Props {
  locality: Locality;
  onSelectLocality: (id: string) => void;
}

export function MapExplorerView({ locality, onSelectLocality }: Props) {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [reports, setReports] = useState<CommunityReport[]>([]);
  const [reportsError, setReportsError] = useState(false);
  const id = locality.geography?.id;

  useEffect(() => {
    if (!id) return;
    const abort = new AbortController();
    const query = new URLSearchParams({ localityId: id });
    getJson<{ reports: CommunityReport[] }>('/api/v1/community/reports?' + query, abort.signal)
      .then((response) => { if (!abort.signal.aborted) setReports(response.reports); })
      .catch(() => { if (!abort.signal.aborted) setReportsError(true); });
    return () => abort.abort();
  }, [id]);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold sm:text-3xl">
          <Navigation aria-hidden className="h-6 w-6 text-emerald-600" /> Map explorer
        </h1>
        <PlaceSearch onSelect={(place) => onSelectLocality(place.id)} />
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {locality.name} · Facility points come from GeoNames. Distances are measured in a straight line.
        </p>
      </header>
      <InteractiveLocalityMap
        center={locality.center}
        bounds={locality.bounds}
        localityName={locality.name}
        facilities={locality.facilities}
        communityReports={reports}
        onSelectFacility={setFacility}
        className="h-[480px] w-full sm:h-[600px]"
      />
      {reportsError && <p role="status" className="text-xs text-slate-500">Community markers are temporarily unavailable.</p>}
      {facility ? (
        <section aria-label="Facility details" className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-bold">{facility.name}</h2>
            <button onClick={() => setFacility(null)} className="text-xs underline">Dismiss</button>
          </div>
          <p className="text-sm">{[facility.subcategory, facility.address, `${facility.distanceMeters} m from ${locality.name}`].filter(Boolean).join(' · ')}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {facility.sourceUrl ? <a href={facility.sourceUrl} className="underline" target="_blank" rel="noreferrer">{facility.source}</a> : facility.source}
            {facility.sourceRecordModifiedOn && ` · Publisher record edited ${facility.sourceRecordModifiedOn}`}
            {' · Current service details are unverified.'}
          </p>
        </section>
      ) : <p className="text-sm text-slate-600 dark:text-slate-400">Select a point to see its distance and source.</p>}
    </div>
  );
}
