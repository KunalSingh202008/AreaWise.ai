import type { Locality } from '../src/types';

const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function html(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => entities[character]);
}

function link(url: string, label: string) {
  return /^https:\/\//i.test(url) ? `<a href="${html(url)}">${html(label)}</a>` : html(label);
}

export function renderEvidenceBrief(locality: Locality, generatedAt = new Date()): string {
  const place = locality.geography;
  const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'long', timeZone: 'Asia/Kolkata' }).format(generatedAt);
  const where = [place?.district, place?.region, place?.pincode && `PIN ${place.pincode}`].filter(Boolean).join(' · ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(locality.name)} Evidence Brief | AreaWise AI</title>
<style>
  @page { size: A4; margin: 17mm; }
  body { box-sizing: border-box; margin: 2rem auto; padding: 0 1.25rem; max-width: 50rem; color: #172b2b; font: 14px/1.55 system-ui, sans-serif; }
  header { border-bottom: 2px solid #087852; padding-bottom: 1rem; }
  h1 { font-size: 2.25rem; line-height: 1.1; margin: .5rem 0; }
  h2 { font-size: 1.12rem; margin: 1.4rem 0 .5rem; }
  a { color: #076549; }
  p { margin: .35rem 0; }
  small { color: #425951; overflow-wrap: anywhere; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: .45rem; border-bottom: 1px solid #b8c9c4; vertical-align: top; }
  th { font-size: .85em; }
  tr { break-inside: avoid; }
  @media print { body { margin: 0; padding: 0; } }
</style>
</head>
<body>
<header>
  <p><strong>AreaWise AI · Locality evidence brief</strong></p>
  <h1>${html(locality.name)}</h1>
  <p>${html(where || 'Selected geographic point')}</p>
  <small>Prepared ${html(date)} · Methodology ${html(locality.scores.methodologyVersion)}</small>
</header>
<section>
  <h2>Coverage</h2>
  <p>AreaScore <strong>${html(locality.scores.overallScore ?? 'Withheld')}</strong> · Score evidence coverage ${html(locality.scores.coverageScore)}%</p>
  <p>Coordinates ${locality.center.lat.toFixed(5)}, ${locality.center.lng.toFixed(5)}${place?.kind === 'postal' ? ' · Approximate postal location' : ''}</p>
  ${place ? `<p>${link(place.source.recordUrl, place.source.publisher)} · ${link(place.source.licenseUrl, 'Licence')} · Imported ${html(place.source.importedAt.slice(0, 10))}</p>
  <small>Source snapshot SHA-256 ${html(place.source.snapshotSha256)}</small>` : ''}
</section>
<section>
  <h2>Reviewed observations</h2>
  ${locality.observations?.length ? `<table><thead><tr><th scope="col">Measurement</th><th scope="col">Date and scope</th><th scope="col">Source and limits</th></tr></thead><tbody>${
    locality.observations.map((observation) => `<tr><td>${html(observation.metric)} · ${html(observation.value)} ${html(observation.unit)}</td>
    <td>${html(observation.observationDate)} · ${html(observation.geographicLevel)}</td>
    <td>${link(observation.referenceUrl, observation.publisher)} · ${link(observation.licenseUrl, 'Licence')}<br>${html(observation.limitations)}</td></tr>`).join('')
  }</tbody></table>` : '<p>Reviewed locality measurements are unavailable for this place.</p>'}
</section>
<section>
  <h2>Nearby catalogue facilities</h2>
  <p>Distances are measured in a straight line. Current service details are unverified.</p>
  ${locality.facilities.length ? `<table><thead><tr><th scope="col">Facility</th><th scope="col">Distance</th><th scope="col">Source</th></tr></thead><tbody>${
    locality.facilities.slice(0, 20).map((point) => `<tr><td>${html(point.name)} · ${html(point.category)}</td><td>${point.distanceMeters} m</td><td>${point.sourceUrl ? link(point.sourceUrl, point.source) : html(point.source)}</td></tr>`).join('')
  }</tbody></table>` : '<p>The catalogue returned no facilities in this search.</p>'}
</section>
<section>
  <h2>Evidence limitations</h2>
  <ul>${locality.missingDataNotes.map((note) => `<li>${html(note)}</li>`).join('')}</ul>
</section>
</body></html>`;
}

export function csvRow(values: (string | number | null | undefined)[]) {
  return values.map((value) => {
    let text = String(value ?? '');
    if (typeof value !== 'number' && /^[\s]*[=+\-@\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  }).join(',');
}

export function renderEvidenceCsv(localities: Locality[]) {
  const rows = [csvRow(['Place ID', 'Place', 'Type', 'Measurement', 'Value', 'Unit', 'Scope', 'Observation or edit date', 'Publisher', 'Reference URL', 'Licence URL', 'Snapshot SHA256', 'Limitations'])];
  for (const locality of localities) {
    const source = locality.geography?.source;
    rows.push(csvRow([
      locality.id, locality.name, 'catalogue', 'Coordinates', `${locality.center.lat}, ${locality.center.lng}`,
      'degrees', locality.geography?.kind, source?.recordModifiedOn, source?.publisher,
      source?.recordUrl, source?.licenseUrl, source?.snapshotSha256, locality.missingDataNotes.join(' '),
    ]));
    for (const observation of locality.observations ?? []) {
      rows.push(csvRow([
        locality.id, locality.name, 'reviewed observation', observation.metric, observation.value, observation.unit,
        observation.geographicLevel, observation.observationDate, observation.publisher, observation.referenceUrl,
        observation.licenseUrl, null, observation.limitations,
      ]));
    }
    for (const point of locality.facilities.slice(0, 25)) {
      rows.push(csvRow([
        locality.id, locality.name, 'facility catalogue point', point.name, point.distanceMeters, 'm', 'geodesic proximity',
        point.sourceRecordModifiedOn, point.source, point.sourceUrl, source?.licenseUrl, source?.snapshotSha256,
        'Straight-line distance. Current service details are unverified.',
      ]));
    }
  }
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}
