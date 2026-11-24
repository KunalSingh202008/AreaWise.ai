CREATE TABLE research_workspaces (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE research_members (
  workspace_id uuid NOT NULL REFERENCES research_workspaces (id) ON DELETE CASCADE,
  user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  PRIMARY KEY (workspace_id, user_id)
);
--> statement-breakpoint
CREATE INDEX research_members_user_idx ON research_members (user_id, workspace_id);
--> statement-breakpoint
CREATE TABLE research_projects (
  id uuid PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES research_workspaces (id) ON DELETE CASCADE,
  name text NOT NULL,
  place_ids text[] NOT NULL CHECK (cardinality(place_ids) BETWEEN 2 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX research_projects_workspace_idx ON research_projects (workspace_id, created_at DESC);
--> statement-breakpoint
CREATE TABLE research_invites (
  token_sha256 text PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES research_workspaces (id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('editor', 'viewer')),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz
);
