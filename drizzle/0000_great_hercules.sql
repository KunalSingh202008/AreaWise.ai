CREATE TABLE "ai_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer,
	"locality_id" text,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"spoken_script" text,
	"citations" jsonb,
	"warning_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"hindi_name" text,
	"state" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"center_lat" numeric(10, 6) NOT NULL,
	"center_lng" numeric(10, 6) NOT NULL,
	"center_geom" geometry,
	"bounding_box_geom" geometry,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "community_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"locality_id" text NOT NULL,
	"user_id" integer,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"lat" numeric(10, 6),
	"lng" numeric(10, 6),
	"location_geom" geometry,
	"severity" text NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"evidence_url" text,
	"upvotes_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"organization" text NOT NULL,
	"tier" text NOT NULL,
	"update_frequency" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"citation_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence_records" (
	"id" text PRIMARY KEY NOT NULL,
	"locality_id" text NOT NULL,
	"source_id" text NOT NULL,
	"category" text NOT NULL,
	"metric_label" text NOT NULL,
	"metric_value" text NOT NULL,
	"metric_unit" text,
	"observation_date" date NOT NULL,
	"raw_payload" jsonb,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "facilities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"lat" numeric(10, 6) NOT NULL,
	"lng" numeric(10, 6) NOT NULL,
	"location_geom" geometry,
	"address" text NOT NULL,
	"source" text NOT NULL,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"last_verified_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicators" (
	"id" text PRIMARY KEY NOT NULL,
	"locality_id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"score" integer NOT NULL,
	"weight" numeric(4, 2) NOT NULL,
	"status" text NOT NULL,
	"summary" text NOT NULL,
	"metrics" jsonb DEFAULT '[]'::jsonb,
	"sources" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "localities" (
	"id" text PRIMARY KEY NOT NULL,
	"city_id" text NOT NULL,
	"name" text NOT NULL,
	"hindi_name" text,
	"pincode" text NOT NULL,
	"tagline" text NOT NULL,
	"hindi_tagline" text,
	"description" text NOT NULL,
	"hindi_description" text,
	"preview_image" text,
	"center_lat" numeric(10, 6) NOT NULL,
	"center_lng" numeric(10, 6) NOT NULL,
	"center_geom" geometry,
	"is_custom_resolved" boolean DEFAULT false NOT NULL,
	"property_market_data" jsonb,
	"strengths" jsonb DEFAULT '[]'::jsonb,
	"cautions" jsonb DEFAULT '[]'::jsonb,
	"missing_data_notes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locality_boundaries" (
	"id" serial PRIMARY KEY NOT NULL,
	"locality_id" text NOT NULL,
	"coordinates" jsonb NOT NULL,
	"boundary_geom" geometry,
	"area_sq_km" numeric(8, 3),
	"source" text NOT NULL,
	"effective_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"moderator_user_id" integer NOT NULL,
	"action" text NOT NULL,
	"justification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"vote_type" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_localities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"locality_id" text NOT NULL,
	"preferred_profile" text DEFAULT 'overall',
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_methodologies" (
	"version" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_coverage_threshold" numeric(5, 2) DEFAULT '50.00' NOT NULL,
	"min_weight_sum_threshold" numeric(4, 2) DEFAULT '0.60' NOT NULL,
	"max_missing_pillars" integer DEFAULT 3 NOT NULL,
	"weights" jsonb NOT NULL,
	"documentation_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"locality_id" text NOT NULL,
	"methodology_version" text NOT NULL,
	"overall_score" numeric(4, 1),
	"is_eligible_for_overall_score" boolean NOT NULL,
	"coverage_score" integer NOT NULL,
	"confidence_score" integer,
	"data_freshness_days" integer,
	"category_scores" jsonb NOT NULL,
	"missing_categories" jsonb NOT NULL,
	"profile_scores" jsonb NOT NULL,
	"calculated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"uid" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"role" text DEFAULT 'citizen' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid")
);
--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_ai_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."ai_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence_records" ADD CONSTRAINT "evidence_records_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicators" ADD CONSTRAINT "indicators_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "localities" ADD CONSTRAINT "localities_city_id_cities_id_fk" FOREIGN KEY ("city_id") REFERENCES "public"."cities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locality_boundaries" ADD CONSTRAINT "locality_boundaries_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_community_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."community_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_user_id_users_id_fk" FOREIGN KEY ("moderator_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_votes" ADD CONSTRAINT "report_votes_report_id_community_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."community_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_votes" ADD CONSTRAINT "report_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_localities" ADD CONSTRAINT "saved_localities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_localities" ADD CONSTRAINT "saved_localities_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_locality_id_localities_id_fk" FOREIGN KEY ("locality_id") REFERENCES "public"."localities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_methodology_version_score_methodologies_version_fk" FOREIGN KEY ("methodology_version") REFERENCES "public"."score_methodologies"("version") ON DELETE no action ON UPDATE no action;