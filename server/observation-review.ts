import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../src/db';
import { observationCategories, type ReviewedObservation } from '../src/types';
import { session } from './auth';
import { ensureCatalogueLocality, findPlace } from './geography';
import { HttpError, route, validText } from './http';

export const observationReviewRoutes = Router();

const reviewedObservations = `
  SELECT e.id, e.locality_id AS "placeId", l.name AS "placeName", e.category,
    e.metric_label AS metric, e.metric_value AS value, e.metric_unit AS unit,
    e.observation_date::text AS "observationDate", s.organization AS publisher,
    p.reference_url AS "referenceUrl", p.license_url AS "licenseUrl",
    p.geographic_level AS "geographicLevel", p.limitations, p.published_at AS "publishedAt",
    CASE WHEN e.verification_status = 'verified' THEN 'published' ELSE 'withdrawn' END AS status
  FROM evidence_publications p
  JOIN evidence_records e ON e.id = p.evidence_id
  JOIN data_sources s ON s.id = e.source_id
  JOIN localities l ON l.id = e.locality_id
`;

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const keyText = (value: string) => value.normalize('NFKC').toLowerCase();

function text(value: unknown, label: string, max: number) {
  if (!validText(value, 1, max)) throw new HttpError(400, `${label} is required and limited to ${max} characters.`);
  return value.trim();
}

function publicLink(value: unknown, label: string) {
  const input = text(value, label, 2048);
  let url: URL | undefined;
  try { url = new URL(input); } catch { /* The validation below handles malformed URLs. */ }
  if (!url || !/^https:\/\//i.test(input) || url.protocol !== 'https:' || url.username || url.password || url.port ||
      !url.hostname.includes('.') || isIP(url.hostname)) {
    throw new HttpError(400, `${label} must be a public HTTPS link.`);
  }
  return url.href;
}

function readSubmission(body: Record<string, unknown>) {
  const { category } = body;
  if (typeof category !== 'string' || !Object.hasOwn(observationCategories, category)) {
    throw new HttpError(400, 'Select an observation category.');
  }
  if (body.commercialReuseConfirmed !== true || body.geographicMatchConfirmed !== true) {
    throw new HttpError(400, 'Confirm commercial reuse permission and the geographic match.');
  }
  const observationDate = text(body.observationDate, 'Observation date', 10);
  const timestamp = Date.parse(observationDate + 'T00:00:00Z');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(observationDate) || !Number.isFinite(timestamp) ||
      new Date(timestamp).toISOString().slice(0, 10) !== observationDate || observationDate > today) {
    throw new HttpError(400, 'Enter a valid observation date on or before today in India.');
  }
  return {
    category, observationDate,
    metric: text(body.metric, 'Measurement name', 120),
    value: text(body.value, 'Reported value', 120),
    unit: body.unit === undefined || body.unit === '' ? null : text(body.unit, 'Unit', 40),
    publisher: text(body.publisher, 'Publisher', 150),
    referenceUrl: publicLink(body.referenceUrl, 'Evidence link'),
    licenseUrl: publicLink(body.licenseUrl, 'Licence link'),
    geographicLevel: text(body.geographicLevel, 'Geographic scope', 180),
    limitations: text(body.limitations, 'Limitations', 600),
  };
}

