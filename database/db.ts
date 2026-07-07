import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  conn: Pool | undefined;
};

const pool = globalForDb.conn ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 5000,
});

if (process.env.NODE_ENV !== 'production') globalForDb.conn = pool;

export const db = drizzle(pool, { schema });
