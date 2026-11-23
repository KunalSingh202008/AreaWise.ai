ALTER TABLE users
  ADD COLUMN IF NOT EXISTS locale text NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_profile text NOT NULL DEFAULT 'family';
--> statement-breakpoint
CREATE UNIQUE INDEX saved_localities_account_idx ON saved_localities (user_id, locality_id)
  WHERE user_id IS NOT NULL AND locality_id LIKE 'geo-%' OR user_id IS NOT NULL AND locality_id LIKE 'pin-%';
--> statement-breakpoint
CREATE UNIQUE INDEX report_votes_account_idx ON report_votes (report_id, user_id) WHERE user_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX community_reports_account_idx ON community_reports (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE account_comparisons (
  id uuid PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  place_ids text[] NOT NULL CHECK (cardinality(place_ids) BETWEEN 2 AND 5),
  saved_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX account_comparisons_user_idx ON account_comparisons (user_id, saved_at DESC);
--> statement-breakpoint
CREATE TABLE account_usage_daily (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_day date NOT NULL,
  operation text NOT NULL,
  used integer NOT NULL CHECK (used >= 0),
  PRIMARY KEY (user_id, usage_day, operation)
);
