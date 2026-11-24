import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { Pool } from 'pg';
import { parseTestCluster } from './test-db-config';

async function run() {
  const cluster = parseTestCluster();
  const name = 'areawise_test_' + randomUUID().replaceAll('-', '');
  const admin = new Pool({ connectionString: cluster.href, connectionTimeoutMillis: 5000 });
  let created = false;

  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const target = new URL(cluster.href);
    target.pathname = '/' + name;
    process.env.DATABASE_URL = target.href;
    process.env.AREAWISE_RUN_DB_TESTS = '1';

    const { db, pool } = await import('../src/db/index');
    try {
      await pool.query('CREATE EXTENSION IF NOT EXISTS postgis');
      const { migrate } = await import('drizzle-orm/node-postgres/migrator');
      await migrate(db, { migrationsFolder: 'drizzle' });
      const { seedDatabase } = await import('../src/db/seed');
      await seedDatabase();
    } finally {
      await pool.end();
    }

    const child = spawn(process.execPath, [
      'node_modules/vitest/vitest.mjs', 'run', 'db.test.ts', ...process.argv.slice(2),
    ], { stdio: 'inherit', env: process.env });
    const [code] = await once(child, 'exit');
    process.exitCode = code ?? 1;
  } finally {
    try {
      if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    } finally {
      await admin.end();
    }
  }
}

run().catch((error: unknown) => {
  console.error('Isolated database suite failed:', error);
  process.exitCode = 1;
});
