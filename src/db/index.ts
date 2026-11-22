import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

// Global connection pool caching across dev hot-reloads
declare global {
  var _postgresPool: Pool | undefined;
}

// Function to create or retrieve the connection pool (Object Method)
export const createPool = (): Pool => {
  if (!global._postgresPool) {
    const connection = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL }
      : {
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
        };
    global._postgresPool = new Pool({
      ...connection,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 8000,
    });

    // Prevent unhandled pool-level errors from crashing the application
    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Create or retrieve the pool instance lazily
export const pool = createPool();

// Initialize Drizzle with the pool and schema
export const db = drizzle(pool, { schema });
