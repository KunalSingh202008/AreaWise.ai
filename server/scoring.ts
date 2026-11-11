import { LocalityScore, ProfileScores, CategoryIndicator, LocalityCategoryScores } from '../src/types';

export interface CategoryWeights {
  connectivity: number;
  healthcare: number;
  education: number;
  environment: number;
  civicInfrastructure: number;
  dailyAmenities: number;
  propertyMarketTransparency: number;
}

export let activeWeights: CategoryWeights = {
  connectivity: 0.20,
  healthcare: 0.10,
  education: 0.10,
  environment: 0.20,
  civicInfrastructure: 0.20,
  dailyAmenities: 0.10,
  propertyMarketTransparency: 0.10,
};

export const METHODOLOGY_VERSION = 'v1.3.0-evidence-grounded';
export const BENCHMARK_INDICATORS_COUNT = 24;
export const MIN_COVERAGE_THRESHOLD = 50; // Percentage
export const MIN_WEIGHT_SUM_THRESHOLD = 0.60; // 60% of pillar weights required

export function updateWeights(newWeights: Partial<CategoryWeights>): CategoryWeights {
  const merged = { ...activeWeights, ...newWeights };
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const key of Object.keys(merged) as (keyof CategoryWeights)[]) {
      merged[key] = parseFloat((merged[key] / sum).toFixed(4));
    }
  }
  activeWeights = merged;
  return activeWeights;
}

export interface ScoreOptions {
  weights?: CategoryWeights;
  indicators?: CategoryIndicator[];
  totalPossibleIndicators?: number;
  providedIndicatorsCount?: number;
  sourceTiers?: ('official_sensor' | 'municipal_record' | 'osm_data' | 'satellite' | 'community')[];
  dataFreshnessDays?: number;
}

/**
 * Calculates evidence-grounded AreaScore.
 * Strict rules:
 * 1. Missing categories are NEVER converted to zero.
 * 2. Coverage is computed from actual indicator count or observed category availability.
 * 3. Confidence is calculated separately from coverage, based purely on source verification tiers & recency.
 * 4. Overall score is strictly WITHHELD (null) when coverage < 50% or active weight < 0.60.
 */
