import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { initDatabase, closeDatabase, resolveDatabasePath } from '../src/db/database.js';
import { REQUIRED_TABLES } from '../src/db/schema.js';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- Running Incognito Database Foundation Tests ---');

// Test 1: Database initializes successfully (in-memory)
console.log('Test 1: Initializing database...');
const db = initDatabase(':memory:');
assert.ok(db && db.open, 'Database should be open and initialized');
console.log('✔ Test 1 Passed: Database initialized successfully.');

// Test 2: All five required tables exist
console.log('Test 2: Verifying required tables exist...');
const existingTables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((row) => row.name);

for (const tableName of REQUIRED_TABLES) {
  assert.ok(
    existingTables.includes(tableName),
    `Required table '${tableName}' must exist in database. Found: ${existingTables.join(', ')}`
  );
}
console.log(`✔ Test 2 Passed: All 5 required tables exist (${REQUIRED_TABLES.join(', ')}).`);

// Test 3: members.roll_no rejects duplicates
console.log('Test 3: Verifying members.roll_no rejects duplicates...');
const insertMember = db.prepare(`
  INSERT INTO members (roll_no, dob, name) VALUES (?, ?, ?)
`);
insertMember.run('2024CS001', '2004-05-15', 'Student Alpha');

assert.throws(
  () => {
    insertMember.run('2024CS001', '2004-05-15', 'Student Alpha Duplicate');
  },
  /UNIQUE constraint failed: members\.roll_no/,
  'Inserting duplicate roll_no into members must throw UNIQUE constraint violation'
);
console.log('✔ Test 3 Passed: members.roll_no rejects duplicate values.');

// Test 4: commitments.commitment rejects duplicates
console.log('Test 4: Verifying commitments.commitment rejects duplicates...');
const insertCommitment = db.prepare(`
  INSERT INTO commitments (commitment) VALUES (?)
`);
insertCommitment.run('0x123456789abcdef');

assert.throws(
  () => {
    insertCommitment.run('0x123456789abcdef');
  },
  /UNIQUE constraint failed: commitments\.commitment/,
  'Inserting duplicate commitment into commitments must throw UNIQUE constraint violation'
);
console.log('✔ Test 4 Passed: commitments.commitment rejects duplicate values.');

// Test 5: used_nullifiers.nullifier rejects duplicates
console.log('Test 5: Verifying used_nullifiers.nullifier rejects duplicates...');
const insertNullifier = db.prepare(`
  INSERT INTO used_nullifiers (nullifier) VALUES (?)
`);
insertNullifier.run('0xnullifier999');

assert.throws(
  () => {
    insertNullifier.run('0xnullifier999');
  },
  /UNIQUE constraint failed: used_nullifiers\.nullifier/,
  'Inserting duplicate nullifier into used_nullifiers must throw UNIQUE constraint violation'
);
console.log('✔ Test 5 Passed: used_nullifiers.nullifier rejects duplicate values.');

// Helper to inspect table columns
function getTableColumns(tableName) {
  return db.prepare(`PRAGMA table_info(${tableName})`).all().map((col) => col.name.toLowerCase());
}

// Helper to inspect foreign keys
function getForeignKeys(tableName) {
  return db.prepare(`PRAGMA foreign_key_list(${tableName})`).all();
}

// Test 6: No database column or FK connecting members to commitments
console.log('Test 6: Checking privacy separation: members <-> commitments...');
const memberCols = getTableColumns('members');
const commitmentCols = getTableColumns('commitments');

assert.ok(
  !memberCols.some((col) => col.includes('commitment')),
  `members table must NOT contain commitment columns. Found: ${memberCols.join(', ')}`
);
assert.ok(
  !commitmentCols.some((col) => ['roll_no', 'name', 'dob', 'student_id'].includes(col)),
  `commitments table must NOT contain identity columns. Found: ${commitmentCols.join(', ')}`
);

const memberFks = getForeignKeys('members');
const commitmentFks = getForeignKeys('commitments');
assert.ok(
  !memberFks.some((fk) => fk.table === 'commitments'),
  'members table must NOT have foreign keys referencing commitments'
);
assert.ok(
  !commitmentFks.some((fk) => fk.table === 'members'),
  'commitments table must NOT have foreign keys referencing members'
);
console.log('✔ Test 6 Passed: No column or FK connecting members to commitments.');

// Test 7: No legacy per-submission tables; no complaint text column anywhere
console.log('Test 7: Verifying no per-submission storage and no complaint_text column...');

assert.ok(
  !existingTables.includes('reports'),
  `reports table must NOT exist (aggregate-only design). Found: ${existingTables.join(', ')}`
);
assert.ok(
  !existingTables.includes('queue'),
  `queue table must NOT exist (aggregate-only design). Found: ${existingTables.join(', ')}`
);

