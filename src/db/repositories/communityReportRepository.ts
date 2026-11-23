import { randomUUID } from 'node:crypto';
import { db, pool } from '../index.ts';
import { communityReports, reportVotes, moderationActions, auditLogs, localities } from '../schema.ts';
import { eq, desc, and, sql, inArray, isNotNull } from 'drizzle-orm';
import { CommunityReport } from '../../types/index.ts';

export interface ReportFilter {
  localityId?: string;
  category?: string;
  status?: string;
  published?: boolean;
  authorUserId?: number;
  accountsOnly?: boolean;
}

export interface CreateReportInput {
  localityId: string;
  title: string;
  category: string;
  description: string;
  lat?: number;
  lng?: number;
  imageUrl?: string;
  submittedBy?: string;
  userId?: number;
  actorUid?: string;
}

export async function getCommunityReportsFromDb(filter: ReportFilter = {}): Promise<CommunityReport[]> {
  const conditions = [];

  if (filter.localityId) {
    conditions.push(eq(communityReports.localityId, filter.localityId.toLowerCase()));
  }
  if (filter.category) {
    conditions.push(eq(communityReports.category, filter.category));
  }
  if (filter.status) {
    conditions.push(eq(communityReports.status, filter.status));
  }

  if (filter.published) conditions.push(inArray(communityReports.status, ['verified', 'action_taken']));
  if (filter.authorUserId) conditions.push(eq(communityReports.userId, filter.authorUserId));
  if (filter.published || filter.accountsOnly) conditions.push(isNotNull(communityReports.userId));

  const query = db.select({
    id: communityReports.id,
    localityId: communityReports.localityId,
    category: communityReports.category,
    title: communityReports.title,
    description: communityReports.description,
    lat: sql<string>`COALESCE(${communityReports.lat}, ${localities.centerLat})`,
    lng: sql<string>`COALESCE(${communityReports.lng}, ${localities.centerLng})`,
    severity: communityReports.severity,
    status: communityReports.status,
    evidenceUrl: communityReports.evidenceUrl,
    upvotesCount: communityReports.upvotesCount,
    officialResponse: communityReports.officialResponse,
    submittedBy: communityReports.submittedBy,
    createdAt: communityReports.createdAt,
    localityName: localities.name,
  })
  .from(communityReports)
  .leftJoin(localities, eq(communityReports.localityId, localities.id))
  .orderBy(desc(communityReports.upvotesCount), desc(communityReports.createdAt), communityReports.id).limit(100);

  const rows = conditions.length > 0
    ? await query.where(and(...conditions))
    : await query;

  return rows.map((r) => ({
    id: r.id,
    localityId: r.localityId,
    localityName: r.localityName || r.localityId,
    title: r.title,
    category: r.category as any,
    description: r.description,
    lat: Number(r.lat),
    lng: Number(r.lng),
    imageUrl: r.evidenceUrl || undefined,
    status: r.status as any,
    submittedBy: r.submittedBy || 'Verified Local Resident',
    submittedAt: r.createdAt.toISOString(),
    upvotes: r.upvotesCount,
    officialResponse: r.officialResponse || undefined,
  }));
}

export async function createCommunityReportInDb(input: CreateReportInput): Promise<CommunityReport> {
  const targetLoc = await db.select().from(localities).where(eq(localities.id, input.localityId.toLowerCase())).limit(1);
  if (!targetLoc || targetLoc.length === 0) {
    throw new Error(`Locality '${input.localityId}' not found.`);
  }

  const loc = targetLoc[0];
  const reportId = `cr-${randomUUID()}`;
  const reportLat = input.lat !== undefined ? input.lat : parseFloat(loc.centerLat);
  const reportLng = input.lng !== undefined ? input.lng : parseFloat(loc.centerLng);
  const submittedBy = (input.submittedBy || 'Verified Local Resident').trim();

  // Perform atomic transaction: insert report + insert audit log
  const result = await db.transaction(async (tx) => {
    const inserted = await tx.insert(communityReports)
      .values({
        id: reportId,
        localityId: loc.id,
        category: input.category,
        title: input.title.trim(),
        description: input.description.trim(),
        lat: String(reportLat),
        lng: String(reportLng),
        severity: 'medium',
        status: 'under_review',
        evidenceUrl: input.imageUrl || null,
        userId: input.userId ?? null,
        upvotesCount: input.userId ? 0 : 1,
        submittedBy,
      })
      .returning();

    // Populate spatial geometry
    await tx.execute(sql`
      UPDATE community_reports
      SET location_geom = ST_SetSRID(ST_Point(${reportLng}, ${reportLat}), 4326)
      WHERE id = ${reportId};
    `);

    // Audit log
    await tx.insert(auditLogs)
      .values({
        action: 'COMMUNITY_REPORT_SUBMITTED',
        actor: input.actorUid ?? submittedBy,
        entityType: 'COMMUNITY_REPORT',
        entityId: reportId,
        details: {
          localityId: loc.id,
          category: input.category,
        },
      });

    return inserted[0];
  });

  return {
    id: result.id,
    localityId: result.localityId,
    localityName: loc.name,
    title: result.title,
    category: result.category as any,
    description: result.description,
    lat: reportLat,
    lng: reportLng,
    imageUrl: result.evidenceUrl || undefined,
    status: result.status as any,
    submittedBy: result.submittedBy || 'Verified Local Resident',
    submittedAt: result.createdAt.toISOString(),
    upvotes: result.upvotesCount,
    officialResponse: result.officialResponse || undefined,
  };
}

