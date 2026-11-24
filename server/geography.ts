import type { PoolClient } from 'pg';
import { pool } from '../src/db';
import type {
  CatalogueCoverage, Coordinates, CoverageCounts, Facility, GeographySource,
  Locality, LocalityCategoryScores, PlaceSummary, PublishedObservation,
} from '../src/types';
import { calculateAreaScore, calculateProfileScores } from './scoring';
import { postalRegionCorrectionsJson, regionNamesJson } from './india-regions';

interface PlaceRow {
  place_id: string;
  name: string;
  state: string | null;
  district: string | null;
  pincode: string | null;
  feature_code: string;
  lat: number;
  lng: number;
  modified_on: string | null;
  imported_at: Date;
  original_url: string;
  license_url: string;
  content_sha256: string;
}

const catalogueColumns = `
  p.place_id, p.name, p.state, p.district, p.pincode, p.feature_code,
  ST_Y(p.position::geometry) AS lat, ST_X(p.position::geometry) AS lng,
  p.modified_on::text, i.original_url, i.license_url, i.content_sha256, i.imported_at
`;

function recordUrl(id: string, original: string) {
  return id.startsWith('geo-') ? `https://www.geonames.org/${id.slice(4)}/` : original;
}

function mapPlace(row: PlaceRow): PlaceSummary {
  const source: GeographySource = {
    publisher: 'GeoNames',
    sourceUrl: row.original_url,
    recordUrl: recordUrl(row.place_id, row.original_url),
    licenseUrl: row.license_url,
    importedAt: row.imported_at.toISOString(),
    recordModifiedOn: row.modified_on,
    snapshotSha256: row.content_sha256,
  };
  return {
    id: row.place_id, name: row.name, region: row.state, district: row.district,
    pincode: row.pincode, center: { lat: row.lat, lng: row.lng },
    kind: row.feature_code === 'POSTAL' ? 'postal' : row.feature_code.startsWith('ADM') ? 'administrative' : 'place',
    source,
  };
}

export async function discoverPlaces(query: string, region: string) {
  const text = query.trim().normalize('NFKC').toLowerCase();
  const districtFilter = region.trim().normalize('NFKC').toLowerCase();
  if (!text && !districtFilter) {
    const result = await pool.query<PlaceRow>(`
      SELECT ${catalogueColumns}
      FROM geo_places p JOIN dataset_imports i ON i.id = p.import_id AND i.active
      WHERE p.feature_code IN ('PPLC', 'PPLA')
      ORDER BY p.population DESC, p.place_id
      LIMIT 8
    `);
    return result.rows.map(mapPlace);
  }
  if (text && text.length < 2) return [];

  const literal = (value: string) => '%' + value.replace(/[\\%_]/g, '\\$&') + '%';
  const pin = /^[1-9]\d{5}$/.test(text);
  const where = pin ? 'p.pincode = $1' : 'p.search_text LIKE $1';
  const result = await pool.query<PlaceRow>(`
    SELECT ${catalogueColumns}
    FROM geo_places p JOIN dataset_imports i ON i.id = p.import_id AND i.active
    WHERE p.facility_category IS NULL AND ${where}
      AND ($2::text IS NULL OR lower(p.state) LIKE $2 OR lower(p.district) LIKE $2)
    ORDER BY (lower(p.name) = $3) DESC, (p.pincode IS NOT NULL), p.population DESC, p.name, p.place_id
    LIMIT 25
  `, [pin ? text : literal(text), districtFilter ? literal(districtFilter) : null, text]);
  return result.rows.map(mapPlace);
}

export async function findPlace(id: string, db: Pick<PoolClient, 'query'> = pool): Promise<PlaceSummary | null> {
  // Keep the historical Sigra link using the corresponding GeoNames neighbourhood record.
  const canonical = id.toLowerCase() === 'sigra' ? 'geo-10546713' : id.toLowerCase();
  if (!/^(geo-\d{1,12}|pin-[a-f0-9]{24})$/.test(canonical)) return null;
  const { rows: [row] } = await db.query<PlaceRow>(`
    SELECT ${catalogueColumns}
    FROM geo_places p JOIN dataset_imports i ON i.id = p.import_id AND i.active
    WHERE p.place_id = $1 AND p.facility_category IS NULL
  `, [canonical]);
  return row ? mapPlace(row) : null;
}

