import { db, pool } from './index.ts';
import {
  cities,
  localities,
  localityBoundaries,
  dataSources,
  facilities,
  scoreMethodologies,
  scoreSnapshots,
  indicators,
  evidenceRecords,
  communityReports,
  auditLogs,
} from './schema.ts';
import {
  DATA_SOURCES,
  MASTER_VARANASI_FACILITIES,
  RAW_LOCALITIES,
  INITIAL_COMMUNITY_REPORTS,
  buildEvidenceGroundedLocality,
} from '../../server/data.ts';
import { METHODOLOGY_VERSION, activeWeights, MIN_COVERAGE_THRESHOLD, MIN_WEIGHT_SUM_THRESHOLD } from '../../server/scoring.ts';
import { sql } from 'drizzle-orm';

export async function seedDatabase() {
  console.log('--- Starting AreaWise AI Phase 2B Seed ---');

  // 1. Seed City (Varanasi Pilot)
  console.log('Seeding city: Varanasi...');
  await db.insert(cities)
    .values({
      id: 'varanasi',
      name: 'Varanasi',
      hindiName: 'वाराणसी',
      state: 'Uttar Pradesh',
      country: 'India',
      centerLat: '25.317600',
      centerLng: '82.987300',
      isActive: true,
    })
    .onConflictDoUpdate({
      target: cities.id,
      set: { name: 'Varanasi', state: 'Uttar Pradesh' },
    });

  // Populate PostGIS center_geom for Varanasi
  await db.execute(sql`
    UPDATE cities 
    SET center_geom = ST_SetSRID(ST_Point(center_lng::float8, center_lat::float8), 4326)
    WHERE id = 'varanasi';
  `);

  // 2. Seed Score Methodology (v1.3.0-evidence-grounded)
  console.log('Seeding score methodology:', METHODOLOGY_VERSION);
  await db.insert(scoreMethodologies)
    .values({
      version: METHODOLOGY_VERSION,
      name: 'AreaWise Truthful Evidence-Grounded Scoring Methodology',
      minCoverageThreshold: String(MIN_COVERAGE_THRESHOLD),
      minWeightSumThreshold: String(MIN_WEIGHT_SUM_THRESHOLD),
      maxMissingPillars: 3,
      weights: activeWeights,
      documentationUrl: 'https://areawise.ai/methodology/v1.3.0',
      isActive: true,
    })
    .onConflictDoNothing();

  // 3. Seed Verified Data Sources
  console.log('Seeding data sources...');
  for (const ds of DATA_SOURCES) {
    const org = ds.id === 'cpcb-caaqms'
      ? 'Central Pollution Control Board (CPCB)'
      : ds.id === 'vnn-scada'
      ? 'Varanasi Nagar Nigam & Smart City'
      : ds.id === 'igrs-up-circlerates'
      ? 'UP Stamp & Registration Dept (IGRSUP)'
      : ds.id === 'isro-bhuvan'
      ? 'Indian Space Research Organisation (ISRO)'
      : 'OpenStreetMap Community';

    const tier = ds.id.includes('cpcb')
      ? 'official_sensor'
      : ds.id.includes('igrs')
      ? 'official_registry'
      : ds.id.includes('isro')
      ? 'satellite'
      : ds.id.includes('vnn')
      ? 'municipal_record'
      : 'osm_data';

    await db.insert(dataSources)
      .values({
        id: ds.id,
        name: ds.name,
        organization: org,
        tier: tier,
        updateFrequency: ds.coverage || 'Daily sync',
        isVerified: ds.reliabilityTier.includes('Tier 1'),
        citationUrl: ds.apiEndpoint,
      })
      .onConflictDoNothing();
  }

  // 4. Seed Facilities with PostGIS Points
  console.log('Seeding facilities...');
  for (const fac of MASTER_VARANASI_FACILITIES) {
    await db.insert(facilities)
      .values({
        id: fac.id,
        name: fac.name,
        category: fac.category,
        subcategory: fac.subcategory,
        lat: String(fac.lat),
        lng: String(fac.lng),
        address: fac.address,
        source: fac.source,
        verificationStatus: fac.verificationStatus,
        lastVerifiedDate: fac.lastVerifiedDate || null,
      })
      .onConflictDoUpdate({
        target: facilities.id,
        set: {
          name: fac.name,
          category: fac.category,
          subcategory: fac.subcategory,
          address: fac.address,
          source: fac.source,
          verificationStatus: fac.verificationStatus,
          lastVerifiedDate: fac.lastVerifiedDate || null,
        },
      });
  }

  // Update facilities PostGIS point geometries
  await db.execute(sql`
    UPDATE facilities 
    SET location_geom = ST_SetSRID(ST_Point(lng::float8, lat::float8), 4326)
    WHERE location_geom IS NULL;
  `);

  // 5. Seed Localities, Boundaries, Indicators, and Score Snapshots
  console.log('Seeding 13 clean baseline localities...');
  for (const raw of RAW_LOCALITIES) {
    const grounded = buildEvidenceGroundedLocality(raw);

    await db.insert(localities)
      .values({
        id: grounded.id,
        cityId: 'varanasi',
        name: grounded.name,
        hindiName: grounded.hindiName,
        pincode: grounded.pincode,
        tagline: grounded.tagline,
        hindiTagline: grounded.hindiTagline,
        description: grounded.description,
        hindiDescription: grounded.hindiDescription,
        previewImage: grounded.previewImage,
        centerLat: String(grounded.center.lat),
        centerLng: String(grounded.center.lng),
        isCustomResolved: !!grounded.isCustomResolved,
        propertyMarketData: grounded.propertyMarketData || null,
        strengths: grounded.strengths,
        cautions: grounded.cautions,
        missingDataNotes: grounded.missingDataNotes,
      })
      .onConflictDoUpdate({
        target: localities.id,
        set: {
          name: grounded.name,
          hindiName: grounded.hindiName,
          pincode: grounded.pincode,
          tagline: grounded.tagline,
          description: grounded.description,
        },
      });

    // Populate PostGIS center_geom
    await db.execute(sql`
      UPDATE localities 
      SET center_geom = ST_SetSRID(ST_Point(center_lng::float8, center_lat::float8), 4326)
      WHERE id = ${grounded.id};
    `);

    // Insert Boundary with PostGIS Polygon
    if (grounded.bounds && grounded.bounds.length >= 3) {
      // Ensure polygon is closed by repeating the first vertex at the end
      const ring = [...grounded.bounds];
      if (
        ring[0][0] !== ring[ring.length - 1][0] ||
        ring[0][1] !== ring[ring.length - 1][1]
      ) {
        ring.push(ring[0]);
      }
      // WKT coordinates format: LNG LAT, LNG LAT ...
      const wktPoints = ring.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
      const wkt = `POLYGON((${wktPoints}))`;

      await db.insert(localityBoundaries)
        .values({
          localityId: grounded.id,
          coordinates: grounded.bounds,
          source: 'Varanasi Master Plan GIS & OpenStreetMap Ward Boundary',
          effectiveDate: '2026-01-01',
        })
        .onConflictDoUpdate({
          target: localityBoundaries.localityId,
          set: {
            coordinates: grounded.bounds,
            source: 'Varanasi Master Plan GIS & OpenStreetMap Ward Boundary',
            effectiveDate: '2026-01-01',
          },
        });

      await db.execute(sql`
        UPDATE locality_boundaries 
        SET boundary_geom = ST_GeomFromText(${wkt}, 4326),
            area_sq_km = ST_Area(ST_GeomFromText(${wkt}, 4326)::geography) / 1000000.0
        WHERE locality_id = ${grounded.id};
      `);
    }

    // Insert Indicators (only if present in clean baseline)
    for (const ind of grounded.indicators) {
      await db.insert(indicators)
        .values({
          id: ind.id,
          localityId: grounded.id,
          category: ind.name.toLowerCase().includes('connect')
            ? 'connectivity'
            : ind.name.toLowerCase().includes('health')
            ? 'healthcare'
            : ind.name.toLowerCase().includes('environ')
            ? 'environment'
            : ind.name.toLowerCase().includes('civic')
            ? 'civicInfrastructure'
            : 'general',
          name: ind.name,
          score: ind.score,
          weight: String(ind.weight),
          status: ind.status,
          summary: ind.summary,
          metrics: ind.metrics as any,
          sources: ind.sources as any,
        })
        .onConflictDoNothing();

      // Seed underlying evidence records
      for (const m of ind.metrics) {
        await db.insert(evidenceRecords)
          .values({
            id: `ev-${ind.id}-${m.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`.slice(0, 48),
            localityId: grounded.id,
            sourceId: 'cpcb-caaqms', // reference data source
            category: ind.name.toLowerCase().includes('connect')
              ? 'connectivity'
              : ind.name.toLowerCase().includes('health')
              ? 'healthcare'
              : 'environment',
            metricLabel: m.label,
            metricValue: String(m.value),
            metricUnit: m.unit || null,
            observationDate: m.date || '2026-10-15',
            verificationStatus: 'verified',
          })
          .onConflictDoNothing();
      }
    }

    // Insert Evidence-Grounded Score Snapshot (idempotent upsert on composite key)
    await db.insert(scoreSnapshots)
      .values({
        localityId: grounded.id,
        methodologyVersion: METHODOLOGY_VERSION,
        overallScore: grounded.scores.overallScore !== null ? String(grounded.scores.overallScore) : null,
        isEligibleForOverallScore: grounded.scores.isEligibleForOverallScore,
        coverageScore: grounded.scores.coverageScore,
        confidenceScore: grounded.scores.confidenceScore,
        dataFreshnessDays: grounded.scores.dataFreshnessDays,
        categoryScores: grounded.scores.categoryScores,
        missingCategories: grounded.scores.missingCategories,
        profileScores: grounded.profileScores,
      })
      .onConflictDoUpdate({
        target: [scoreSnapshots.localityId, scoreSnapshots.methodologyVersion],
        set: {
          overallScore: grounded.scores.overallScore !== null ? String(grounded.scores.overallScore) : null,
          isEligibleForOverallScore: grounded.scores.isEligibleForOverallScore,
          coverageScore: grounded.scores.coverageScore,
          confidenceScore: grounded.scores.confidenceScore,
          dataFreshnessDays: grounded.scores.dataFreshnessDays,
          categoryScores: grounded.scores.categoryScores,
          missingCategories: grounded.scores.missingCategories,
          profileScores: grounded.profileScores,
        },
      });
  }

  // 6. Seed Community Reports & Initial Moderations
  console.log('Seeding initial community reports...');
  for (const cr of INITIAL_COMMUNITY_REPORTS) {
    await db.insert(communityReports)
      .values({
        id: cr.id,
        localityId: cr.localityId,
        category: cr.category,
        title: cr.title,
        description: cr.description,
        lat: String(cr.lat),
        lng: String(cr.lng),
        severity: 'medium',
        status: cr.status || 'submitted',
        upvotesCount: cr.upvotes || 0,
        officialResponse: cr.officialResponse || null,
        submittedBy: cr.submittedBy || 'Verified Local Resident',
      })
      .onConflictDoUpdate({
        target: communityReports.id,
        set: {
          title: cr.title,
          description: cr.description,
          status: cr.status || 'submitted',
          officialResponse: cr.officialResponse || null,
        },
      });
  }

  await db.execute(sql`
    UPDATE community_reports 
    SET location_geom = ST_SetSRID(ST_Point(lng::float8, lat::float8), 4326)
    WHERE location_geom IS NULL;
  `);

  // 7. Seed System Bootstrap Audit Log
  await db.insert(auditLogs)
    .values({
      action: 'PHASE_2B_DATABASE_INITIALIZED',
      actor: 'AreaWise Database Engine',
      entityType: 'SYSTEM',
      details: {
        methodology: METHODOLOGY_VERSION,
        seededLocalities: RAW_LOCALITIES.length,
        spatialSupport: 'PostGIS 3.6',
      },
    })
    .onConflictDoNothing();

  console.log('--- AreaWise AI Phase 2B Seed Complete ---');
}

// Allow direct execution via CLI
if (process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .then(() => {
      console.log('Seeding finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding failed:', err);
      process.exit(1);
    });
}
