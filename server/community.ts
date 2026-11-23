import { Router } from 'express';
import { requireAdmin, requireSignedIn, session } from './auth';
import { resolveAccount, spendDailyQuota } from './accounts';
import { findPlace, registerCatalogueLocality } from './geography';
import { HttpError, route, validText } from './http';
import {
  confirmPublishedReport, createCommunityReportInDb, getCommunityReportsFromDb, moderateReportInDb,
} from '../src/db/repositories/communityReportRepository';

const categories = ['roads', 'drainage', 'water_supply', 'street_lighting', 'waste', 'air_noise'];
const statuses = ['under_review', 'verified', 'action_taken', 'rejected'];

export const communityRoutes = Router();

communityRoutes.get('/reports', route(async (req, res) => {
  const { localityId, category } = req.query;
  if ((localityId !== undefined && !validText(localityId, 1, 48)) ||
      (category !== undefined && (typeof category !== 'string' || !categories.includes(category)))) {
    throw new HttpError(400, 'Choose a valid place or report category.');
  }
  const place = typeof localityId === 'string' ? await findPlace(localityId) : null;
  const reports = localityId && !place ? [] : await getCommunityReportsFromDb({
    localityId: place?.id, category: category as string | undefined, published: true,
  });
  res.json({ total: reports.length, reports });
}));

communityRoutes.post('/reports', requireSignedIn, route(async (req, res) => {
  const { localityId, title, category, description } = req.body ?? {};
  if (!validText(localityId, 1, 48) || !validText(title, 5, 140) || !validText(description, 10, 2000) ||
      typeof category !== 'string' || !categories.includes(category)) {
    throw new HttpError(400, 'Enter a place, category, title and description.');
  }
  const place = await findPlace(localityId);
  if (!place) throw new HttpError(404, 'Place unavailable.');
  const identity = session(res);
  const account = await resolveAccount(identity);
  await spendDailyQuota(account.id, 'community_report', 5);
  await registerCatalogueLocality(place);
  const report = await createCommunityReportInDb({
    localityId: place.id, title, category, description, userId: account.id,
    lat: place.center.lat, lng: place.center.lng, submittedBy: 'Community member',
    actorUid: identity.uid,
  });
  res.status(201).json(report);
}));

communityRoutes.post('/reports/:id/vote', requireSignedIn, route(async (req, res) => {
  const account = await resolveAccount(session(res));
  const result = await confirmPublishedReport(req.params.id, account.id);
  if (!result) throw new HttpError(404, 'This report is unavailable for confirmation.');
  res.json(result);
}));

communityRoutes.patch('/reports/:id/moderate', requireAdmin, route(async (req, res) => {
  const { status, officialResponse } = req.body ?? {};
  if (!statuses.includes(status) || (officialResponse !== undefined && !validText(officialResponse, 0, 1200))) {
    throw new HttpError(400, 'Choose a moderation status and enter a valid note.');
  }
  try {
    const result = await moderateReportInDb(req.params.id, status, officialResponse?.trim(), session(res).uid);
    return res.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Report Not Found') throw new HttpError(404, 'Report not found.');
    throw error;
  }
}));

export const listModerationReports = route(async (_req, res) => {
  res.json({ reports: await getCommunityReportsFromDb({ accountsOnly: true }) });
});
