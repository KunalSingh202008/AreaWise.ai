import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../src/db';
import type { Locality } from '../src/types';
import { isCopilotLanguage } from '../src/i18n/copilotLanguages';
import { askAreaWiseAI, isGeminiConfigured } from './ai';
import { resolveAccount } from './accounts';
import { requireSignedIn, session } from './auth';
import { HttpError, route, validText } from './http';
import { getPublicLocality } from './geography';
import { getSandboxTier } from './billing';

export const copilotRoutes = Router();

async function reserveModelCall(accountId: number, accountLimit: number) {
  const configured = Number(process.env.GEMINI_DAILY_REQUEST_LIMIT ?? 100);
  if (!Number.isInteger(configured) || configured < 1 || configured > 100000) {
    throw new HttpError(503, 'Live Copilot request budget is unavailable.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query(`
      INSERT INTO account_usage_daily VALUES ($1, (now() AT TIME ZONE 'UTC')::date, 'gemini', 1)
      ON CONFLICT (user_id, usage_day, operation) DO UPDATE SET used = account_usage_daily.used + 1
      WHERE account_usage_daily.used < $2 RETURNING used
    `, [accountId, accountLimit]);
    if (!account.rowCount) throw new HttpError(429, 'Your daily Copilot limit has been reached.');
    const global = await client.query(`
      INSERT INTO service_usage_daily VALUES ((now() AT TIME ZONE 'UTC')::date, 'gemini', 1)
      ON CONFLICT (usage_day, operation) DO UPDATE SET used = service_usage_daily.used + 1
      WHERE service_usage_daily.used < $1 RETURNING used
    `, [configured]);
    if (!global.rowCount) throw new HttpError(429, 'The daily Copilot service budget has been reached.');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

copilotRoutes.post('/ask', (req, res, next) => req.get('authorization') ? requireSignedIn(req, res, next) : next(),
  route(async (req, res) => {
    const { prompt, localityId, comparisonIds = [], language = 'en', recentQuestions = [],
      saveConversation = false, conversationId } = req.body ?? {};
    if (!validText(prompt, 1, 2500) || !isCopilotLanguage(language) || !Array.isArray(comparisonIds) ||
        comparisonIds.length > 5 || (localityId !== undefined && !validText(localityId, 1, 48)) ||
        !Array.isArray(recentQuestions) || recentQuestions.length > 4 ||
        !recentQuestions.every((question) => validText(question, 1, 2500)) ||
        typeof saveConversation !== 'boolean' ||
        (conversationId !== undefined && (!saveConversation || !/^[a-f0-9-]{36}$/.test(conversationId)))) {
      throw new HttpError(400, 'Enter a valid question, language and place selection.');
    }
    const rawIds = [...(localityId ? [localityId] : []), ...comparisonIds];
    const ids = [...new Set<string>(rawIds.map((id) => (typeof id === 'string' ? id.toLowerCase() : '')))];
    if (!ids.length || ids.length > 5 || !ids.every((id) => validText(id, 1, 48))) {
      throw new HttpError(400, 'Select one to five localities with catalogue records.');
    }
    const identity = session(res);
    if (saveConversation && !identity) throw new HttpError(401, 'Sign in to save a conversation.');

    const found = await Promise.all(ids.map((id) => getPublicLocality(id)));
    const byId = new Map(found.flatMap((place) => place ? [[place.id, place] as const] : []));
    const localities: Locality[] = [...byId.values()];
    if (found.some((place) => !place)) throw new HttpError(404, 'Evidence is unavailable for one or more selected places.');
    const scope = localities.map((place) => place.id);

    const account = identity && (isGeminiConfigured() || saveConversation) ? await resolveAccount(identity) : undefined;
    if (conversationId) {
      const previous = await pool.query(`
        SELECT 1 FROM ai_conversations WHERE id = $1 AND user_id = $2 AND comparison_ids = $3::jsonb
      `, [conversationId, account!.id, JSON.stringify(scope)]);
      if (!previous.rowCount) throw new HttpError(404, 'Conversation unavailable for these places.');
    }
    if (account && isGeminiConfigured()) {
      const tier = await getSandboxTier(account.id);
      await reserveModelCall(account.id, tier === 'professional' ? 100 : tier === 'premium' ? 50 : tier === 'plus' ? 25 : 10);
    }
    const result = await askAreaWiseAI({ prompt: prompt.trim(), language, localities, recentQuestions, allowProvider: !!account });

    if (saveConversation && account) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const id = conversationId ?? randomUUID();
        if (!conversationId) {
          await client.query(`
            INSERT INTO ai_conversations (id, user_id, comparison_ids, language) VALUES ($1, $2, $3::jsonb, $4)
          `, [id, account.id, JSON.stringify(scope), language]);
        } else {
          const locked = await client.query('SELECT id FROM ai_conversations WHERE id = $1 AND user_id = $2 FOR UPDATE', [id, account.id]);
          if (!locked.rowCount) throw new HttpError(404, 'Conversation unavailable.');
        }
        const size = await client.query<{ count: number }>('SELECT count(*)::int AS count FROM ai_messages WHERE conversation_id = $1', [id]);
        if (size.rows[0].count >= 80) throw new HttpError(409, 'This conversation has reached its saved message limit.');
        await client.query(`
          INSERT INTO ai_messages (conversation_id, role, content, citations, warning_note)
          VALUES ($1, 'user', $2, NULL, NULL), ($1, 'assistant', $3, $4::jsonb, $5)
        `, [id, prompt.trim(), result.answer || result.limitations.join('\n'), JSON.stringify(result.citations), result.mode]);
        await client.query('COMMIT');
        result.conversationId = id;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
    res.json(result);
  }),
);

copilotRoutes.get('/conversations', requireSignedIn, route(async (_req, res) => {
  const account = await resolveAccount(session(res));
  const { rows } = await pool.query(`
    SELECT c.id, c.comparison_ids AS "placeIds", c.created_at AS "createdAt",
      (SELECT left(m.content, 120) FROM ai_messages m WHERE m.conversation_id = c.id AND m.role = 'user' ORDER BY m.id LIMIT 1) AS title
    FROM ai_conversations c WHERE c.user_id = $1 ORDER BY c.created_at DESC LIMIT 50
  `, [account.id]);
  res.json({ conversations: rows });
}));

copilotRoutes.get('/conversations/:id', requireSignedIn, route(async (req, res) => {
  const account = await resolveAccount(session(res));
  const { rows: [conversation] } = await pool.query(`
    SELECT id, comparison_ids AS "placeIds" FROM ai_conversations WHERE id = $1 AND user_id = $2
  `, [req.params.id, account.id]);
  if (!conversation) throw new HttpError(404, 'Conversation unavailable.');
  const messages = await pool.query(`
    SELECT id, role, content, citations, warning_note AS mode
    FROM ai_messages WHERE conversation_id = $1 ORDER BY id LIMIT 80
  `, [conversation.id]);
  res.json({ ...conversation, messages: messages.rows });
}));

copilotRoutes.delete('/conversations/:id', requireSignedIn, route(async (req, res) => {
  const account = await resolveAccount(session(res));
  const result = await pool.query('DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2', [req.params.id, account.id]);
  if (!result.rowCount) throw new HttpError(404, 'Conversation unavailable.');
  res.sendStatus(204);
}));