export async function voteOnReportInDb(reportId: string, voteType: number = 1): Promise<{ id: string; upvotes: number }> {
  const reports = await db.select().from(communityReports).where(eq(communityReports.id, reportId)).limit(1);
  if (!reports || reports.length === 0) {
    throw new Error('Report Not Found');
  }

  const updated = await db.transaction(async (tx) => {
    await tx.insert(reportVotes)
      .values({
        reportId,
        voteType,
      });

    const res = await tx.execute<{ id: string; upvotes_count: number }>(sql`
      UPDATE community_reports
      SET upvotes_count = upvotes_count + ${voteType}
      WHERE id = ${reportId}
      RETURNING id, upvotes_count;
    `);

    return res.rows[0];
  });

  return {
    id: updated.id,
    upvotes: updated.upvotes_count,
  };
}

export async function moderateReportInDb(
  reportId: string,
  status?: string,
  officialResponse?: string,
  moderator: string = 'Senior Civic Auditor'
): Promise<CommunityReport> {
  const existing = await db.select({
    report: communityReports,
    localityName: localities.name,
  })
  .from(communityReports)
  .leftJoin(localities, eq(communityReports.localityId, localities.id))
  .where(eq(communityReports.id, reportId))
  .limit(1);

  if (!existing || existing.length === 0) {
    throw new Error('Report Not Found');
  }

  const current = existing[0];
  const newStatus = status || current.report.status;
  const newResponse = officialResponse !== undefined ? officialResponse : current.report.officialResponse;

  await db.transaction(async (tx) => {
    await tx.update(communityReports)
      .set({
        status: newStatus,
        officialResponse: newResponse,
      })
      .where(eq(communityReports.id, reportId));

    await tx.insert(moderationActions)
      .values({
        reportId,
        moderatorName: moderator,
        action: newStatus,
        justification: newResponse || `Status updated to ${newStatus}`,
      });

    await tx.insert(auditLogs)
      .values({
        action: 'COMMUNITY_REPORT_MODERATED',
        actor: moderator,
        entityType: 'COMMUNITY_REPORT',
        entityId: reportId,
        details: {
          previousStatus: current.report.status,
          newStatus,
          officialResponse: newResponse,
        },
      });
  });

  return {
    id: current.report.id,
    localityId: current.report.localityId,
    localityName: current.localityName || current.report.localityId,
    title: current.report.title,
    category: current.report.category as any,
    description: current.report.description,
    lat: current.report.lat ? parseFloat(current.report.lat) : 25.3176,
    lng: current.report.lng ? parseFloat(current.report.lng) : 82.9873,
    imageUrl: current.report.evidenceUrl || undefined,
    status: newStatus as any,
    submittedBy: current.report.submittedBy || 'Verified Local Resident',
    submittedAt: current.report.createdAt.toISOString(),
    upvotes: current.report.upvotesCount,
    officialResponse: newResponse || undefined,
  };
}

export async function confirmPublishedReport(reportId: string, userId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [report] } = await client.query<{ upvotes_count: number }>(`
      SELECT upvotes_count FROM community_reports
      WHERE id = $1 AND user_id IS NOT NULL AND user_id <> $2 AND status IN ('verified', 'action_taken')
      FOR UPDATE
    `, [reportId, userId]);
    if (!report) {
      await client.query('ROLLBACK');
      return null;
    }

    const insert = await client.query(`
      INSERT INTO report_votes (report_id, user_id, vote_type) VALUES ($1, $2, 1)
      ON CONFLICT (report_id, user_id) WHERE user_id IS NOT NULL DO NOTHING
    `, [reportId, userId]);
    if (insert.rowCount) {
      await client.query('UPDATE community_reports SET upvotes_count = upvotes_count + 1 WHERE id = $1', [reportId]);
    }
    await client.query('COMMIT');
    return { id: reportId, upvotes: report.upvotes_count + (insert.rowCount ?? 0), confirmed: true };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
