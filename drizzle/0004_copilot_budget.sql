CREATE TABLE service_usage_daily (
  usage_day date NOT NULL,
  operation text NOT NULL,
  used integer NOT NULL CHECK (used >= 0),
  PRIMARY KEY (usage_day, operation)
);
--> statement-breakpoint
CREATE INDEX ai_conversations_owner_idx ON ai_conversations (user_id, created_at DESC);
