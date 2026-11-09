/**
 * AreaWise AI - Domain Types
 * Independent Locality Intelligence & Decision Support Platform
 */

export type CityId = 'varanasi';

export type SupportedLanguage = 'en' | 'hi' | 'hinglish';

export interface Coordinates {
  lat: number;
  lng: number;
}

export type FacilityCategory =
  | 'healthcare'
  | 'education'
  | 'transport'
  | 'shopping'
  | 'parks'
  | 'civic'
  | 'environment'
  | 'community_issue';

export interface Facility {
  id: string;
  name: string;
  category: FacilityCategory;
  subcategory: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  address: string;
  source: string;
  verificationStatus: 'verified' | 'official_registry' | 'community_reported';
  lastVerifiedDate: string;
  metadata?: Record<string, any>;
}

export interface CategoryIndicator {
  id: string;
  name: string;
  score: number; // 0 - 100
  weight: number; // e.g. 0.20
  status: 'available' | 'partially_available' | 'unavailable';
  summary: string;
  metrics: {
    label: string;
    value: string | number;
    unit?: string;
    source: string;
    date: string;
  }[];
  sources: {
    name: string;
    organization: string;
    date: string;
    type: 'official_sensor' | 'municipal_record' | 'osm_data' | 'satellite';
  }[];
}

export interface LocalityScore {
  overallScore: number | null; // null if coverage < 40%
  methodologyVersion: string;
  isEligibleForOverallScore: boolean;
  coverageScore: number; // 0 - 100 (% of indicators with data)
  confidenceScore: number; // 0 - 100 (reliability of sources and sample density)
  dataFreshnessDays: number; // average age of underlying records in days
  lastCalculatedAt: string;
  categoryScores: {
    connectivity: number;
    healthcare: number;
    education: number;
    environment: number;
    civicInfrastructure: number;
    dailyAmenities: number;
    propertyMarketTransparency: number;
  };
  missingCategories: string[];
}

export interface ProfileScores {
  familyScore: number;
  studentScore: number;
  commuterScore: number;
  investorScore: number;
}

export interface YearlyMarketTrend {
  year: string; // '2020', '2021', '2022', '2023', '2024', '2025', '2026'
  avgPriceSqFt: number; // in ₹/sq.ft
  rentalYieldPercent: number; // % e.g. 3.8
  infraGrowthIndex: number; // 0-100 scale
  commercialRateSqFt: number; // in ₹/sq.ft
  transactionVolumeIndex: number; // 0-150 relative scale
}

export interface InfrastructureCatalyst {
  year: string;
  title: string;
  description: string;
  impactTier: 'High' | 'Medium' | 'Transformational';
  status: 'completed' | 'under_construction' | 'planned';
}

export interface PropertyMarketData {
  historicalTrends: YearlyMarketTrend[];
  cagr5Year: number; // e.g. 9.4
  currentPriceRange: {
    min: number;
    max: number;
    avg: number;
  };
  rentalRangeMonthly: {
    min: number;
    max: number;
    avg: number;
  };
  investmentPotentialScore: number; // 0-100
  investmentRating: string; // e.g. 'High Growth Node', 'Stable Rental Yield'
  priceToRentalRatio: number; // e.g. 26.5
  infraPipelineScore: number; // 0-100
  catalysts: InfrastructureCatalyst[];
  dataSourceNote: string;
}

export interface Locality {
  id: string;
  name: string;
  hindiName?: string;
  city: string;
  state: string;
  pincode: string;
  center: Coordinates;
  bounds: [number, number][]; // Polygon bounding box
  tagline: string;
  hindiTagline?: string;
  description: string;
  hindiDescription?: string;
  previewImage: string;
  scores: LocalityScore;
  profileScores: ProfileScores;
  strengths: string[];
  cautions: string[];
  indicators: CategoryIndicator[];
  facilities: Facility[];
  missingDataNotes: string[];
  propertyMarketData?: PropertyMarketData;
  isCustomResolved?: boolean;
}

export interface CommunityReport {
  id: string;
  localityId: string;
  localityName: string;
  title: string;
  category: 'roads' | 'drainage' | 'water_supply' | 'street_lighting' | 'waste' | 'air_noise';
  description: string;
  lat: number;
  lng: number;
  imageUrl?: string;
  status: 'under_review' | 'verified' | 'action_taken' | 'rejected';
  submittedBy: string;
  submittedAt: string;
  upvotes: number;
  officialResponse?: string;
}

export interface DataSourceStatus {
  id: string;
  name: string;
  category: string;
  coverage: string;
  lastSync: string;
  status: 'healthy' | 'lagging' | 'degraded';
  reliabilityTier: 'Tier 1 (Statutory/Official)' | 'Tier 2 (Municipal)' | 'Tier 3 (Geospatial/Open)';
  apiEndpoint: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'citizen' | 'student' | 'consultant' | 'admin';
  savedLocalityIds: string[];
  savedComparisonIds: string[];
  preferredProfile: 'family' | 'student' | 'commuter' | 'investor';
  language: SupportedLanguage;
}

export interface AICitation {
  source: string;
  date: string;
  locality: string;
  confidence: string;
  metric: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  spokenScript?: string;
  timestamp: string;
  citations?: AICitation[];
  warningNote?: string;
  keyFindings?: string[];
  dataFreshness?: string;
  limitations?: string[];
  suggestedNextSteps?: string[];
}
