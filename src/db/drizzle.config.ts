import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost) {
  throw new Error('SQL_HOST must be set in environment variables.');
}
if (!sqlDbName) {
  throw new Error('SQL_DB_NAME must be set in environment variables.');
}
if (!user) {
  throw new Error('SQL_ADMIN_USER must be set in environment variables.');
}
if (!password) {
  throw new Error('SQL_ADMIN_PASSWORD must be set in environment variables.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  tablesFilter: [
    'users',
    'cities',
    'localities',
    'locality_boundaries',
    'data_sources',
    'evidence_records',
    'indicators',
    'facilities',
    'score_methodologies',
    'score_snapshots',
    'community_reports',
    'report_votes',
    'moderation_actions',
    'saved_localities',
    'ai_conversations',
    'ai_messages',
    'audit_logs',
  ],
  dbCredentials: {
    host: sqlHost,
    user: user,
    password: password,
    database: sqlDbName,
    ssl: false,
  },
  verbose: true,
});