async function inTransaction<T>(action: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function observationById(client: PoolClient, id: string) {
  const { rows } = await client.query<ReviewedObservation>(`${reviewedObservations} WHERE e.id = $1`, [id]);
  return rows[0];
}

observationReviewRoutes.get('/', route(async (req, res) => {
  const { placeId } = req.query;
  let filter: string | null = null;
  if (placeId !== undefined) {
    const place = await findPlace(text(placeId, 'Place ID', 48));
    if (!place) throw new HttpError(404, 'This place is unavailable in the current catalogue.');
    filter = place.id;
  }
  const { rows } = await pool.query<ReviewedObservation>(`
    ${reviewedObservations}
    WHERE ($1::text IS NULL OR e.locality_id = $1)
    ORDER BY p.published_at DESC, e.id LIMIT 50
  `, [filter]);
  res.json({ observations: rows });
}));

observationReviewRoutes.post('/', route(async (req, res) => {
  const requestedId = text(req.body?.placeId, 'Place ID', 48);
  const submission = readSubmission(req.body);
  const actor = session(res).uid;
  const result = await inTransaction(async (client) => {
    const place = await findPlace(requestedId, client);
    if (!place) throw new HttpError(404, 'This place is unavailable in the current catalogue.');

    const id = 'reviewed-' + digest([place.id, submission]);
    const reviewKey = digest([
      place.id, submission.category, keyText(submission.metric), submission.observationDate,
      keyText(submission.publisher), submission.referenceUrl, keyText(submission.geographicLevel),
    ]);
    // Serialize decisions on the same source measurement across server processes.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [reviewKey]);
    const { rows: [previous] } = await client.query<{ id: string; verification_status: string }>(`
      SELECT id, verification_status FROM evidence_records
      WHERE id = $1 OR (locality_id = $2 AND verification_status = 'verified' AND raw_payload->>'reviewKey' = $3)
      ORDER BY (id = $1) DESC LIMIT 1 FOR UPDATE
    `, [id, place.id, reviewKey]);
    if (previous) {
      if (previous.id !== id) throw new HttpError(409, 'Withdraw the existing version before publishing a correction.');
      if (previous.verification_status !== 'verified') throw new HttpError(409, 'This exact version was withdrawn.');
      return { created: false, observation: await observationById(client, id) };
    }

    await ensureCatalogueLocality(client, place);
    const sourceId = 'reviewed-' + digest(submission.publisher);
    await client.query(`
      INSERT INTO data_sources (id, name, organization, tier, update_frequency, is_verified, citation_url)
      VALUES ($1, $2, $2, 'verified', 'Manual', true, $3)
      ON CONFLICT (id) DO NOTHING
    `, [sourceId, submission.publisher, submission.referenceUrl]);
    await client.query(`
      INSERT INTO evidence_records (id, locality_id, source_id, category, metric_label, metric_value,
        metric_unit, observation_date, raw_payload, verification_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'verified')
    `, [id, place.id, sourceId, submission.category, submission.metric, submission.value, submission.unit,
      submission.observationDate, { reviewKey, commercialReuseConfirmed: true, geographicMatchConfirmed: true }]);
    await client.query(`
      INSERT INTO evidence_publications (evidence_id, reference_url, license_url, geographic_level, limitations, published_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [id, submission.referenceUrl, submission.licenseUrl, submission.geographicLevel, submission.limitations, actor]);
    await client.query(`
      INSERT INTO audit_logs (action, actor, entity_type, entity_id, details)
      VALUES ('observation_published', $1, 'evidence', $2, $3)
    `, [actor, id, { placeId: place.id, observationDate: submission.observationDate }]);
    return { created: true, observation: await observationById(client, id) };
  });
  res.status(result.created ? 201 : 200).json(result.observation);
}));

observationReviewRoutes.post('/:id/withdraw', route(async (req, res) => {
  const id = text(req.params.id, 'Observation ID', 128);
  const reason = text(req.body?.reason, 'Withdrawal reason', 400);
  const actor = session(res).uid;
  const observation = await inTransaction(async (client) => {
    const result = await client.query<{ locality_id: string }>(`
      UPDATE evidence_records e SET verification_status = 'disputed'
      FROM evidence_publications p
      WHERE e.id = $1 AND p.evidence_id = e.id AND e.verification_status = 'verified'
      RETURNING e.locality_id
    `, [id]);
    const existing = await observationById(client, id);
    if (!existing) throw new HttpError(404, 'Observation unavailable.');
    if (result.rowCount) {
      await client.query(`
        INSERT INTO audit_logs (action, actor, entity_type, entity_id, details)
        VALUES ('observation_withdrawn', $1, 'evidence', $2, $3)
      `, [actor, id, { placeId: result.rows[0].locality_id, reason }]);
    }
    return existing;
  });
  res.json(observation);
}));