export function calculateAreaScore(
  categoryScores: Partial<LocalityCategoryScores>,
  options: ScoreOptions = {}
): LocalityScore {
  const weights = options.weights || activeWeights;
  const keys = Object.keys(weights) as (keyof CategoryWeights)[];

  let weightedSum = 0;
  let activeWeightSum = 0;
  const missingCategories: string[] = [];

  const normalizedCategoryScores: LocalityCategoryScores = {
    connectivity: null,
    healthcare: null,
    education: null,
    environment: null,
    civicInfrastructure: null,
    dailyAmenities: null,
    propertyMarketTransparency: null,
  };

  for (const k of keys) {
    const val = categoryScores[k];
    if (val !== null && val !== undefined && typeof val === 'number' && !isNaN(val)) {
      const clamped = Math.min(100, Math.max(0, Math.round(val)));
      normalizedCategoryScores[k] = clamped;
      weightedSum += clamped * weights[k];
      activeWeightSum += weights[k];
    } else {
      normalizedCategoryScores[k] = null;
      missingCategories.push(k);
    }
  }

  // Strict Evidence Audit: If an indicators array is provided, verify category support
  if (Array.isArray(options.indicators)) {
    if (options.indicators.length === 0) {
      // Empty evidence array: No category can claim evidence backing
      for (const k of keys) {
        normalizedCategoryScores[k] = null;
        if (!missingCategories.includes(k)) {
          missingCategories.push(k);
        }
      }
      weightedSum = 0;
      activeWeightSum = 0;
    }
  }

  // Calculate Coverage from actual indicator availability
  let coverageScore: number;
  if (Array.isArray(options.indicators)) {
    const availableIndicators = options.indicators.filter(
      (ind) => ind.status === 'available' || ind.status === 'partially_available'
    ).length;
    const totalPossible = options.totalPossibleIndicators || BENCHMARK_INDICATORS_COUNT;
    coverageScore = Math.min(100, Math.max(0, Math.round((availableIndicators / totalPossible) * 100)));
  } else if (typeof options.providedIndicatorsCount === 'number') {
    const totalPossible = options.totalPossibleIndicators || BENCHMARK_INDICATORS_COUNT;
    coverageScore = Math.min(100, Math.max(0, Math.round((options.providedIndicatorsCount / totalPossible) * 100)));
  } else {
    // Fall back to actual available category ratio
    const availableCats = keys.length - missingCategories.length;
    coverageScore = Math.min(100, Math.max(0, Math.round((availableCats / keys.length) * 100)));
  }

  // Calculate Confidence strictly based on source verification tier reliability (independent of completeness)
  const tierWeights: Record<string, number> = {
    official_sensor: 0.96,
    official_registry: 0.94,
    municipal_record: 0.92,
    satellite: 0.90,
    osm_data: 0.88,
    verified: 0.88,
    community: 0.60,
  };

  let confidenceScore: number | null = null;
  if (options.sourceTiers && options.sourceTiers.length > 0) {
    const sumTiers = options.sourceTiers.reduce((acc, tier) => acc + (tierWeights[tier] || 0.70), 0);
    const avgTier = sumTiers / options.sourceTiers.length;
    confidenceScore = Math.min(100, Math.max(0, Math.round(avgTier * 100)));
  } else if (options.indicators && options.indicators.length > 0) {
    const allSources = options.indicators.flatMap((ind) => ind.sources);
    if (allSources.length > 0) {
      const sumTiers = allSources.reduce((acc, s) => acc + (tierWeights[s.type] || 0.70), 0);
      confidenceScore = Math.min(100, Math.max(0, Math.round((sumTiers / allSources.length) * 100)));
    } else {
      confidenceScore = null; // No verifiable sources attached
    }
  } else {
    confidenceScore = null; // No evidence records provided to assess confidence
  }

  // Calculate Data Freshness from actual observation timestamps
  let dataFreshnessDays: number | null = null;
  if (typeof options.dataFreshnessDays === 'number') {
    dataFreshnessDays = options.dataFreshnessDays;
  } else if (options.indicators && options.indicators.length > 0) {
    const dates: number[] = [];
    for (const ind of options.indicators) {
      for (const m of ind.metrics) {
        if (m.date) {
          const t = new Date(m.date).getTime();
          if (!isNaN(t)) dates.push(t);
        }
      }
      for (const s of ind.sources) {
        if (s.date) {
          const t = new Date(s.date).getTime();
          if (!isNaN(t)) dates.push(t);
        }
      }
    }
    if (dates.length > 0) {
      const latestTimestamp = Math.max(...dates);
      const elapsedMs = Math.max(0, Date.now() - latestTimestamp);
      dataFreshnessDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
    }
  }

  /**
   * AreaScore Withholding Policy:
   * 1. Coverage Threshold (MIN_COVERAGE_THRESHOLD = 50%):
   *    If fewer than 50% of core indicators are verified/available, overall AreaScore is WITHHELD.
   * 2. Active Weight Threshold (MIN_WEIGHT_SUM_THRESHOLD = 0.60):
   *    If observed categories represent less than 60% of total domain weight, composite score is WITHHELD.
   * 3. Missing Categories Limit:
   *    If more than 3 of the 7 core pillars are completely unobserved, composite score is WITHHELD.
   */
  const isEligibleForOverallScore =
    coverageScore >= MIN_COVERAGE_THRESHOLD &&
    activeWeightSum >= MIN_WEIGHT_SUM_THRESHOLD &&
    missingCategories.length <= 3;

  let overallScore: number | null = null;
  if (isEligibleForOverallScore && activeWeightSum > 0) {
    overallScore = parseFloat((weightedSum / activeWeightSum).toFixed(1));
    overallScore = Math.min(100, Math.max(0, overallScore));
  }

  return {
    overallScore,
    methodologyVersion: METHODOLOGY_VERSION,
    isEligibleForOverallScore,
    coverageScore,
    confidenceScore,
    dataFreshnessDays,
    lastCalculatedAt: new Date().toISOString(),
    categoryScores: normalizedCategoryScores,
    missingCategories,
  };
}

