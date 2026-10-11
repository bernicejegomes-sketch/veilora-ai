import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { SCHEMA_SQL } from './schema.js';
import { runMigrations } from './migrations.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function resolveDatabasePath(customPath = null) {
  if (customPath) {
    if (customPath === ':memory:') {
      return ':memory:';
    }
    return path.resolve(customPath);
  }

  if (process.env.DATABASE_PATH) {
    if (process.env.DATABASE_PATH === ':memory:') {
      return ':memory:';
    }
    return path.resolve(process.env.DATABASE_PATH);
  }

  // Sensible local development default inside backend: backend/data/incognito.db
  const backendRoot = path.resolve(__dirname, '..', '..');
  return path.join(backendRoot, 'data', 'incognito.db');
}

let dbInstance = null;

export function initDatabase(customPath = null) {
  const dbPath = resolveDatabasePath(customPath);

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Configure SQLite pragmas
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  // Initialize schema
  db.exec(SCHEMA_SQL);

  // Apply versioned, idempotent migrations (drops legacy per-submission storage)
  runMigrations(db);

  dbInstance = db;
  return db;
}

export function getDatabase() {
  if (!dbInstance || !dbInstance.open) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

export function closeDatabase(db = null) {
  const target = db || dbInstance;
  if (target && target.open) {
    target.close();
  }
  if (!db || db === dbInstance) {
    dbInstance = null;
  }
}
