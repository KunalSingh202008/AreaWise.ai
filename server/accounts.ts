import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../src/db';
import { requireSignedIn, session, type Session } from './auth';
import { HttpError, route, validText } from './http';
import { findPlace, registerCatalogueLocality } from './geography';
import { getCommunityReportsFromDb } from '../src/db/repositories/communityReportRepository';

interface AccountRow {
  id: number;
  locale: string;
  preferred_profile: string;
}

export async function resolveAccount(identity: Session) {
  const { rows: [account] } = await pool.query<AccountRow>(`
    INSERT INTO users (uid, email, display_name, role)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (uid) DO UPDATE SET email = excluded.email, display_name = excluded.display_name,
      role = excluded.role, updated_at = now()
    RETURNING id, locale, preferred_profile
  `, [identity.uid, identity.email, identity.name, identity.admin ? 'admin' : identity.professional ? 'professional' : 'citizen']);
  return account;
}

export async function spendDailyQuota(userId: number, operation: string, limit: number) {
  const result = await pool.query(`
    INSERT INTO account_usage_daily (user_id, usage_day, operation, used)
    VALUES ($1, (now() AT TIME ZONE 'UTC')::date, $2, 1)
    ON CONFLICT (user_id, usage_day, operation) DO UPDATE
    SET used = account_usage_daily.used + 1
    WHERE account_usage_daily.used < $3
    RETURNING used
  `, [userId, operation, limit]);
  if (!result.rowCount) throw new HttpError(429, 'Daily usage limit reached. Try again tomorrow.');
}

export const accountRoutes = Router();
accountRoutes.use(requireSignedIn);

accountRoutes.get('/', route(async (_req, res) => {
  const account = await resolveAccount(session(res));
  const [saved, comparisons] = await Promise.all([
    pool.query<{ locality_id: string }>(`
      SELECT DISTINCT locality_id FROM saved_localities WHERE user_id = $1 ORDER BY locality_id LIMIT 250
    `, [account.id]),
    pool.query(`
      SELECT id, title, place_ids AS "placeIds", saved_at AS "savedAt"
      FROM account_comparisons WHERE user_id = $1 ORDER BY saved_at DESC LIMIT 100
    `, [account.id]),
  ]);
  res.json({
    savedLocalityIds: saved.rows.map((item) => item.locality_id),
    language: account.locale,
    preferredProfile: account.preferred_profile,
    comparisons: comparisons.rows,
  });
}));

accountRoutes.patch('/preferences', route(async (req, res) => {
  const { language, preferredProfile } = req.body ?? {};
  if ((language !== undefined && !['en', 'hi', 'hinglish'].includes(language)) ||
      (preferredProfile !== undefined && !['family', 'student', 'commuter', 'investor'].includes(preferredProfile)) ||
      (language === undefined && preferredProfile === undefined)) {
    throw new HttpError(400, 'Choose a supported language or research profile.');
  }
  const { id } = await resolveAccount(session(res));
  await pool.query(`
    UPDATE users SET locale = COALESCE($2, locale), preferred_profile = COALESCE($3, preferred_profile), updated_at = now() WHERE id = $1
  `, [id, language ?? null, preferredProfile ?? null]);
  res.sendStatus(204);
}));

accountRoutes.put('/saved/:id', route(async (req, res) => {
  const place = await findPlace(req.params.id);
  if (!place) throw new HttpError(404, 'Place unavailable.');
  const { id } = await resolveAccount(session(res));
  await registerCatalogueLocality(place);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id]);
    const saved = await client.query(`
      SELECT count(*)::int AS count, bool_or(locality_id = $2) AS exists
      FROM saved_localities WHERE user_id = $1
    `, [id, place.id]);
    if (!saved.rows[0].exists) {
      if (saved.rows[0].count >= 250) throw new HttpError(409, 'Saved place limit reached.');
      await client.query('INSERT INTO saved_localities (user_id, locality_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, place.id]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  res.sendStatus(204);
}));

accountRoutes.delete('/saved/:id', route(async (req, res) => {
  const { id } = await resolveAccount(session(res));
  await pool.query('DELETE FROM saved_localities WHERE user_id = $1 AND locality_id = $2', [id, req.params.id]);
  res.sendStatus(204);
}));

accountRoutes.get('/reports', route(async (_req, res) => {
  const { id } = await resolveAccount(session(res));
  res.json({ reports: await getCommunityReportsFromDb({ authorUserId: id }) });
}));

accountRoutes.post('/comparisons', route(async (req, res) => {
  const { title, placeIds } = req.body ?? {};
  if (!validText(title, 1, 120) || !Array.isArray(placeIds) || placeIds.length < 2 || placeIds.length > 5 ||
      !placeIds.every((id) => validText(id, 1, 48))) throw new HttpError(400, 'Enter a title and select two to five places.');
  const places = await Promise.all(placeIds.map((id) => findPlace(id)));
  const ids = places.flatMap((place) => place ? [place.id] : []);
  if (new Set(ids).size !== placeIds.length) throw new HttpError(400, 'Each selected place must be distinct and available.');
  const account = await resolveAccount(session(res));
  await spendDailyQuota(account.id, 'save_comparison', 20);
  const { rows: [comparison] } = await pool.query(`
    INSERT INTO account_comparisons (id, user_id, title, place_ids)
    VALUES ($1, $2, $3, $4) RETURNING id, title, place_ids AS "placeIds", saved_at AS "savedAt"
  `, [randomUUID(), account.id, title.trim(), ids]);
  res.status(201).json(comparison);
}));

accountRoutes.delete('/comparisons/:id', route(async (req, res) => {
  if (!/^[a-f0-9-]{36}$/.test(req.params.id)) throw new HttpError(404, 'Comparison not found.');
  const account = await resolveAccount(session(res));
  const removed = await pool.query('DELETE FROM account_comparisons WHERE user_id = $1 AND id::text = $2', [account.id, req.params.id]);
  if (!removed.rowCount) throw new HttpError(404, 'Comparison not found.');
  res.sendStatus(204);
}));

accountRoutes.get('/saved', route(async (_req, res) => {
  const { id } = await resolveAccount(session(res));
  const { rows } = await pool.query(`
    SELECT DISTINCT l.id, l.name, c.state AS region
    FROM saved_localities s JOIN localities l ON l.id = s.locality_id
    JOIN cities c ON c.id = l.city_id
    WHERE s.user_id = $1
    ORDER BY l.name, l.id
    LIMIT 250
  `, [id]);
  res.json({ places: rows });
}));
