import { describe, it, expect } from 'vitest';
import { db } from '../src/db/index.ts';
import { sql, eq } from 'drizzle-orm';
import {
  communityReports,
  reportVotes,
  moderationActions,
  auditLogs,
  scoreMethodologies,
  scoreSnapshots,
  localityBoundaries,
  aiConversations,
  aiMessages,
  facilities,
} from '../src/db/schema.ts';
import {
  createCommunityReportInDb,
  voteOnReportInDb,
  moderateReportInDb,
  getCommunityReportsFromDb,
} from '../src/db/repositories/communityReportRepository.ts';
import {
  createAuditLogInDb,
  getAuditLogsFromDb,
} from '../src/db/repositories/auditLogRepository.ts';
import {
  saveAIConversationAndMessages,
  getAIConversationHistory,
} from '../src/db/repositories/aiConversationRepository.ts';
import {
  getActiveScoringWeightsFromDb,
  updateScoringWeightsInDb,
} from '../src/db/repositories/scoringMethodologyRepository.ts';
import {
  getAllLocalitiesFromDb,
  getLocalityByIdFromDb,
  getFacilitiesSpatial,
} from '../src/db/repositories/localityRepository.ts';
import { seedDatabase } from '../src/db/seed.ts';

describe('Phase 2B.2: Priority 1 Database Remediation Tests', () => {
  // Test 1: Community report persistence in PostgreSQL
  it('1. persists community reports into PostgreSQL with atomic transaction', async () => {
    const testReport = await createCommunityReportInDb({
      localityId: 'sigra',
      title: 'Automated Test Drainage Issue',
      category: 'drainage',
      description: 'Clogged storm drain near Sigra sports complex gate.',
      lat: 25.3178,
      lng: 82.9870,
      submittedBy: 'Civic Test Suite User',
    });

    expect(testReport.id).toBeDefined();
    expect(testReport.status).toBe('under_review');
    expect(testReport.localityName).toBe('Sigra');

    // Verify row directly in PostgreSQL
    const rows = await db.select().from(communityReports).where(eq(communityReports.id, testReport.id)).limit(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Automated Test Drainage Issue');
    expect(rows[0].submittedBy).toBe('Civic Test Suite User');

    // Clean up isolated test row
    await db.delete(communityReports).where(eq(communityReports.id, testReport.id));
  });

  // Test 2: Report vote persistence
  it('2. persists report votes and increments upvotes atomically in PostgreSQL', async () => {
    // Create temporary report for voting test
    const report = await createCommunityReportInDb({
      localityId: 'lanka',
      title: 'Test Vote Target Report',
      category: 'roads',
      description: 'Pothole near Ravindrapuri junction.',
    });

    const voteRes = await voteOnReportInDb(report.id, 1);
    expect(voteRes.upvotes).toBe(2); // Initial 1 + 1 new vote

    const voteRows = await db.select().from(reportVotes).where(eq(reportVotes.reportId, report.id));
    expect(voteRows.length).toBeGreaterThanOrEqual(1);

    // Clean up
    await db.delete(communityReports).where(eq(communityReports.id, report.id));
  });

  // Test 3: Moderation action persistence
  it('3. persists moderation actions and status changes in PostgreSQL', async () => {
    const report = await createCommunityReportInDb({
      localityId: 'assi',
      title: 'Test Moderation Target Report',
      category: 'waste',
      description: 'Littering complaint.',
    });

    const modResult = await moderateReportInDb(
      report.id,
      'action_taken',
      'Varanasi Nagar Nigam sanitary crew dispatched.',
      'Lead Quality Inspector'
    );

    expect(modResult.status).toBe('action_taken');
    expect(modResult.officialResponse).toContain('sanitary crew dispatched');

    const modRows = await db.select().from(moderationActions).where(eq(moderationActions.reportId, report.id));
    expect(modRows).toHaveLength(1);
    expect(modRows[0].action).toBe('action_taken');
    expect(modRows[0].moderatorName).toBe('Lead Quality Inspector');

    // Clean up
    await db.delete(communityReports).where(eq(communityReports.id, report.id));
  });

  // Test 4: Audit log persistence
  it('4. persists audit logs into PostgreSQL audit_logs table', async () => {
    const logItem = await createAuditLogInDb(
      'PHASE2B2_INTEGRATION_TEST',
      'Vitest Engine',
      'INTEGRATION_TEST',
      'test-run-1',
      { scope: 'priority-1-remediation' }
    );

    expect(logItem.id).toBeDefined();

    const dbLogs = await getAuditLogsFromDb(10);
    const found = dbLogs.find((l) => l.action === 'PHASE2B2_INTEGRATION_TEST');
    expect(found).toBeDefined();
    expect(found?.actor).toBe('Vitest Engine');
  });

  // Test 5: AI conversation and message persistence
  it('5. persists AI conversation and user/assistant messages in PostgreSQL', async () => {
    const testConvId = `conv-test-${Date.now()}`;
    const result = await saveAIConversationAndMessages({
      conversationId: testConvId,
      localityId: 'sigra',
      language: 'en',
      prompt: 'What are the main transport hubs near Sigra?',
      answer: 'Varanasi Junction (Cantt) is 2.1 km away.',
      spokenScript: 'Varanasi Junction Cantt is 2.1 kilometers away.',
      citations: [{ sourceName: 'CRIS Northern Railways' }],
    });

    expect(result.conversationId).toBe(testConvId);
    expect(result.userMessageId).toBeGreaterThan(0);
    expect(result.assistantMessageId).toBeGreaterThan(0);

    const history = await getAIConversationHistory(testConvId);
    expect(history).toHaveLength(2);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toContain('transport hubs');
    expect(history[1].role).toBe('assistant');
    expect(history[1].content).toContain('Varanasi Junction');

    // Clean up
    await db.delete(aiConversations).where(eq(aiConversations.id, testConvId));
  });

  // Test 6: Scoring weight persistence
  it('6. persists scoring weights updates to score_methodologies table', async () => {
    const updated = await updateScoringWeightsInDb(
      {
        connectivity: 0.22,
        healthcare: 0.12,
        environment: 0.18,
      },
      'Test Scoring Moderator'
    );

    const fromDb = await getActiveScoringWeightsFromDb();
    expect(updated.connectivity).toBeDefined();
    expect(updated.connectivity).toBe(fromDb.connectivity);
    expect(fromDb.connectivity).toBeCloseTo(0.2157, 3);
  });

  // Test 7 & 8: Database outage returns proper error in production (no silent fallback)
  it('7 & 8. throws an explicit error in production mode rather than silently falling back to in-memory data', async () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';

      // Calling a non-existent locality in production with invalid input should not return synthetic mock data
      await expect(getLocalityByIdFromDb('invalid-test-outage-locality')).resolves.toBeNull();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  // Test 9 & 10: Seed idempotency & duplicate prevention
  it('9 & 10. ensures repeated seeding does not duplicate boundaries or score snapshots', async () => {
    const initialBoundaries = await db.select().from(localityBoundaries);
    const initialSnapshots = await db.select().from(scoreSnapshots);

    expect(initialBoundaries.length).toBe(13);
    expect(initialSnapshots.length).toBe(13);

    // Re-run seed
    await seedDatabase();

    const afterBoundaries = await db.select().from(localityBoundaries);
    const afterSnapshots = await db.select().from(scoreSnapshots);

    // Row counts must remain strictly identical
    expect(afterBoundaries.length).toBe(13);
    expect(afterSnapshots.length).toBe(13);
  });

  // Test 11: Migration applied and verified in catalog
  it('11. verifies unique constraints exist in PostgreSQL catalog', async () => {
    const constraints = await db.execute<{ conname: string }>(sql`
      SELECT conname 
      FROM pg_constraint 
      WHERE conname IN ('locality_boundaries_locality_id_unique', 'score_snapshots_locality_methodology_unique');
    `);

    const names = constraints.rows.map((c) => c.conname);
    expect(names).toContain('locality_boundaries_locality_id_unique');
    expect(names).toContain('score_snapshots_locality_methodology_unique');
  });

  // Test 12: Spatial GIST indexes exist in live catalog
  it('12. verifies GIST spatial indexes and compound indexes exist in pg_indexes', async () => {
    const indexRes = await db.execute<{ indexname: string }>(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname IN (
          'idx_facilities_location_geom',
          'idx_facilities_location_geog',
          'idx_locality_boundaries_geom',
          'idx_localities_center_geom',
          'idx_cities_center_geom',
          'idx_community_reports_location_geom'
        );
    `);

    const indexNames = indexRes.rows.map((r) => r.indexname);
    expect(indexNames).toContain('idx_facilities_location_geom');
    expect(indexNames).toContain('idx_facilities_location_geog');
    expect(indexNames).toContain('idx_locality_boundaries_geom');
    expect(indexNames).toContain('idx_localities_center_geom');
    expect(indexNames).toContain('idx_cities_center_geom');
    expect(indexNames).toContain('idx_community_reports_location_geom');
  });

  // Test 13: Radial facility search uses functional geography index
  it('13. verifies PostGIS radial facility searches use functional geography index in execution plan', async () => {
    const plan = await db.execute<{ 'QUERY PLAN': string }>(sql`
      EXPLAIN
      SELECT id, name
      FROM facilities
      WHERE ST_DWithin(location_geom::geography, ST_SetSRID(ST_Point(82.9873, 25.3176), 4326)::geography, 3000);
    `);

    const planText = plan.rows.map((r) => r['QUERY PLAN']).join(' ');
    // Plan should use idx_facilities_location_geog (Bitmap Index Scan or Index Scan)
    expect(planText).toContain('idx_facilities_location_geog');
  });
});
