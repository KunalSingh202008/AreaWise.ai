import { describe, it, expect } from 'vitest';
import { db } from '../src/db/index.ts';
import { sql } from 'drizzle-orm';
import {
  getAllLocalitiesFromDb,
  getLocalityByIdFromDb,
  searchLocalitiesInDb,
  resolveLocationSpatial,
  getFacilitiesSpatial,
} from '../src/db/repositories/localityRepository.ts';
import { METHODOLOGY_VERSION } from '../server/scoring.ts';

describe('Phase 2B: PostgreSQL + PostGIS Database Integration Tests', () => {
  it('connects to Cloud SQL PostgreSQL and verifies PostGIS 3.6 extension', async () => {
    const result = await db.execute<{ version: string }>(sql`SELECT PostGIS_Version() as version;`);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].version).toContain('3.');
  });

  it('verifies all 17 relational tables exist in information_schema', async () => {
    const requiredTables = [
      'users',
      'cities',
      'localities',
      'locality_boundaries',
      'data_sources',
      'evidence_records',
      'indicators',
      'facilities',
      'score_methodologies',
      'score_snapshots',
      'community_reports',
      'report_votes',
      'moderation_actions',
      'saved_localities',
      'ai_conversations',
      'ai_messages',
      'audit_logs',
    ];

    const result = await db.execute<{ table_name: string }>(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);

    const tableNames = result.rows.map((r) => r.table_name);
    for (const req of requiredTables) {
      expect(tableNames, `Table ${req} should exist in PostgreSQL`).toContain(req);
    }
  });

  it('verifies 13 clean baseline localities seeded in PostgreSQL', async () => {
    const locs = await getAllLocalitiesFromDb();
    expect(locs).toHaveLength(13);

    // Verify Sigra from DB
    const sigra = locs.find((l) => l.id === 'sigra');
    expect(sigra).toBeDefined();
    expect(sigra?.pincode).toBe('221010');
    expect(sigra?.indicators).toHaveLength(3);

    // Verify unobserved categories are strictly null in DB
    expect(sigra?.scores.categoryScores.education).toBeNull();
    expect(sigra?.scores.categoryScores.civicInfrastructure).toBeNull();
    expect(sigra?.scores.categoryScores.dailyAmenities).toBeNull();
    expect(sigra?.scores.categoryScores.propertyMarketTransparency).toBeNull();
    expect(sigra?.scores.overallScore).toBeNull(); // Withheld due to 13% coverage
  });

  it('verifies zero-indicator localities have 100% null category scores in PostgreSQL', async () => {
    const durga = await getLocalityByIdFromDb('durgakund');
    expect(durga).toBeDefined();
    expect(durga?.indicators).toHaveLength(0);
    expect(durga?.scores.overallScore).toBeNull();
    expect(durga?.scores.coverageScore).toBe(0);
    expect(durga?.scores.confidenceScore).toBeNull();

    // Check all categories are null
    const cats = Object.values(durga!.scores.categoryScores);
    expect(cats.every((val) => val === null)).toBe(true);
  });

  it('performs PostGIS geodesic radial facility queries (ST_DWithin & ST_Distance)', async () => {
    // Query facilities within 1000m of Sigra center (25.3176°N, 82.9873°E)
    const facs = await getFacilitiesSpatial(25.3176, 82.9873, 1000);
    expect(facs.length).toBeGreaterThanOrEqual(2);

    // Closest facility should be Dr. Sampurnanand Stadium (~83m)
    expect(facs[0].distanceMeters).toBeLessThanOrEqual(150);
    expect(facs[0].name).toContain('Sampurnanand');

    // Distances must be strictly monotonically non-decreasing
    for (let i = 1; i < facs.length; i++) {
      expect(facs[i].distanceMeters).toBeGreaterThanOrEqual(facs[i - 1].distanceMeters);
    }
  });

  it('resolves spatial point via PostGIS ST_Contains polygon containment', async () => {
    // Sigra center coordinate (25.3176, 82.9873) is inside Sigra boundary polygon
    const resolved = await resolveLocationSpatial(25.3176, 82.9873);
    expect(resolved).toBeDefined();
    expect(resolved.id).toBe('sigra');
    expect(resolved.isCustomResolved).toBe(false);
  });

  it('resolves an arbitrary custom coordinate outside standard boundaries with truthful withheld score', async () => {
    // Point in Varanasi rural fringe (25.3700, 83.0800)
    const custom = await resolveLocationSpatial(25.3700, 83.0800, 'Fringe Research Plot');
    expect(custom).toBeDefined();
    expect(custom.name).toContain('Fringe Research Plot');
    expect(custom.isCustomResolved).toBe(true);
    // Unobserved civic and property transparency are null
    expect(custom.scores.categoryScores.civicInfrastructure).toBeNull();
    expect(custom.scores.categoryScores.propertyMarketTransparency).toBeNull();
    // Composite AreaScore is withheld
    expect(custom.scores.overallScore).toBeNull();
  });

  it('searches localities in PostgreSQL with text and pincode filters', async () => {
    const resultsName = await searchLocalitiesInDb('Lanka');
    expect(resultsName.some((l) => l.id === 'lanka')).toBe(true);

    const resultsPin = await searchLocalitiesInDb('221010');
    expect(resultsPin.some((l) => l.id === 'sigra')).toBe(true);
  });

  it('stores score snapshots with methodology version v1.3.0', async () => {
    const snapshots = await db.execute<{
      locality_id: string;
      methodology_version: string;
      overall_score: string | null;
      coverage_score: number;
    }>(sql`
      SELECT locality_id, methodology_version, overall_score, coverage_score
      FROM score_snapshots
      WHERE locality_id = 'sigra'
      LIMIT 1;
    `);

    expect(snapshots.rows).toHaveLength(1);
    expect(snapshots.rows[0].methodology_version).toBe(METHODOLOGY_VERSION);
    expect(snapshots.rows[0].overall_score).toBeNull();
    expect(snapshots.rows[0].coverage_score).toBe(13);
  });
});
