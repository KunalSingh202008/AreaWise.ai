import { describe, it, expect } from 'vitest';
import {
  VARANASI_LOCALITIES,
  RAW_LOCALITIES,
  buildEvidenceGroundedLocality,
} from '../server/data';
import { calculateAreaScore, calculateProfileScores } from '../server/scoring';
import { LocalityCategoryScores } from '../src/types';

describe('Phase 2A: Data Integrity & Score Grounding Audit', () => {
  const AUDITED_ZERO_INDICATOR_LOCALITY_IDS = [
    'durgakund',
    'shivpur',
    'sarnath',
    'cantonment',
    'pandeypur',
    'orderly-bazaar',
    'godowlia',
  ];

  const PARTIAL_INDICATOR_LOCALITY_IDS = [
    'sigra',
    'lanka',
    'mahmoorganj',
    'bhelupur',
    'assi',
    'ramnagar',
  ];

  it('audits all 13 localities in the seed baseline', () => {
    expect(VARANASI_LOCALITIES).toHaveLength(13);
    expect(RAW_LOCALITIES).toHaveLength(13);
  });

  it('enforces that all 7 zero-indicator localities have 100% null category scores and withheld overall score', () => {
    for (const id of AUDITED_ZERO_INDICATOR_LOCALITY_IDS) {
      const loc = VARANASI_LOCALITIES.find((l) => l.id === id);
      expect(loc, `Locality ${id} should exist`).toBeDefined();

      if (loc) {
        // Zero indicators verified
        expect(loc.indicators).toHaveLength(0);

        // Every single category score MUST be null
        const categories: (keyof LocalityCategoryScores)[] = [
          'connectivity',
          'healthcare',
          'education',
          'environment',
          'civicInfrastructure',
          'dailyAmenities',
          'propertyMarketTransparency',
        ];

        for (const cat of categories) {
          expect(
            loc.scores.categoryScores[cat],
            `${id} category ${cat} must be null`
          ).toBeNull();
        }

        // Missing categories must contain all 7 core categories
        expect(loc.scores.missingCategories).toHaveLength(7);

        // Coverage must be 0%
        expect(loc.scores.coverageScore).toBe(0);

        // Confidence and freshness must be null (no sensors/sources attached)
        expect(loc.scores.confidenceScore).toBeNull();
        expect(loc.scores.dataFreshnessDays).toBeNull();

        // Overall AreaScore must be withheld
        expect(loc.scores.isEligibleForOverallScore).toBe(false);
        expect(loc.scores.overallScore).toBeNull();

        // All persona scores must be strictly null
        expect(loc.profileScores.familyScore).toBeNull();
        expect(loc.profileScores.studentScore).toBeNull();
        expect(loc.profileScores.commuterScore).toBeNull();
        expect(loc.profileScores.investorScore).toBeNull();

        // Must include integrity cautions and missing data notes
        expect(
          loc.cautions.some(
            (c) => c.includes('Data Integrity Notice') || c.includes('withheld')
          )
        ).toBe(true);

        expect(
          loc.missingDataNotes.some(
            (n) => n.includes('withheld per AreaWise') || n.includes('pending integration')
          )
        ).toBe(true);
      }
    }
  });

  it('enforces that partial-evidence localities only have scores for categories with actual indicators', () => {
    for (const id of PARTIAL_INDICATOR_LOCALITY_IDS) {
      const loc = VARANASI_LOCALITIES.find((l) => l.id === id);
      expect(loc, `Locality ${id} should exist`).toBeDefined();

      if (loc) {
        expect(loc.indicators.length).toBeGreaterThan(0);

        // Check each category: if no indicator supports it, it must be null
        const indicatorNames = loc.indicators.map((ind) => ind.name.toLowerCase());

        const hasConnectivity = indicatorNames.some((n) => n.includes('connectivity'));
        const hasHealthcare = indicatorNames.some((n) => n.includes('healthcare'));
        const hasEducation = indicatorNames.some((n) => n.includes('education'));
        const hasEnvironment = indicatorNames.some((n) => n.includes('environment'));
        const hasCivic = indicatorNames.some((n) => n.includes('civic'));
        const hasAmenities = indicatorNames.some((n) => n.includes('amenities'));
        const hasProperty = indicatorNames.some((n) => n.includes('property'));

        if (!hasConnectivity) expect(loc.scores.categoryScores.connectivity).toBeNull();
        else expect(loc.scores.categoryScores.connectivity).not.toBeNull();

        if (!hasHealthcare) expect(loc.scores.categoryScores.healthcare).toBeNull();
        else expect(loc.scores.categoryScores.healthcare).not.toBeNull();

        if (!hasEducation) expect(loc.scores.categoryScores.education).toBeNull();
        if (!hasEnvironment) expect(loc.scores.categoryScores.environment).toBeNull();
        if (!hasCivic) expect(loc.scores.categoryScores.civicInfrastructure).toBeNull();
        if (!hasAmenities) expect(loc.scores.categoryScores.dailyAmenities).toBeNull();
        if (!hasProperty) expect(loc.scores.categoryScores.propertyMarketTransparency).toBeNull();

        // Coverage is below 50% threshold for all partial seeds, so overallScore must be withheld
        expect(loc.scores.coverageScore).toBeLessThan(50);
        expect(loc.scores.isEligibleForOverallScore).toBe(false);
        expect(loc.scores.overallScore).toBeNull();
      }
    }
  });

  it('verifies that Ramnagar specifically has dailyAmenities = null (no fabricated 62)', () => {
    const ramnagar = VARANASI_LOCALITIES.find((l) => l.id === 'ramnagar');
    expect(ramnagar).toBeDefined();
    if (ramnagar) {
      expect(ramnagar.scores.categoryScores.dailyAmenities).toBeNull();
      expect(ramnagar.scores.categoryScores.connectivity).toBe(56);
      expect(ramnagar.scores.missingCategories).toContain('dailyAmenities');
    }
  });

  it('proves that buildEvidenceGroundedLocality rejects fabricated scores passed in base object', () => {
    const maliciousBase: any = {
      id: 'test-fake',
      name: 'Fake Locality',
      city: 'Varanasi',
      state: 'Uttar Pradesh',
      pincode: '221001',
      center: { lat: 25.3, lng: 83.0 },
      bounds: [[25.31, 82.99], [25.31, 83.01], [25.29, 83.01], [25.29, 82.99]],
      tagline: 'Fake Tagline',
      description: 'Fake Description',
      previewImage: '/fake.jpg',
      scores: {
        overallScore: 99,
        categoryScores: {
          connectivity: 95,
          healthcare: 95,
          education: 95,
          environment: 95,
          civicInfrastructure: 95,
          dailyAmenities: 95,
          propertyMarketTransparency: 95,
        },
      },
      profileScores: {
        familyScore: 95,
        studentScore: 95,
        commuterScore: 95,
        investorScore: 95,
      },
      indicators: [], // Zero genuine indicators!
      facilities: [],
      strengths: [],
      cautions: [],
      missingDataNotes: [],
    };

    const sanitized = buildEvidenceGroundedLocality(maliciousBase);

    // All fake scores must be completely eliminated
    expect(sanitized.scores.overallScore).toBeNull();
    expect(sanitized.scores.isEligibleForOverallScore).toBe(false);
    expect(sanitized.scores.coverageScore).toBe(0);
    expect(sanitized.scores.confidenceScore).toBeNull();
    expect(sanitized.scores.categoryScores.connectivity).toBeNull();
    expect(sanitized.scores.categoryScores.healthcare).toBeNull();
    expect(sanitized.scores.categoryScores.education).toBeNull();
    expect(sanitized.scores.categoryScores.environment).toBeNull();
    expect(sanitized.scores.categoryScores.civicInfrastructure).toBeNull();
    expect(sanitized.scores.categoryScores.dailyAmenities).toBeNull();
    expect(sanitized.scores.categoryScores.propertyMarketTransparency).toBeNull();

    // All persona scores must be null
    expect(sanitized.profileScores.familyScore).toBeNull();
    expect(sanitized.profileScores.studentScore).toBeNull();
    expect(sanitized.profileScores.commuterScore).toBeNull();
    expect(sanitized.profileScores.investorScore).toBeNull();
  });
});