/**
 * Calculates persona scores.
 * Critical requirement: If required categories for a profile are missing/null,
 * the profile score MUST be null (never assume 75, 70, or 80!).
 */
export function calculateProfileScores(categoryScores: Partial<LocalityCategoryScores>): ProfileScores {
  // 1. Family Score: Requires Education, Healthcare, Environment
  let familyScore: number | null = null;
  const famEdu = categoryScores.education;
  const famHealth = categoryScores.healthcare;
  const famEnv = categoryScores.environment;
  const famCivic = categoryScores.civicInfrastructure;
  const famAmenities = categoryScores.dailyAmenities;

  // Strict check: if any of the primary family pillars is missing, score is unrated (null)
  if (
    famEdu !== null && famEdu !== undefined &&
    famHealth !== null && famHealth !== undefined &&
    famEnv !== null && famEnv !== undefined
  ) {
    let weightSum = 0.30 + 0.25 + 0.20;
    let sum = famEdu * 0.30 + famHealth * 0.25 + famEnv * 0.20;

    if (famCivic !== null && famCivic !== undefined) {
      sum += famCivic * 0.15;
      weightSum += 0.15;
    }
    if (famAmenities !== null && famAmenities !== undefined) {
      sum += famAmenities * 0.10;
      weightSum += 0.10;
    }
    familyScore = Math.round(sum / weightSum);
  }

  // 2. Student Score: Requires Education, Daily Amenities, Connectivity
  let studentScore: number | null = null;
  const stuEdu = categoryScores.education;
  const stuAmen = categoryScores.dailyAmenities;
  const stuConn = categoryScores.connectivity;
  const stuEnv = categoryScores.environment;

  if (
    stuEdu !== null && stuEdu !== undefined &&
    stuAmen !== null && stuAmen !== undefined &&
    stuConn !== null && stuConn !== undefined
  ) {
    let weightSum = 0.35 + 0.25 + 0.25;
    let sum = stuEdu * 0.35 + stuAmen * 0.25 + stuConn * 0.25;

    if (stuEnv !== null && stuEnv !== undefined) {
      sum += stuEnv * 0.15;
      weightSum += 0.15;
    }
    studentScore = Math.round(sum / weightSum);
  }

  // 3. Commuter Score: Requires Connectivity, Civic Infrastructure
  let commuterScore: number | null = null;
  const comConn = categoryScores.connectivity;
  const comCivic = categoryScores.civicInfrastructure;
  const comAmen = categoryScores.dailyAmenities;
  const comEnv = categoryScores.environment;

  if (
    comConn !== null && comConn !== undefined &&
    comCivic !== null && comCivic !== undefined
  ) {
    let weightSum = 0.45 + 0.25;
    let sum = comConn * 0.45 + comCivic * 0.25;

    if (comAmen !== null && comAmen !== undefined) {
      sum += comAmen * 0.15;
      weightSum += 0.15;
    }
    if (comEnv !== null && comEnv !== undefined) {
      sum += comEnv * 0.15;
      weightSum += 0.15;
    }
    commuterScore = Math.round(sum / weightSum);
  }

  // 4. Investor Score: Requires Property Market Transparency, Connectivity
  let investorScore: number | null = null;
  const invProp = categoryScores.propertyMarketTransparency;
  const invConn = categoryScores.connectivity;
  const invCivic = categoryScores.civicInfrastructure;
  const invHealth = categoryScores.healthcare;

  if (
    invProp !== null && invProp !== undefined &&
    invConn !== null && invConn !== undefined
  ) {
    let weightSum = 0.40 + 0.25;
    let sum = invProp * 0.40 + invConn * 0.25;

    if (invCivic !== null && invCivic !== undefined) {
      sum += invCivic * 0.20;
      weightSum += 0.20;
    }
    if (invHealth !== null && invHealth !== undefined) {
      sum += invHealth * 0.15;
      weightSum += 0.15;
    }
    investorScore = Math.round(sum / weightSum);
  }

  return {
    familyScore,
    studentScore,
    commuterScore,
    investorScore,
  };
}
