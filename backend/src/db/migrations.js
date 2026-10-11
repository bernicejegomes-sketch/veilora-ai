/**
 * Versioned, idempotent SQLite schema migrations for Incognito.
 *
 * Migration 0 -> 1 ("aggregate-only"):
 *   - Removes the legacy per-submission `reports` and `queue` tables.
 *   - Discards legacy report counts entirely (never reconstructed).
 *   - Collapses retained data to aggregate buckets (`insights`, `insight_themes`)
 *     plus `members`, `commitments`, and `used_nullifiers`.
 *
 * Residual-copy limitation (honest statement):
 *   We perform best-effort overwrite (`PRAGMA secure_delete`), WAL checkpoint,
 *   journal-mode downgrade to DELETE, and VACUUM. This reduces, but does NOT
 *   guarantee, removal of text from the physical medium. Freed pages may persist
 *   in OS page cache, SSD wear-leveling/remanence, filesystem snapshots, cloud
 *   volume snapshots, previously copied `-wal`/`-shm` files, or database backups.
 *   Operators must rotate/purge backups and snapshots separately.
 */

export const SCHEMA_VERSION = 1;

// Child table first so the foreign key (queue.report_id -> reports.report_id) is
// never left dangling while FOREIGN KEYS is ON.
export const LEGACY_TABLES = ['queue', 'reports'];

/**
 * Run all pending migrations against an open better-sqlite3 database.
 * Safe to call repeatedly: already-migrated databases are a no-op.
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {{ migrated: boolean, from: number, to: number, droppedTables: string[] }}
 */
export function runMigrations(db) {
  const from = Number(db.pragma('user_version', { simple: true })) || 0;

  if (from >= SCHEMA_VERSION) {
    return { migrated: false, from, to: from, droppedTables: [] };
  }

  const isMemory = db.memory === true;

  const droppedTables = LEGACY_TABLES.filter((table) =>
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)
  );

  if (!isMemory) {
    // Best-effort: zero freed pages and consolidate the WAL before destructive steps.
    // These pragmas are NOT part of the schema-transaction guarantee and are advisory.
    try {
      db.pragma('secure_delete = ON');
    } catch {
      /* ignore */
    }
    try {
      db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      /* not in WAL mode or WAL unavailable */
    }
  }

  // Discard legacy per-submission storage (and its complaint text) outright.
  for (const table of LEGACY_TABLES) {
    if (droppedTables.includes(table)) {
      db.exec(`DROP TABLE IF EXISTS ${table}`);
    }
  }

  if (!isMemory) {
    // Downgrade from WAL to DELETE so the -wal/-shm sidecars are removed, then
    // rebuild the main database file with VACUUM to release freed pages.
    try {
      db.pragma('journal_mode = DELETE');
      db.exec('VACUUM');
    } catch {
      /* best-effort; restore WAL below regardless */
    }
    try {
      db.pragma('journal_mode = WAL');
    } catch {
      /* ignore */
    }
  }

  db.pragma(`user_version = ${SCHEMA_VERSION}`);

  return { migrated: true, from, to: SCHEMA_VERSION, droppedTables };
}