const complaintTextColumns = [];
for (const table of existingTables) {
  for (const col of getTableColumns(table)) {
    if (col.includes('complaint') || col.includes('text') || col.includes('message')) {
      complaintTextColumns.push(`${table}.${col}`);
    }
  }
}
assert.deepStrictEqual(
  complaintTextColumns,
  [],
  `No table may contain a complaint text column. Found: ${complaintTextColumns.join(', ')}`
);
assert.ok(
  !commitmentCols.some((col) => col.includes('report')),
  `commitments table must NOT contain report columns. Found: ${commitmentCols.join(', ')}`
);
console.log('✔ Test 7 Passed: No reports/queue tables and no complaint text column anywhere.');

// Test 8: used_nullifiers does NOT contain report_id or link to reports
console.log('Test 8: Checking privacy separation: used_nullifiers does not contain report_id...');
const nullifierCols = getTableColumns('used_nullifiers');
assert.ok(
  !nullifierCols.includes('report_id') && !nullifierCols.includes('report'),
  `used_nullifiers must NOT contain report_id. Found: ${nullifierCols.join(', ')}`
);
assert.ok(
  !nullifierCols.includes('commitment') && !nullifierCols.includes('roll_no'),
  `used_nullifiers must NOT contain commitment or roll_no. Found: ${nullifierCols.join(', ')}`
);
const nullifierFks = getForeignKeys('used_nullifiers');
assert.ok(
  !nullifierFks.some((fk) => fk.table === 'reports'),
  'used_nullifiers must NOT reference reports'
);
console.log('✔ Test 8 Passed: used_nullifiers contains no report_id, identity references, or FKs.');

// Test 8b: Timing correlation prevention: no per-submission timestamps retained
console.log('Test 8b: Checking timing correlation prevention (no per-submission timestamps)...');
assert.ok(
  !nullifierCols.includes('created_at'),
  'used_nullifiers must NOT contain persistent created_at timestamp'
);

const insightsCols = getTableColumns('insights');
const themeCols = getTableColumns('insight_themes');
assert.ok(
  !insightsCols.includes('created_at') &&
    !insightsCols.includes('report_id') &&
    !insightsCols.includes('nullifier'),
  `insights must contain only aggregate counters. Found: ${insightsCols.join(', ')}`
);
assert.ok(
  !themeCols.includes('created_at') && !themeCols.includes('nullifier') && !themeCols.includes('report_id'),
  `insight_themes must contain only aggregate buckets. Found: ${themeCols.join(', ')}`
);
assert.ok(
  memberCols.includes('created_at'),
  'members should retain created_at for OTP lifecycle management'
);
console.log('✔ Test 8b Passed: No per-submission timestamps retained; only aggregate buckets.');

// Test 9: The database can be safely closed
console.log('Test 9: Verifying database safe closure...');
closeDatabase(db);
assert.strictEqual(db.open, false, 'Database must be closed after closeDatabase()');
console.log('✔ Test 9 Passed: Database safely closed.');

// Test 10: File-based initialization with default directory creation
console.log('Test 10: Verifying file-based initialization and path resolution...');
const testDbPath = path.resolve('./data/test_incognito.db');
const fileDb = initDatabase(testDbPath);
assert.ok(fileDb && fileDb.open, 'File-based database must open successfully');
assert.ok(fs.existsSync(testDbPath), 'Database file should exist on disk');
closeDatabase(fileDb);
assert.strictEqual(fileDb.open, false, 'File database must close safely');

// Clean up temporary test database file
if (fs.existsSync(testDbPath)) {
  fs.unlinkSync(testDbPath);
}
// Clean up WAL/SHM if created
for (const ext of ['-wal', '-shm', '-journal']) {
  if (fs.existsSync(testDbPath + ext)) {
    fs.unlinkSync(testDbPath + ext);
  }
}
console.log('✔ Test 10 Passed: File-based database created and cleaned up successfully.');

// Test 11: Legacy migration discards reports/queue and purges complaint text (best-effort)
console.log('Test 11: Verifying legacy migration to aggregate-only schema...');
const legacyPath = path.resolve('./data/test_migration.db');
const legacyFiles = [legacyPath, legacyPath + '-wal', legacyPath + '-shm', legacyPath + '-journal'];
for (const p of legacyFiles) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// Fabricate a legacy database containing per-submission complaint text.
const legacyDb = new Database(legacyPath);
legacyDb.exec(`
  CREATE TABLE reports (
    report_id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    complaint_text TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
  );
  CREATE TABLE queue (
    queue_id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    available_after INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (report_id) REFERENCES reports(report_id) ON DELETE CASCADE
  );
  INSERT INTO reports (report_id, topic_id, complaint_text) VALUES ('r1', 'FACULTY', 'LEGACY_SECRET_COMPLAINT_TEXT');
  INSERT INTO queue (queue_id, report_id, available_after) VALUES ('q1', 'r1', 123456789);
`);
legacyDb.close();

