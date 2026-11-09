import { LocalityScore, ProfileScores } from '../src/types';

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

export const METHODOLOGY_VERSION = 'v1.2.0-pilot';

export function updateWeights(newWeights: Partial<CategoryWeights>): CategoryWeights {
  const merged = { ...activeWeights, ...newWeights };
  // Check total sum and normalize to 1.0
  const sum = Object.values(merged).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const key of Object.keys(merged) as (keyof CategoryWeights)[]) {
      merged[key] = parseFloat((merged[key] / sum).toFixed(4));
    }
  }
  activeWeights = merged;
  return activeWeights;
}

export function calculateAreaScore(
  categoryScores: Record<string, number | null>,
  weights: CategoryWeights = activeWeights,
  totalPossibleIndicators = 24,
  providedIndicators = 22,
  tierConfidenceFactors = [0.95, 0.90, 0.85]
): LocalityScore {
  const keys = Object.keys(weights) as (keyof CategoryWeights)[];
  let weightedSum = 0;
  let activeWeightSum = 0;
  const missingCategories: string[] = [];

  for (const k of keys) {
    const val = categoryScores[k];
    if (val !== null && val !== undefined && !isNaN(val)) {
      weightedSum += val * weights[k];
      activeWeightSum += weights[k];
    } else {
      missingCategories.push(k);
    }
  }

  // Coverage score: % of required indicators present
  const coverageScore = Math.min(100, Math.round((providedIndicators / totalPossibleIndicators) * 100));

  // Minimum threshold: If coverage is below 40%, do not compute a deceptive overall score
  const isEligibleForOverallScore = coverageScore >= 40 && activeWeightSum >= 0.40;

  let overallScore: number | null = null;
  if (isEligibleForOverallScore && activeWeightSum > 0) {
    // Renormalize by dividing by activeWeightSum
    overallScore = parseFloat((weightedSum / activeWeightSum).toFixed(1));
    overallScore = Math.min(100, Math.max(0, overallScore));
  }

  // Confidence score: based on source tiers and data density
  const avgTierConfidence = tierConfidenceFactors.reduce((a, b) => a + b, 0) / tierConfidenceFactors.length;
  const confidenceScore = Math.min(100, Math.round(avgTierConfidence * 100 * (0.6 + 0.4 * (coverageScore / 100))));

  return {
    overallScore,
    methodologyVersion: METHODOLOGY_VERSION,
    isEligibleForOverallScore,
    coverageScore,
    confidenceScore,
    dataFreshnessDays: 5,
    lastCalculatedAt: new Date().toISOString(),
    categoryScores: {
      connectivity: categoryScores.connectivity ?? 0,
      healthcare: categoryScores.healthcare ?? 0,
      education: categoryScores.education ?? 0,
      environment: categoryScores.environment ?? 0,
      civicInfrastructure: categoryScores.civicInfrastructure ?? 0,
      dailyAmenities: categoryScores.dailyAmenities ?? 0,
      propertyMarketTransparency: categoryScores.propertyMarketTransparency ?? 0,
    },
    missingCategories,
  };
}

export function calculateProfileScores(categoryScores: Record<string, number>): ProfileScores {
  // Family Score: Heavy emphasis on Education (30%), Healthcare (25%), Environment (20%), Civic (15%), Amenities (10%)
  const familyScore = Math.round(
    (categoryScores.education || 75) * 0.30 +
    (categoryScores.healthcare || 75) * 0.25 +
    (categoryScores.environment || 70) * 0.20 +
    (categoryScores.civicInfrastructure || 75) * 0.15 +
    (categoryScores.dailyAmenities || 80) * 0.10
  );

  // Student Score: Education (35%), Daily Amenities & food (25%), Connectivity (25%), Environment (15%)
  const studentScore = Math.round(
    (categoryScores.education || 75) * 0.35 +
    (categoryScores.dailyAmenities || 80) * 0.25 +
    (categoryScores.connectivity || 75) * 0.25 +
    (categoryScores.environment || 70) * 0.15
  );

  // Commuter Score: Connectivity (45%), Civic (25%), Amenities (15%), Environment (15%)
  const commuterScore = Math.round(
    (categoryScores.connectivity || 75) * 0.45 +
    (categoryScores.civicInfrastructure || 75) * 0.25 +
    (categoryScores.dailyAmenities || 80) * 0.15 +
    (categoryScores.environment || 70) * 0.15
  );

  // Investor Score: Property Market Transparency (40%), Connectivity (25%), Civic (20%), Healthcare (15%)
  const investorScore = Math.round(
    (categoryScores.propertyMarketTransparency || 70) * 0.40 +
    (categoryScores.connectivity || 75) * 0.25 +
    (categoryScores.civicInfrastructure || 75) * 0.20 +
    (categoryScores.healthcare || 75) * 0.15
  );

  return {
    familyScore: Math.min(100, Math.max(0, familyScore)),
    studentScore: Math.min(100, Math.max(0, studentScore)),
    commuterScore: Math.min(100, Math.max(0, commuterScore)),
    investorScore: Math.min(100, Math.max(0, investorScore)),
  };
}
