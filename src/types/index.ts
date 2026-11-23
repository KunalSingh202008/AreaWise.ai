/**
 * AreaWise AI - Domain Types
 * Independent Locality Intelligence & Decision Support Platform
 */

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
  verificationStatus: 'verified' | 'official_registry' | 'community_reported' | 'unverified';
  lastVerifiedDate: string | null;
  sourceUrl?: string;
  sourceRecordModifiedOn?: string | null;
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

export interface LocalityCategoryScores {
  connectivity: number | null;
  healthcare: number | null;
  education: number | null;
  environment: number | null;
  civicInfrastructure: number | null;
  dailyAmenities: number | null;
  propertyMarketTransparency: number | null;
}

export interface LocalityScore {
  overallScore: number | null; // null if coverage < 50% or required data missing
  methodologyVersion: string;
  isEligibleForOverallScore: boolean;
  coverageScore: number; // 0 - 100 (% of indicators with data)
  confidenceScore: number | null; // 0 - 100 (reliability of sources and verification, separate from coverage; null if no evidence)
  dataFreshnessDays: number | null; // average age of underlying records in days, null if no dated observations
  lastCalculatedAt: string;
  categoryScores: LocalityCategoryScores;
  missingCategories: string[];
}

export interface ProfileScores {
  familyScore: number | null;
  studentScore: number | null;
  commuterScore: number | null;
  investorScore: number | null;
}

export interface StatutoryCircleRate {
  category: string;
  ratePerSqMeter: number;
  ratePerSqFt: number;
  effectiveYear: string;
  registrationAuthority: string;
  issuingAuthority: string;
  sourceDocumentName: string;
  gazetteRef?: string;
  isVerified: boolean;
  verificationStatus: 'verified_official_gazette' | 'unverified_statutory_benchmark';
}

export interface MarketTransparencyRecord {
  circleRate: StatutoryCircleRate | null;
  transparencyScore: number | null;
  verifiedTransactionRecordsCount: number;
  priceDiscoveryStatus: 'statutory_only' | 'partial_verified_registry' | 'insufficient_evidence';
  guidanceNote: string;
}

export interface GeographySource {
  publisher: string;
  sourceUrl: string;
  recordUrl: string;
  licenseUrl: string;
  importedAt: string;
  recordModifiedOn: string | null;
  snapshotSha256: string;
}

export interface PlaceSummary {
  id: string;
  name: string;
  region: string | null;
  district: string | null;
  pincode: string | null;
  center: Coordinates;
  kind: 'place' | 'administrative' | 'postal';
  source: GeographySource;
}

export interface CoverageCounts {
  places: number;
  postalEntries: number;
  pincodes: number;
  facilities: number;
  reviewedPlaces: number;
  observations: number;
  lastObservationDate: string | null;
}

export interface CatalogueCoverage {
  region: string | null;
  totals: CoverageCounts;
  areas: (CoverageCounts & { name: string | null })[];
  sources: { name: string; sourceUrl: string; licenseUrl: string; importedAt: string }[];
}

export interface PublishedObservation {
  id: string;
  metric: string;
  value: string;
  unit: string | null;
  category: string;
  observationDate: string;
  publisher: string;
  referenceUrl: string;
  licenseUrl: string;
  geographicLevel: string;
  limitations: string;
}

export interface Locality {
  id: string;
  name: string;
  hindiName?: string;
  city: string;
  state: string;
  pincode: string | null;
  center: Coordinates;
  bounds: [number, number][]; // Polygon bounding box
  tagline: string;
  hindiTagline?: string;
  description: string;
  hindiDescription?: string;
  previewImage: string | null;
  scores: LocalityScore;
  profileScores: ProfileScores;
  strengths: string[];
  cautions: string[];
  indicators: CategoryIndicator[];
  facilities: Facility[];
  missingDataNotes: string[];
  propertyMarketData?: MarketTransparencyRecord;
  isCustomResolved?: boolean;
  geography?: PlaceSummary;
  observations?: PublishedObservation[];
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

export interface EvidenceCitation {
  id: string;
  kind: 'catalogue' | 'facility' | 'reviewed_observation';
  source: string;
  url: string;
  licenseUrl: string;
  locality: string;
  observationDate: string | null;
  recordModifiedOn: string | null;
  text: string;
}

export interface CopilotResponse {
  mode: 'gemini' | 'evidence_only';
  providerStatus: 'answered' | 'not_configured' | 'sign_in_required' | 'unavailable';
  answer: string;
  citations: EvidenceCitation[];
  limitations: string[];
  conversationId?: string;
}
