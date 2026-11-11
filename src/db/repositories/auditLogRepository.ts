import { db } from '../index.ts';
import { auditLogs } from '../schema.ts';
import { desc } from 'drizzle-orm';

export interface AuditLogItem {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
  entityType?: string;
  entityId?: string;
}

export async function getAuditLogsFromDb(limit: number = 100): Promise<AuditLogItem[]> {
  const rows = await db.select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: `log-${r.id}`,
    action: r.action,
    actor: r.actor,
    timestamp: r.createdAt.toISOString(),
    details: typeof r.details === 'string'
      ? r.details
      : r.details
      ? JSON.stringify(r.details)
      : `${r.action} performed by ${r.actor}`,
    entityType: r.entityType,
    entityId: r.entityId || undefined,
  }));
}

export async function createAuditLogInDb(
  action: string,
  actor: string,
  entityType: string,
  entityId?: string,
  details?: any,
  ipAddress?: string
): Promise<AuditLogItem> {
  const inserted = await db.insert(auditLogs)
    .values({
      action,
      actor,
      entityType,
      entityId: entityId || null,
      details: details || null,
      ipAddress: ipAddress || null,
    })
    .returning();

  const r = inserted[0];
  return {
    id: `log-${r.id}`,
    action: r.action,
    actor: r.actor,
    timestamp: r.createdAt.toISOString(),
    details: typeof r.details === 'string'
      ? r.details
      : r.details
      ? JSON.stringify(r.details)
      : `${r.action} recorded`,
    entityType: r.entityType,
    entityId: r.entityId || undefined,
  };
}
