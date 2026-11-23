CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TABLE dataset_imports (
  id text PRIMARY KEY,
  dataset text NOT NULL,
  source_id text NOT NULL REFERENCES data_sources(id) ON DELETE RESTRICT,
  original_url text NOT NULL,
  license_url text NOT NULL,
  content_sha256 text NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now(),
  row_count integer NOT NULL CHECK (row_count > 0),
  active boolean NOT NULL DEFAULT false,
  UNIQUE (dataset, content_sha256)
);
--> statement-breakpoint
CREATE UNIQUE INDEX dataset_imports_active_idx ON dataset_imports (dataset) WHERE active;
--> statement-breakpoint
CREATE TABLE geo_places (
  import_id text NOT NULL REFERENCES dataset_imports(id) ON DELETE CASCADE,
  place_id text NOT NULL,
  name text NOT NULL,
  search_text text NOT NULL,
  state text,
  district text,
  pincode text,
  feature_code text NOT NULL,
  facility_category text,
  position geography(Point,4326) NOT NULL,
  population bigint NOT NULL DEFAULT 0,
  modified_on date,
  PRIMARY KEY (import_id, place_id)
);
--> statement-breakpoint
CREATE INDEX geo_places_id_idx ON geo_places (place_id);
--> statement-breakpoint
CREATE INDEX geo_places_pin_idx ON geo_places (pincode) WHERE pincode IS NOT NULL;
--> statement-breakpoint
CREATE INDEX geo_places_search_idx ON geo_places USING gin (search_text gin_trgm_ops) WHERE facility_category IS NULL;
--> statement-breakpoint
CREATE INDEX geo_places_position_idx ON geo_places USING gist (position);
--> statement-breakpoint
CREATE INDEX geo_places_facility_idx ON geo_places USING gist (position) WHERE facility_category IS NOT NULL;
--> statement-breakpoint
CREATE INDEX geo_places_featured_idx ON geo_places (population DESC) WHERE feature_code IN ('PPLC', 'PPLA');
--> statement-breakpoint
CREATE TABLE evidence_publications (
  evidence_id text PRIMARY KEY REFERENCES evidence_records(id) ON DELETE RESTRICT,
  reference_url text NOT NULL CHECK (reference_url LIKE 'https://%'),
  license_url text NOT NULL CHECK (license_url LIKE 'https://%'),
  geographic_level text NOT NULL,
  limitations text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by text NOT NULL
);
