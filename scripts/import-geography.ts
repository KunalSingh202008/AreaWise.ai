import 'dotenv/config';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { pool } from '../src/db';
import { GEONAMES_DATASETS, GEONAMES_LICENSE, indexAdminName, parseGeoNamesRow, type GeoDataset, type ImportPlace } from '../server/geonames';
import type { PoolClient } from 'pg';

function lines(filename: string) {
  return createInterface({ input: createReadStream(filename, { encoding: 'utf8' }), crlfDelay: Infinity });
}

async function insertBatch(client: PoolClient, id: string, batch: ImportPlace[]) {
  const result = await client.query(`
    INSERT INTO geo_places (
      import_id, place_id, name, search_text, state, district, pincode, feature_code,
      facility_category, position, population, modified_on
    )
    SELECT $1, x.id, x.name, x.search, x.state, x.district, x.pincode, x.feature, x.category,
           ST_SetSRID(ST_MakePoint(x.lng, x.lat), 4326)::geography, x.population, x.modified
    FROM jsonb_to_recordset($2::jsonb) AS x(
      id text, name text, search text, state text, district text, pincode text, feature text,
      category text, lat float8, lng float8, population bigint, modified date
    )
    ON CONFLICT (import_id, place_id) DO NOTHING
  `, [id, JSON.stringify(batch)]);
  return result.rowCount ?? 0;
}

async function run() {
  const [kind, file, apply] = process.argv.slice(2);
  if ((kind !== 'gazetteer' && kind !== 'postal') || !file || apply !== '--apply' || !process.env.DATABASE_URL) {
    throw new Error('Usage: DATABASE_URL=... npm run data:geography -- gazetteer|postal /path/to/IN.txt --apply');
  }
  const dataset: GeoDataset = kind;
  const info = GEONAMES_DATASETS[dataset];
  const names = { states: new Map<string, string>(), districts: new Map<string, string>() };

  const digest = createHash('sha256');
  for await (const chunk of createReadStream(file)) digest.update(chunk);
  const hash = digest.digest('hex');
  const importId = `${info.id}-${hash}`;
  if (dataset === 'gazetteer') {
    for await (const line of lines(file)) indexAdminName(line, names);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL statement_timeout TO '120s'");
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [info.id]);
    const found = await client.query('SELECT row_count, active FROM dataset_imports WHERE id = $1', [importId]);
    if (found.rowCount) {
      await client.query('COMMIT');
      console.log(JSON.stringify({ dataset: info.id, importId, alreadyImported: true, ...found.rows[0] }));
      return;
    }

    await client.query(`
      INSERT INTO data_sources (id, name, organization, tier, update_frequency, is_verified, citation_url)
      VALUES ($1, $2, 'GeoNames', 'open_gazetteer', $3, false, $4)
      ON CONFLICT (id) DO NOTHING
    `, [info.id, info.title, dataset === 'gazetteer' ? 'Publisher offers daily extracts' : 'Publisher-managed', info.documentation]);
    await client.query(`
      INSERT INTO dataset_imports (id, dataset, source_id, original_url, license_url, content_sha256, row_count)
      VALUES ($1, $2, $2, $3, $4, $5, 1)
    `, [importId, info.id, info.url, GEONAMES_LICENSE, hash]);

    let batch: ImportPlace[] = [];
    let inserted = 0;
    let inputLines = 0;
    const storedDigest = createHash('sha256');
    const stream = createReadStream(file, { encoding: 'utf8' });
    stream.on('data', (chunk) => { storedDigest.update(chunk); });
    const records = createInterface({ input: stream, crlfDelay: Infinity });
    for await (const line of records) {
      inputLines++;
      const record = parseGeoNamesRow(line, dataset, names);
      if (!record) continue;
      batch.push(record);
      if (batch.length >= 2000) {
        inserted += await insertBatch(client, importId, batch);
        batch = [];
      }
    }
    if (batch.length) inserted += await insertBatch(client, importId, batch);
    if (storedDigest.digest('hex') !== hash) throw new Error('GeoNames source file changed during import.');
    if (!inserted) throw new Error('The input contains no eligible India geography records.');
    await client.query('UPDATE dataset_imports SET active = false WHERE dataset = $1 AND active', [info.id]);
    await client.query('UPDATE dataset_imports SET row_count = $2, active = true WHERE id = $1', [importId, inserted]);
    await client.query('COMMIT');
    console.log(JSON.stringify({ dataset: info.id, importId, inputLines, inserted, skipped: inputLines - inserted, source: info.url, sha256: hash }));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

try {
  await run();
} finally {
  await pool.end();
}