export async function getNearbyCatalogueFacilities(
  center: Coordinates, radius: number, category?: string,
): Promise<Facility[]> {
  const { rows } = await pool.query<PlaceRow & { facility_category: Facility['category']; distance: number }>(`
    SELECT ${catalogueColumns}, p.facility_category,
      ROUND(ST_Distance(p.position, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography))::int AS distance
    FROM geo_places p JOIN dataset_imports i ON i.id = p.import_id AND i.active
    WHERE p.facility_category IS NOT NULL
      AND ($4::text IS NULL OR p.facility_category = $4)
      AND ST_DWithin(p.position, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
    ORDER BY distance, p.place_id
    LIMIT 100
  `, [center.lng, center.lat, radius, category === 'all' ? null : category ?? null]);

  return rows.map((row) => ({
    id: row.place_id, name: row.name, category: row.facility_category,
    subcategory: row.facility_category, lat: row.lat, lng: row.lng, distanceMeters: row.distance,
    address: [row.district, row.state].filter(Boolean).join(', '),
    source: 'GeoNames', sourceUrl: recordUrl(row.place_id, row.original_url),
    sourceRecordModifiedOn: row.modified_on, verificationStatus: 'unverified', lastVerifiedDate: null,
  }));
}

export async function getPublishedObservations(placeId: string): Promise<PublishedObservation[]> {
  const { rows } = await pool.query<PublishedObservation>(`
    SELECT e.id, e.metric_label AS metric, e.metric_value AS value, e.metric_unit AS unit, e.category,
      e.observation_date::text AS "observationDate", s.organization AS publisher,
      p.reference_url AS "referenceUrl", p.license_url AS "licenseUrl",
      p.geographic_level AS "geographicLevel", p.limitations
    FROM evidence_records e
    JOIN evidence_publications p ON p.evidence_id = e.id
    JOIN data_sources s ON s.id = e.source_id
    WHERE e.locality_id = $1 AND e.verification_status = 'verified'
    ORDER BY e.observation_date DESC, e.id
    LIMIT 100
  `, [placeId]);
  return rows;
}

const unavailableScores: LocalityCategoryScores = {
  connectivity: null, healthcare: null, education: null, environment: null,
  civicInfrastructure: null, dailyAmenities: null, propertyMarketTransparency: null,
};

export async function getPublicLocality(id: string, includeFacilities = true): Promise<Locality | null> {
  const place = await findPlace(id);
  if (!place) return null;
  const [observations, facilities] = await Promise.all([
    getPublishedObservations(place.id),
    includeFacilities ? getNearbyCatalogueFacilities(place.center, 5000) : [],
  ]);
  return {
    id: place.id, name: place.name, city: place.district ?? '', state: place.region ?? '',
    pincode: place.pincode, center: place.center, bounds: [], previewImage: null,
    tagline: place.kind === 'postal' ? 'Postal index' : 'Geographic catalogue',
    description: place.kind === 'postal'
      ? 'GeoNames lists this postal entry. Its map point is approximate.'
      : 'This location is indexed by GeoNames. Map points represent source coordinates.',
    scores: calculateAreaScore(unavailableScores, { indicators: [] }),
    profileScores: calculateProfileScores(unavailableScores),
    strengths: [], cautions: [], indicators: [], facilities, geography: place, observations,
    missingDataNotes: [
      'Published geographic coordinates and catalogued facilities do not qualify as a locality score.',
      ...(observations.length ? [] : ['No reviewed locality measurements are available.']),
      'Facility listings may be incomplete. Distances are straight-line measurements.',
    ],
  };
}

export async function inspectCoordinate(center: Coordinates, label?: string): Promise<Locality> {
  const facilities = await getNearbyCatalogueFacilities(center, 5000);
  return {
    id: `point-${center.lat.toFixed(6)}_${center.lng.toFixed(6)}`,
    name: label?.trim() || 'Selected coordinates', city: '', state: '', pincode: null,
    center, bounds: [], previewImage: null, tagline: 'Coordinate lookup',
    description: 'Nearby points come from the current GeoNames catalogue.',
    scores: calculateAreaScore(unavailableScores, { indicators: [] }),
    profileScores: calculateProfileScores(unavailableScores),
    strengths: [], cautions: [], indicators: [], facilities, isCustomResolved: true,
    missingDataNotes: ['No locality boundary or AreaScore has been assigned to this point.'],
  };
}

