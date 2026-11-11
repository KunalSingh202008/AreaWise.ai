import { relations } from 'drizzle-orm';
import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  smallint,
  customType,
  index,
  unique,
} from 'drizzle-orm/pg-core';

// Custom PostGIS Geometry Column Definition for Drizzle
export const geometry = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'geometry';
  },
});

// 1. users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  displayName: text('display_name'),
  role: text('role').notNull().default('citizen'), // 'citizen', 'analyst', 'moderator', 'admin'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. cities
export const cities = pgTable('cities', {
  id: text('id').primaryKey(), // 'varanasi'
  name: text('name').notNull(),
  hindiName: text('hindi_name'),
  state: text('state').notNull(),
  country: text('country').notNull().default('India'),
  centerLat: numeric('center_lat', { precision: 10, scale: 6 }).notNull(),
  centerLng: numeric('center_lng', { precision: 10, scale: 6 }).notNull(),
  centerGeom: geometry('center_geom'),
  boundingBoxGeom: geometry('bounding_box_geom'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_cities_center_geom').using('gist', table.centerGeom),
]);

// 3. localities
export const localities = pgTable('localities', {
  id: text('id').primaryKey(), // 'sigra', 'lanka'
  cityId: text('city_id').notNull().references(() => cities.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  hindiName: text('hindi_name'),
  pincode: text('pincode').notNull(),
  tagline: text('tagline').notNull(),
  hindiTagline: text('hindi_tagline'),
  description: text('description').notNull(),
  hindiDescription: text('hindi_description'),
  previewImage: text('preview_image'),
  centerLat: numeric('center_lat', { precision: 10, scale: 6 }).notNull(),
  centerLng: numeric('center_lng', { precision: 10, scale: 6 }).notNull(),
  centerGeom: geometry('center_geom'),
  isCustomResolved: boolean('is_custom_resolved').notNull().default(false),
  propertyMarketData: jsonb('property_market_data'),
  strengths: jsonb('strengths').$type<string[]>().default([]),
  cautions: jsonb('cautions').$type<string[]>().default([]),
  missingDataNotes: jsonb('missing_data_notes').$type<string[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_localities_center_geom').using('gist', table.centerGeom),
]);

// 4. locality_boundaries
export const localityBoundaries = pgTable('locality_boundaries', {
  id: serial('id').primaryKey(),
  localityId: text('locality_id').notNull().references(() => localities.id, { onDelete: 'cascade' }),
  coordinates: jsonb('coordinates').$type<[number, number][]>().notNull(),
  boundaryGeom: geometry('boundary_geom'),
  areaSqKm: numeric('area_sq_km', { precision: 8, scale: 3 }),
  source: text('source').notNull(),
  effectiveDate: date('effective_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('locality_boundaries_locality_id_unique').on(table.localityId),
  index('idx_locality_boundaries_geom').using('gist', table.boundaryGeom),
]);

// 5. data_sources
export const dataSources = pgTable('data_sources', {
  id: text('id').primaryKey(), // 'cpcb-caaqms'
  name: text('name').notNull(),
  organization: text('organization').notNull(),
  tier: text('tier').notNull(), // 'official_sensor', 'official_registry', 'municipal_record', 'satellite', 'osm_data', 'verified', 'community'
  updateFrequency: text('update_frequency').notNull(),
  isVerified: boolean('is_verified').notNull().default(false),
  citationUrl: text('citation_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. evidence_records
export const evidenceRecords = pgTable('evidence_records', {
  id: text('id').primaryKey(),
  localityId: text('locality_id').notNull().references(() => localities.id, { onDelete: 'cascade' }),
  sourceId: text('source_id').notNull().references(() => dataSources.id, { onDelete: 'restrict' }),
  category: text('category').notNull(), // 'connectivity', 'healthcare', etc.
  metricLabel: text('metric_label').notNull(),
  metricValue: text('metric_value').notNull(),
  metricUnit: text('metric_unit'),
  observationDate: date('observation_date').notNull(),
  rawPayload: jsonb('raw_payload'),
  verificationStatus: text('verification_status').notNull().default('unverified'), // 'verified', 'unverified', 'disputed'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_evidence_locality_cat').on(table.localityId, table.category),
]);

// 7. indicators
export const indicators = pgTable('indicators', {
  id: text('id').primaryKey(), // 'conn-sigra'
  localityId: text('locality_id').notNull().references(() => localities.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  name: text('name').notNull(),
  score: integer('score').notNull(),
  weight: numeric('weight', { precision: 4, scale: 2 }).notNull(),
  status: text('status').notNull(), // 'available', 'partially_available', 'withheld', 'pending'
  summary: text('summary').notNull(),
  metrics: jsonb('metrics').$type<{ label: string; value: string; unit?: string; source?: string; date?: string }[]>().default([]),
  sources: jsonb('sources').$type<{ name: string; organization: string; date?: string; type: string }[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_indicators_locality').on(table.localityId),
]);

// 8. facilities
export const facilities = pgTable('facilities', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category').notNull(), // 'healthcare', 'education', 'transport', 'parks', 'shopping', 'civic'
  subcategory: text('subcategory').notNull(),
  lat: numeric('lat', { precision: 10, scale: 6 }).notNull(),
  lng: numeric('lng', { precision: 10, scale: 6 }).notNull(),
  locationGeom: geometry('location_geom'),
  address: text('address').notNull(),
  source: text('source').notNull(),
  verificationStatus: text('verification_status').notNull().default('unverified'),
  lastVerifiedDate: date('last_verified_date'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_facilities_location_geom').using('gist', table.locationGeom),
]);

// 9. score_methodologies
export const scoreMethodologies = pgTable('score_methodologies', {
  version: text('version').primaryKey(), // 'v1.3.0-evidence-grounded'
  name: text('name').notNull(),
  minCoverageThreshold: numeric('min_coverage_threshold', { precision: 5, scale: 2 }).notNull().default('50.00'),
  minWeightSumThreshold: numeric('min_weight_sum_threshold', { precision: 4, scale: 2 }).notNull().default('0.60'),
  maxMissingPillars: integer('max_missing_pillars').notNull().default(3),
  weights: jsonb('weights').notNull(),
  documentationUrl: text('documentation_url'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 10. score_snapshots
export const scoreSnapshots = pgTable('score_snapshots', {
  id: serial('id').primaryKey(),
  localityId: text('locality_id').notNull().references(() => localities.id, { onDelete: 'cascade' }),
  methodologyVersion: text('methodology_version').notNull().references(() => scoreMethodologies.version),
  overallScore: numeric('overall_score', { precision: 4, scale: 1 }), // NULL if withheld
  isEligibleForOverallScore: boolean('is_eligible_for_overall_score').notNull(),
  coverageScore: integer('coverage_score').notNull(),
  confidenceScore: integer('confidence_score'),
  dataFreshnessDays: integer('data_freshness_days'),
  categoryScores: jsonb('category_scores').notNull(), // Preserves nulls strictly
  missingCategories: jsonb('missing_categories').$type<string[]>().notNull(),
  profileScores: jsonb('profile_scores').notNull(), // Family, Student, Commuter, Investor
  calculatedAt: timestamp('calculated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  unique('score_snapshots_locality_methodology_unique').on(table.localityId, table.methodologyVersion),
  index('idx_score_snapshots_locality').on(table.localityId, table.calculatedAt.desc()),
]);

// 11. community_reports
export const communityReports = pgTable('community_reports', {
  id: text('id').primaryKey(),
  localityId: text('locality_id').notNull().references(() => localities.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'set null' }),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  lat: numeric('lat', { precision: 10, scale: 6 }),
  lng: numeric('lng', { precision: 10, scale: 6 }),
  locationGeom: geometry('location_geom'),
  severity: text('severity').notNull(), // 'low', 'medium', 'high', 'critical'
  status: text('status').notNull().default('submitted'), // 'submitted', 'under_review', 'verified', 'resolved', 'rejected', 'action_taken'
  evidenceUrl: text('evidence_url'),
  upvotesCount: integer('upvotes_count').notNull().default(0),
  officialResponse: text('official_response'),
  submittedBy: text('submitted_by').default('Verified Local Resident'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_community_reports_location_geom').using('gist', table.locationGeom),
  index('idx_community_reports_locality').on(table.localityId, table.status),
]);

// 12. report_votes
export const reportVotes = pgTable('report_votes', {
  id: serial('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => communityReports.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  voterToken: text('voter_token'),
  voteType: smallint('vote_type').notNull(), // -1 or 1
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 13. moderation_actions
export const moderationActions = pgTable('moderation_actions', {
  id: serial('id').primaryKey(),
  reportId: text('report_id').notNull().references(() => communityReports.id, { onDelete: 'cascade' }),
  moderatorUserId: integer('moderator_user_id').references(() => users.id),
  moderatorName: text('moderator_name'),
  action: text('action').notNull(), // 'approved', 'rejected', 'flagged', 'escalated', 'status_update'
  justification: text('justification').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 14. saved_localities
export const savedLocalities = pgTable('saved_localities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  userToken: text('user_token'),
  localityId: text('locality_id').notNull().references(() => localities.id, { onDelete: 'cascade' }),
  preferredProfile: text('preferred_profile').default('overall'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 15. ai_conversations
export const aiConversations = pgTable('ai_conversations', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  localityId: text('locality_id').references(() => localities.id, { onDelete: 'set null' }),
  comparisonIds: jsonb('comparison_ids').$type<string[]>(),
  language: text('language').notNull().default('en'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 16. ai_messages
export const aiMessages = pgTable('ai_messages', {
  id: serial('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => aiConversations.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  spokenScript: text('spoken_script'),
  citations: jsonb('citations'),
  warningNote: text('warning_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_ai_messages_conversation').on(table.conversationId, table.createdAt.asc()),
]);

// 17. audit_logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  action: text('action').notNull(),
  actor: text('actor').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  details: jsonb('details'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_audit_logs_created_at').on(table.createdAt.desc()),
]);

// Relations
export const citiesRelations = relations(cities, ({ many }) => ({
  localities: many(localities),
}));

export const localitiesRelations = relations(localities, ({ one, many }) => ({
  city: one(cities, { fields: [localities.cityId], references: [cities.id] }),
  boundaries: many(localityBoundaries),
  indicators: many(indicators),
  evidenceRecords: many(evidenceRecords),
  scoreSnapshots: many(scoreSnapshots),
  communityReports: many(communityReports),
}));

export const usersRelations = relations(users, ({ many }) => ({
  communityReports: many(communityReports),
  savedLocalities: many(savedLocalities),
  aiConversations: many(aiConversations),
}));
