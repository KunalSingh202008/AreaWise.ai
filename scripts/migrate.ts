import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from '../src/db';

try {
  if (process.argv[2] !== '--apply' || !process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL to the reviewed target and run npm run db:migrate -- --apply.');
  }
  const result = await pool.query<{ installed: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed",
  );
  if (!result.rows[0]?.installed) {
    throw new Error('PostGIS must be enabled on this database by its administrator before migrations.');
  }
  await migrate(db, { migrationsFolder: 'drizzle' });
  console.log('AreaWise migrations applied.');
} finally {
  await pool.end();
}