export async function getCatalogueCoverage(region: string | null): Promise<CatalogueCoverage> {
  const state = 'COALESCE(postal_region.region, region_names.region)';
  const group = region === null ? state : 'p.district';
  const results = await Promise.all([
    pool.query<CoverageCounts & { name: string | null; is_total: boolean }>(`
      WITH evidence_by_place AS (
        SELECT e.locality_id, count(*)::int AS observations, max(e.observation_date) AS observation_date
        FROM evidence_records e JOIN evidence_publications ep ON ep.evidence_id = e.id
        WHERE e.verification_status = 'verified'
        GROUP BY e.locality_id
      )
      SELECT ${group} AS name, GROUPING(${group}) = 1 AS is_total,
        count(*) FILTER (WHERE p.facility_category IS NULL AND p.pincode IS NULL)::int AS places,
        count(p.pincode)::int AS "postalEntries",
        count(DISTINCT p.pincode)::int AS pincodes,
        count(p.facility_category)::int AS facilities,
        count(e.locality_id)::int AS "reviewedPlaces",
        COALESCE(sum(e.observations), 0)::int AS observations,
        max(e.observation_date)::text AS "lastObservationDate"
      FROM geo_places p JOIN dataset_imports i ON i.id = p.import_id AND i.active
      LEFT JOIN jsonb_each_text($2::jsonb) AS region_names(source_state, region)
        ON p.state = region_names.source_state
      LEFT JOIN jsonb_to_recordset($3::jsonb) AS postal_region(source_state text, source_district text, region text)
        ON p.pincode IS NOT NULL AND p.state = postal_region.source_state AND p.district = postal_region.source_district
      LEFT JOIN evidence_by_place e ON e.locality_id = p.place_id AND p.facility_category IS NULL
      WHERE $1::text IS NULL OR ${state} = $1
      GROUP BY GROUPING SETS ((), (${group}))
      ORDER BY is_total DESC, name NULLS LAST
    `, [region, regionNamesJson, postalRegionCorrectionsJson]),
    pool.query<CatalogueCoverage['sources'][number]>(`
      SELECT s.name, i.original_url AS "sourceUrl", i.license_url AS "licenseUrl", i.imported_at AS "importedAt"
      FROM dataset_imports i JOIN data_sources s ON s.id = i.source_id
      WHERE i.active
      ORDER BY i.dataset
    `),
  ]);
  const [{ is_total: _isTotal, name: _totalName, ...totals }, ...areaRows] = results[0].rows;
  const areas = areaRows.map(({ is_total: _isAreaTotal, ...area }) => area);
  return { region, totals, areas, sources: results[1].rows };
}

export async function getGeographyImports() {
  const { rows } = await pool.query(`
    SELECT i.id, i.dataset, s.name, s.organization AS publisher, i.original_url AS "sourceUrl",
      i.license_url AS "licenseUrl", i.imported_at AS "importedAt",
      i.row_count AS "rowCount", i.content_sha256 AS sha256, i.active
    FROM dataset_imports i JOIN data_sources s ON s.id = i.source_id
    ORDER BY i.imported_at DESC
    LIMIT 50
  `);
  return rows;
}

// Register a source-backed catalogue point when an account first needs a foreign key.
export async function ensureCatalogueLocality(client: PoolClient, place: PlaceSummary) {
  const cityId = 'catalogue-' + place.id;
  await client.query(`
    INSERT INTO cities (id, name, state, center_lat, center_lng, center_geom)
    VALUES ($1, $2, $3, $4::float8, $5::float8, ST_SetSRID(ST_MakePoint($5::float8, $4::float8), 4326))
    ON CONFLICT (id) DO NOTHING
  `, [cityId, place.name, place.region ?? '', place.center.lat, place.center.lng]);
  await client.query(`
    INSERT INTO localities (id, city_id, name, pincode, tagline, description, center_lat, center_lng, center_geom)
    VALUES ($1, $2, $3, $4, 'GeoNames catalogue', 'Catalogue point', $5::float8, $6::float8, ST_SetSRID(ST_MakePoint($6::float8, $5::float8), 4326))
    ON CONFLICT (id) DO NOTHING
  `, [place.id, cityId, place.name, place.pincode ?? '', place.center.lat, place.center.lng]);
}

export async function registerCatalogueLocality(place: PlaceSummary) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await ensureCatalogueLocality(client, place);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
