import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'pamong-ai.db');

// Singleton pattern - reuse connection across hot reloads in dev
const globalForDb = global as unknown as { _db: Database.Database };

const sqlite = globalForDb._db ?? new Database(DB_PATH);

if (process.env.NODE_ENV !== 'production') {
  globalForDb._db = sqlite;
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
