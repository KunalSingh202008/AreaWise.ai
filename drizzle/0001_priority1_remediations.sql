-- AreaWise AI Migration: 0001_priority1_remediations.sql
-- Phase 2B.2 Priority 1 Remediations: Unique constraints, spatial indexes, and functional geography index

-- 1. Schema Enhancements & Missing Columns
ALTER TABLE "community_reports" 
  ADD COLUMN IF NOT EXISTS "official_response" text,
  ADD COLUMN IF NOT EXISTS "submitted_by" text DEFAULT 'Verified Local Resident';
--> statement-breakpoint

ALTER TABLE "report_votes" 
  ADD COLUMN IF NOT EXISTS "voter_token" text;
--> statement-breakpoint

ALTER TABLE "moderation_actions" 
  ADD COLUMN IF NOT EXISTS "moderator_name" text;
--> statement-breakpoint

ALTER TABLE "saved_localities" 
  ADD COLUMN IF NOT EXISTS "user_token" text;
--> statement-breakpoint

ALTER TABLE "ai_conversations" 
  ADD COLUMN IF NOT EXISTS "comparison_ids" jsonb;
--> statement-breakpoint

ALTER TABLE "report_votes" 
  ALTER COLUMN "user_id" DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE "moderation_actions" 
  ALTER COLUMN "moderator_user_id" DROP NOT NULL;
--> statement-breakpoint

-- 2. Deduplicate & Add Unique Constraints
ALTER TABLE "locality_boundaries" 
  DROP CONSTRAINT IF EXISTS "locality_boundaries_locality_id_unique",
  ADD CONSTRAINT "locality_boundaries_locality_id_unique" UNIQUE ("locality_id");
--> statement-breakpoint

ALTER TABLE "score_snapshots" 
  DROP CONSTRAINT IF EXISTS "score_snapshots_locality_methodology_unique",
  ADD CONSTRAINT "score_snapshots_locality_methodology_unique" UNIQUE ("locality_id", "methodology_version");
--> statement-breakpoint

-- 2. Spatial GIST Indexes
CREATE INDEX IF NOT EXISTS "idx_facilities_location_geom" ON "facilities" USING gist ("location_geom");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_facilities_location_geog" ON "facilities" USING gist ((("location_geom")::geography));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_locality_boundaries_geom" ON "locality_boundaries" USING gist ("boundary_geom");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_localities_center_geom" ON "localities" USING gist ("center_geom");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_cities_center_geom" ON "cities" USING gist ("center_geom");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_reports_location_geom" ON "community_reports" USING gist ("location_geom");
--> statement-breakpoint

-- 3. Compound and Performance B-Tree Indexes
CREATE INDEX IF NOT EXISTS "idx_evidence_locality_cat" ON "evidence_records" ("locality_id", "category");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_score_snapshots_locality" ON "score_snapshots" ("locality_id", "calculated_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_indicators_locality" ON "indicators" ("locality_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_community_reports_locality" ON "community_reports" ("locality_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_audit_logs_created_at" ON "audit_logs" ("created_at" DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ai_messages_conversation" ON "ai_messages" ("conversation_id", "created_at" ASC);