const migratedDb = initDatabase(legacyPath);
const migratedTables = migratedDb
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .map((row) => row.name);

assert.ok(!migratedTables.includes('reports'), 'reports must be dropped after migration');
assert.ok(!migratedTables.includes('queue'), 'queue must be dropped after migration');
assert.ok(migratedTables.includes('insights'), 'insights must exist after migration');
assert.ok(migratedTables.includes('insight_themes'), 'insight_themes must exist after migration');
assert.strictEqual(
  migratedDb.pragma('user_version', { simple: true }),
  2,
  'user_version must be bumped to 2'
);

// Legacy counts must be discarded, never reconstructed.
const legacyInsightRows = migratedDb.prepare('SELECT count(*) AS cnt FROM insights').get().cnt;
assert.strictEqual(legacyInsightRows, 0, 'legacy report counts must be discarded, not reconstructed');

// Best-effort purge: legacy complaint text must not be findable in any text column.
let legacyTextHits = 0;
for (const table of migratedTables) {
  const cols = migratedDb.prepare(`PRAGMA table_info(${table})`).all();
  for (const c of cols) {
    if ((c.type || '').toUpperCase().includes('TEXT')) {
      legacyTextHits += migratedDb
        .prepare(`SELECT count(*) AS cnt FROM ${table} WHERE ${c.name} LIKE ?`)
        .get('%LEGACY_SECRET_COMPLAINT_TEXT%').cnt;
    }
  }
}
assert.strictEqual(legacyTextHits, 0, 'legacy complaint text must not remain in any text column');

closeDatabase(migratedDb);

// Migration must be idempotent: re-opening the migrated database is a no-op.
const reopenedDb = initDatabase(legacyPath);
assert.strictEqual(
  reopenedDb.pragma('user_version', { simple: true }),
  2,
  'migration must be idempotent on re-open'
);
closeDatabase(reopenedDb);

for (const p of legacyFiles) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log('✔ Test 11 Passed: Legacy reports/queue dropped, counts discarded, text purged (best-effort).');

// Test 12: v1 -> v2 adds the generalized AI summary column idempotently
console.log('Test 12: Verifying v1 -> v2 migration adds insight_themes.summary...');
const v1Path = path.resolve('./data/test_migration_v2.db');
const v1Files = [v1Path, v1Path + '-wal', v1Path + '-shm', v1Path + '-journal'];
for (const p of v1Files) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

// Fabricate a v1-style database: aggregate tables but NO summary column.
const v1Db = new Database(v1Path);
v1Db.exec(`
  CREATE TABLE insights (
    topic_id TEXT NOT NULL,
    server_day TEXT NOT NULL,
    submission_count INTEGER NOT NULL DEFAULT 0,
    warn_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (topic_id, server_day)
  );
  CREATE TABLE insight_themes (
    topic_id TEXT NOT NULL,
    server_day TEXT NOT NULL,
    theme_key TEXT NOT NULL,
    theme_label TEXT NOT NULL,
    support_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (topic_id, server_day, theme_key)
  );
  INSERT INTO insight_themes (topic_id, server_day, theme_key, theme_label, support_count)
    VALUES ('OTHER', '2026-01-01', 'noise', 'Excessive noise', 4);
  PRAGMA user_version = 1;
`);
v1Db.close();

const upDb = initDatabase(v1Path);
const upThemeCols = upDb
  .prepare('PRAGMA table_info(insight_themes)')
  .all()
  .map((c) => c.name);
assert.ok(upThemeCols.includes('summary'), 'v2 migration must add insight_themes.summary');
assert.strictEqual(
  upDb.pragma('user_version', { simple: true }),
  2,
  'v1 -> v2 migration must set user_version to 2'
);
// Existing aggregate rows must be preserved (not discarded).
assert.strictEqual(
  upDb.prepare("SELECT support_count FROM insight_themes WHERE theme_key = 'noise'").get().support_count,
  4,
  'v1 -> v2 migration must preserve existing aggregate rows'
);
closeDatabase(upDb);

// Idempotent re-open.
const upDb2 = initDatabase(v1Path);
assert.strictEqual(
  upDb2.pragma('user_version', { simple: true }),
  2,
  'v1 -> v2 migration must be idempotent'
);
closeDatabase(upDb2);

for (const p of v1Files) {
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log('✔ Test 12 Passed: v1 -> v2 migration added summary column idempotently and preserved aggregates.');

console.log('\n--- ALL DATABASE FOUNDATION TESTS PASSED SUCCESSFULLY! ---');
