import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { pool } from '../src/db';
import type { Locality } from '../src/types';
import { resolveAccount, spendDailyQuota } from './accounts';
import { requireSignedIn, session } from './auth';
import { getSandboxTier } from './billing';
import { findPlace, getPublicLocality } from './geography';
import { HttpError, route, validText } from './http';
import { renderEvidenceCsv } from './reports';

export const workspaceRoutes = Router();
workspaceRoutes.use(requireSignedIn);
type WorkspaceRole = 'owner' | 'editor' | 'viewer';

async function access(userId: number, workspaceId: string, roles: WorkspaceRole[]) {
  const { rows: [workspace] } = await pool.query<{ id: string; name: string; role: WorkspaceRole }>(`
    SELECT w.id, w.name, m.role FROM research_workspaces w JOIN research_members m ON m.workspace_id = w.id
    WHERE w.id::text = $1 AND m.user_id = $2
  `, [workspaceId, userId]);
  if (!workspace) throw new HttpError(404, 'Workspace unavailable.');
  if (!roles.includes(workspace.role)) throw new HttpError(403, 'This action requires a different workspace role.');
  return workspace;
}

const readRoles: WorkspaceRole[] = ['owner', 'editor', 'viewer'];
const digest = (token: string) => createHash('sha256').update(token).digest('hex');

workspaceRoutes.get('/', route(async (_req, res) => {
  const identity = session(res);
  const { id } = await resolveAccount(identity);
  const [workspaces, tier] = await Promise.all([
    pool.query(`
      SELECT w.id, w.name, m.role FROM research_workspaces w JOIN research_members m ON m.workspace_id = w.id
      WHERE m.user_id = $1 ORDER BY w.created_at DESC LIMIT 100
    `, [id]),
    getSandboxTier(id),
  ]);
  res.json({ workspaces: workspaces.rows, canCreate: identity.admin || identity.professional || tier === 'professional' });
}));

workspaceRoutes.post('/', route(async (req, res) => {
  const { name } = req.body ?? {};
  if (!validText(name, 1, 100)) throw new HttpError(400, 'Enter a workspace name.');
  const identity = session(res);
  const { id: userId } = await resolveAccount(identity);
  if (!identity.admin && !identity.professional && await getSandboxTier(userId) !== 'professional') {
    throw new HttpError(403, 'Workspace creation requires Professional access.');
  }
  await spendDailyQuota(userId, 'create_workspace', 3);
  const id = randomUUID();
  await pool.query(`
    WITH workspace AS (
      INSERT INTO research_workspaces (id, name) VALUES ($1, $2) RETURNING id
    )
    INSERT INTO research_members (workspace_id, user_id, role) SELECT id, $3, 'owner' FROM workspace
  `, [id, name.trim(), userId]);
  res.status(201).json({ id, name: name.trim(), role: 'owner' });
}));

workspaceRoutes.get('/:id', route(async (req, res) => {
  const { id } = await resolveAccount(session(res));
  const workspace = await access(id, req.params.id, readRoles);
  const { rows } = await pool.query(`
    SELECT id, name, place_ids AS "placeIds", created_at AS "createdAt"
    FROM research_projects WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100
  `, [workspace.id]);
  res.json({ ...workspace, projects: rows });
}));

workspaceRoutes.post('/:id/projects', route(async (req, res) => {
  const { name, placeIds } = req.body ?? {};
  if (!validText(name, 1, 120) || !Array.isArray(placeIds) || placeIds.length < 2 || placeIds.length > 5 ||
      !placeIds.every((id) => validText(id, 1, 48))) throw new HttpError(400, 'Choose a project name and two to five places.');
  const { id } = await resolveAccount(session(res));
  const workspace = await access(id, req.params.id, ['owner', 'editor']);
  const places = await Promise.all(placeIds.map((placeId) => findPlace(placeId)));
  const ids = places.flatMap((place) => place ? [place.id] : []);
  if (new Set(ids).size !== placeIds.length) throw new HttpError(400, 'Choose distinct, available places.');
  await spendDailyQuota(id, 'workspace_project', 20);
  const { rows: [project] } = await pool.query(`
    INSERT INTO research_projects (id, workspace_id, name, place_ids)
    VALUES ($1, $2, $3, $4) RETURNING id, name, place_ids AS "placeIds", created_at AS "createdAt"
  `, [randomUUID(), workspace.id, name.trim(), ids]);
  res.status(201).json(project);
}));

workspaceRoutes.get('/:id/projects/:projectId/export.csv', route(async (req, res) => {
  const { id } = await resolveAccount(session(res));
  const workspace = await access(id, req.params.id, readRoles);
  const { rows: [project] } = await pool.query<{ place_ids: string[] }>(`
    SELECT place_ids FROM research_projects WHERE workspace_id = $1 AND id::text = $2
  `, [workspace.id, req.params.projectId]);
  if (!project) throw new HttpError(404, 'Project unavailable.');
  const localities = await Promise.all(project.place_ids.map((placeId) => getPublicLocality(placeId)));
  if (localities.some((locality) => !locality)) throw new HttpError(409, 'One or more project places are unavailable in the active catalogue.');
  res.attachment('areawise-project-evidence.csv').send(renderEvidenceCsv(localities.filter((place): place is Locality => place !== null)));
}));

workspaceRoutes.post('/:id/invites', route(async (req, res) => {
  const { role } = req.body ?? {};
  if (role !== 'editor' && role !== 'viewer') throw new HttpError(400, 'Choose an invitation role.');
  const { id } = await resolveAccount(session(res));
  const workspace = await access(id, req.params.id, ['owner']);
  await spendDailyQuota(id, 'workspace_invite', 15);
  const token = randomBytes(32).toString('base64url');
  const { rows: [invite] } = await pool.query<{ expires_at: Date }>(`
    INSERT INTO research_invites (token_sha256, workspace_id, role, expires_at)
    VALUES ($1, $2, $3, now() + interval '2 days') RETURNING expires_at
  `, [digest(token), workspace.id, role]);
  res.status(201).json({ token, expiresAt: invite.expires_at });
}));

workspaceRoutes.post('/accept-invite', route(async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{43}$/.test(token)) throw new HttpError(400, 'Invalid invitation.');
  const { id } = await resolveAccount(session(res));
  const { rows: [joined] } = await pool.query<{ workspace_id: string }>(`
    WITH accepted AS (
      UPDATE research_invites SET accepted_at = now()
      WHERE token_sha256 = $1 AND accepted_at IS NULL AND expires_at > now()
      RETURNING workspace_id, role
    ), member AS (
      INSERT INTO research_members (workspace_id, user_id, role) SELECT workspace_id, $2, role FROM accepted
      ON CONFLICT DO NOTHING
    )
    SELECT workspace_id FROM accepted
  `, [digest(token), id]);
  if (!joined) throw new HttpError(404, 'Invitation is invalid, expired or already used.');
  res.json({ workspaceId: joined.workspace_id });
}));
