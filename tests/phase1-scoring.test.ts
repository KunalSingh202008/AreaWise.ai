import { describe, it, expect } from 'vitest';
import {
  calculateAreaScore,
  calculateProfileScores,
  updateWeights,
  activeWeights,
  METHODOLOGY_VERSION,
  MIN_COVERAGE_THRESHOLD,
  BENCHMARK_INDICATORS_COUNT,
} from '../server/scoring';
import { VARANASI_LOCALITIES, resolveLocationByCoordinates } from '../server/data';
import { LocalityCategoryScores } from '../src/types';

describe('Phase 1: Evidence-Grounded Scoring Engine', () => {
  it('strictly preserves null for missing categories (never converts to zero or assumed score)', () => {
    const partialScores: Partial<LocalityCategoryScores> = {
      connectivity: 80,
      healthcare: 75,
      education: null,
      environment: undefined,
      civicInfrastructure: 85,
      dailyAmenities: null,
      propertyMarketTransparency: 70,
    };

    const result = calculateAreaScore(partialScores, {
      providedIndicatorsCount: 16,
      totalPossibleIndicators: BENCHMARK_INDICATORS_COUNT,
    });

    // Null and undefined must remain strictly null
    expect(result.categoryScores.education).toBeNull();
    expect(result.categoryScores.environment).toBeNull();
    expect(result.categoryScores.dailyAmenities).toBeNull();

    // Must NOT convert null to 0
    expect(result.categoryScores.education).not.toBe(0);

    // Missing categories list must contain missing keys
    expect(result.missingCategories).toContain('education');
    expect(result.missingCategories).toContain('environment');
    expect(result.missingCategories).toContain('dailyAmenities');

    // Observed categories are recorded accurately
    expect(result.categoryScores.connectivity).toBe(80);
    expect(result.categoryScores.healthcare).toBe(75);
    expect(result.categoryScores.civicInfrastructure).toBe(85);
    expect(result.categoryScores.propertyMarketTransparency).toBe(70);
  });

  it('calculates coverage strictly from actual indicator availability', () => {
    // 6 out of 24 indicators = 25%
    const lowCoverage = calculateAreaScore(
      { connectivity: 80 },
      { providedIndicatorsCount: 6, totalPossibleIndicators: 24 }
    );
    expect(lowCoverage.coverageScore).toBe(25);

    // 18 out of 24 indicators = 75%
    const goodCoverage = calculateAreaScore(
      {
        connectivity: 80,
        healthcare: 70,
        education: 85,
        environment: 60,
        civicInfrastructure: 75,
      },
      { providedIndicatorsCount: 18, totalPossibleIndicators: 24 }
    );
    expect(goodCoverage.coverageScore).toBe(75);
  });

  it('calculates confidence separately from coverage based on source tiers', () => {
    // Official sensor tier has higher confidence
    const officialResult = calculateAreaScore(
      { connectivity: 80, healthcare: 80, education: 80, environment: 80, civicInfrastructure: 80 },
      {
        providedIndicatorsCount: 20,
        sourceTiers: ['official_sensor', 'municipal_record'],
      }
    );

    // Community tier has lower confidence
    const communityResult = calculateAreaScore(
      { connectivity: 80, healthcare: 80, education: 80, environment: 80, civicInfrastructure: 80 },
      {
        providedIndicatorsCount: 20,
        sourceTiers: ['community'],
      }
    );

    // Both have identical coverage
    expect(officialResult.coverageScore).toBe(communityResult.coverageScore);

    // Confidence must differ significantly based on source authority
    expect(officialResult.confidenceScore).not.toBeNull();
    expect(communityResult.confidenceScore).not.toBeNull();
    expect(officialResult.confidenceScore!).toBeGreaterThanOrEqual(90);
    expect(communityResult.confidenceScore!).toBeLessThanOrEqual(65);
    expect(officialResult.confidenceScore!).toBeGreaterThan(communityResult.confidenceScore!);
  });

  it('withholds AreaScore when evidence coverage is insufficient (< 50%)', () => {
    const insufficientResult = calculateAreaScore(
      {
        connectivity: 90,
        healthcare: 85,
      },
      {
        providedIndicatorsCount: 8, // 8 / 24 = 33% (< 50% threshold)
        totalPossibleIndicators: 24,
      }
    );

    expect(insufficientResult.coverageScore).toBeLessThan(MIN_COVERAGE_THRESHOLD);
    expect(insufficientResult.isEligibleForOverallScore).toBe(false);
    expect(insufficientResult.overallScore).toBeNull();
  });

  it('withholds AreaScore when active pillar weight sum is below 0.60', () => {
    // Only dailyAmenities (0.10) and propertyMarketTransparency (0.10) provided = weight sum 0.20
    const weakWeightResult = calculateAreaScore(
      {
        dailyAmenities: 85,
        propertyMarketTransparency: 75,
      },
      {
        providedIndicatorsCount: 14,
        totalPossibleIndicators: 24,
      }
    );

    expect(weakWeightResult.isEligibleForOverallScore).toBe(false);
    expect(weakWeightResult.overallScore).toBeNull();
  });

  it('calculates truthful overallScore when coverage and weights meet threshold', () => {
    const validScores: LocalityCategoryScores = {
      connectivity: 90,
      healthcare: 80,
      education: 70,
      environment: 60,
      civicInfrastructure: 80,
      dailyAmenities: 90,
      propertyMarketTransparency: 70,
    };

    const result = calculateAreaScore(validScores, {
      providedIndicatorsCount: 22,
      totalPossibleIndicators: 24,
    });

    expect(result.isEligibleForOverallScore).toBe(true);
    expect(result.overallScore).not.toBeNull();
    expect(result.overallScore).toBeGreaterThan(70);
    expect(result.overallScore).toBeLessThan(85);
    expect(result.methodologyVersion).toBe(METHODOLOGY_VERSION);
  });

  it('profile scores return strictly null when primary pillars are missing (no fake fallbacks)', () => {
    // Missing education for family profile
    const missingEdu: Partial<LocalityCategoryScores> = {
      connectivity: 85,
      healthcare: 80,
      education: null,
      environment: 70,
      civicInfrastructure: 80,
      dailyAmenities: 80,
      propertyMarketTransparency: 70,
    };

    const profiles = calculateProfileScores(missingEdu);

    // FamilyScore requires education, healthcare, and environment.
    // Since education is null, familyScore MUST be null (never 75 or 70!)
    expect(profiles.familyScore).toBeNull();

    // StudentScore also requires education. Since education is null, studentScore MUST be null.
    expect(profiles.studentScore).toBeNull();

    // CommuterScore requires connectivity & civicInfrastructure, which are present
    expect(profiles.commuterScore).not.toBeNull();
    expect(typeof profiles.commuterScore).toBe('number');

    // InvestorScore requires propertyMarketTransparency & civicInfrastructure, which are present
    expect(profiles.investorScore).not.toBeNull();
    expect(typeof profiles.investorScore).toBe('number');
  });

  it('verifies that Ramnagar benchmark has withheld score due to incomplete evidence', () => {
    const ramnagar = VARANASI_LOCALITIES.find((l) => l.id === 'ramnagar');
    expect(ramnagar).toBeDefined();

    if (ramnagar) {
      expect(ramnagar.scores.coverageScore).toBeLessThan(50);
      expect(ramnagar.scores.isEligibleForOverallScore).toBe(false);
      expect(ramnagar.scores.overallScore).toBeNull();

      // Profile scores must be unrated
      expect(ramnagar.profileScores.familyScore).toBeNull();
      expect(ramnagar.profileScores.studentScore).toBeNull();
      expect(ramnagar.profileScores.commuterScore).toBeNull();
      expect(ramnagar.profileScores.investorScore).toBeNull();

      // Missing categories must include unobserved areas
      expect(ramnagar.scores.missingCategories).toContain('healthcare');
      expect(ramnagar.scores.missingCategories).toContain('education');
      expect(ramnagar.scores.missingCategories).toContain('environment');
    }
  });

  it('verifies that dynamic coordinate resolution withholds overall score when civic/property data are unobserved', () => {
    // Resolve arbitrary coordinates in Varanasi rural fringe
    const resolved = resolveLocationByCoordinates(25.3500, 83.0500, 'Fringe Study Point');

    expect(resolved).toBeDefined();
    expect(resolved.isCustomResolved).toBe(true);
    // Unobserved civic and property transparency are strictly null
    expect(resolved.scores.categoryScores.civicInfrastructure).toBeNull();
    expect(resolved.scores.categoryScores.propertyMarketTransparency).toBeNull();

    // Coverage must reflect missing indicators, withholding composite score
    expect(resolved.scores.isEligibleForOverallScore).toBe(false);
    expect(resolved.scores.overallScore).toBeNull();
  });

  it('verifies property market transparency records contain statutory circle rates without fabricated historical curves', () => {
    const sigra = VARANASI_LOCALITIES.find((l) => l.id === 'sigra');
    expect(sigra).toBeDefined();
    expect(sigra?.propertyMarketData).toBeDefined();

    const market = sigra?.propertyMarketData;
    expect(market?.circleRate).toBeDefined();
    if (market?.circleRate) {
      expect(market.circleRate.ratePerSqMeter).toBeGreaterThan(0);
      expect(market.circleRate.registrationAuthority).toContain('Sub-Registrar');
      expect(market.circleRate.gazetteRef).toBeDefined();
    }
    expect(market?.priceDiscoveryStatus).toBe('statutory_only');

    // Confirm no synthetic yearly trend array exists in propertyMarketData
    expect((market as any).historicalTrends).toBeUndefined();
    expect((market as any).fabricatedPricePoints).toBeUndefined();
  });

  it('calculates freshness from actual observation timestamps and returns null when no dated evidence exists', () => {
    // When indicators have real dates
    const withDates = calculateAreaScore(
      { connectivity: 85, healthcare: 80, education: 75, environment: 70, civicInfrastructure: 80 },
      {
        indicators: [
          {
            id: 'ind-1',
            name: 'Connectivity',
            score: 85,
            weight: 0.20,
            status: 'available',
            summary: 'Recent observation',
            metrics: [
              { label: 'Sample', value: '1', unit: 'node', source: 'Test', date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0] }
            ],
            sources: []
          }
        ]
      }
    );
    expect(withDates.dataFreshnessDays).toBe(3);

    // When indicators have no dates and no override was supplied
    const withoutDates = calculateAreaScore(
      { connectivity: 85 },
      {
        indicators: [
          {
            id: 'ind-2',
            name: 'No date',
            score: 85,
            weight: 0.20,
            status: 'available',
            summary: 'No date',
            metrics: [{ label: 'Sample', value: '1', unit: 'node', source: 'Test', date: '' }],
            sources: []
          }
        ]
      }
    );
    expect(withoutDates.dataFreshnessDays).toBeNull();
  });

  it('returns confidenceScore = null when no source records or tiers are supplied', () => {
    const noSourcesResult = calculateAreaScore(
      { connectivity: 80, healthcare: 80, education: 80, environment: 80, civicInfrastructure: 80 },
      {
        indicators: [
          {
            id: 'ind-3',
            name: 'Bare Indicator',
            score: 80,
            weight: 0.20,
            status: 'available',
            summary: 'No sources attached',
            metrics: [],
            sources: []
          }
        ]
      }
    );
    expect(noSourcesResult.confidenceScore).toBeNull();
  });

  it('reproduces mathematical scores deterministically for Sigra, Lanka and Ramnagar', () => {
    // 1. Sigra mathematical worked reproduction
    const sigraScores: LocalityCategoryScores = {
      connectivity: 91,
      healthcare: 79,
      education: 74,
      environment: 62,
      civicInfrastructure: 81,
      dailyAmenities: 93,
      propertyMarketTransparency: 70,
    };
    const sigraExpected =
      91 * 0.20 + 79 * 0.10 + 74 * 0.10 + 62 * 0.20 + 81 * 0.20 + 93 * 0.10 + 70 * 0.10;
    // 18.2 + 7.9 + 7.4 + 12.4 + 16.2 + 9.3 + 7.0 = 78.4
    expect(parseFloat(sigraExpected.toFixed(1))).toBe(78.4);

    const sigraCalc = calculateAreaScore(sigraScores, { providedIndicatorsCount: 22, totalPossibleIndicators: 24 });
    expect(sigraCalc.overallScore).toBe(78.4);
    expect(sigraCalc.coverageScore).toBe(92);

    // 2. Lanka mathematical worked reproduction
    const lankaScores: LocalityCategoryScores = {
      connectivity: 85,
      healthcare: 96,
      education: 94,
      environment: 72,
      civicInfrastructure: 78,
      dailyAmenities: 92,
      propertyMarketTransparency: 74,
    };
    const lankaExpected =
      85 * 0.20 + 96 * 0.10 + 94 * 0.10 + 72 * 0.20 + 78 * 0.20 + 92 * 0.10 + 74 * 0.10;
    // 17.0 + 9.6 + 9.4 + 14.4 + 15.6 + 9.2 + 7.4 = 82.6
    expect(parseFloat(lankaExpected.toFixed(1))).toBe(82.6);

    const lankaCalc = calculateAreaScore(lankaScores, { providedIndicatorsCount: 23, totalPossibleIndicators: 24 });
    expect(lankaCalc.overallScore).toBe(82.6);
    expect(lankaCalc.coverageScore).toBe(96);

    // 3. Ramnagar mathematical worked reproduction (withheld)
    const ramnagarScores: Partial<LocalityCategoryScores> = {
      connectivity: 56,
      healthcare: null,
      education: null,
      environment: null,
      civicInfrastructure: null,
      dailyAmenities: 62,
      propertyMarketTransparency: null,
    };
    const ramnagarCalc = calculateAreaScore(ramnagarScores, { providedIndicatorsCount: 5, totalPossibleIndicators: 24 });
    expect(ramnagarCalc.coverageScore).toBe(21);
    expect(ramnagarCalc.isEligibleForOverallScore).toBe(false);
    expect(ramnagarCalc.overallScore).toBeNull();
  });
});
