import type { Locality } from '../../types';

export function PlaceProvenance({ locality }: { locality: Locality }) {
  const place = locality.geography;
  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-4 text-sm dark:border-slate-800" aria-label="Evidence and provenance">
      <h2 className="font-bold">Evidence and provenance</h2>
      {place && (
        <div className="space-y-1">
          <p>
            <a href={place.source.recordUrl} target="_blank" rel="noreferrer" className="font-semibold underline">{place.source.publisher} record</a>
            {' · '}
            <a href={place.source.licenseUrl} target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a>
          </p>
          <p className="text-xs opacity-75">
            Snapshot imported {place.source.importedAt.slice(0, 10)}
            {place.source.recordModifiedOn && ` · Publisher record edited ${place.source.recordModifiedOn}`}
          </p>
          <p className="text-xs opacity-75">
            Coordinates {place.center.lat.toFixed(5)}, {place.center.lng.toFixed(5)}.
            {place.kind === 'postal' ? ' The postal point is approximate.' : ' The source supplies a point location.'}
          </p>
        </div>
      )}
      {locality.observations?.length ? (
        <ul className="space-y-3">
          {locality.observations.map((observation) => (
            <li className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60" key={observation.id}>
              <p className="font-semibold">{observation.metric} · {observation.value} {observation.unit}</p>
              <p className="text-xs opacity-80">
                {observation.geographicLevel} · Observed {observation.observationDate}
                {' · '}<a href={observation.referenceUrl} target="_blank" rel="noreferrer" className="underline">{observation.publisher}</a>
                {' · '}<a href={observation.licenseUrl} target="_blank" rel="noreferrer" className="underline">Licence</a>
              </p>
              {observation.limitations && <p className="mt-1 text-xs">{observation.limitations}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs opacity-75">Reviewed locality measurements are unavailable for this place.</p>
      )}
    </section>
  );
}
