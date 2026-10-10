import assert from 'node:assert/strict';
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

// Test 7: No database column or FK connecting commitments to reports
console.log('Test 7: Checking privacy separation: commitments <-> reports...');
const reportCols = getTableColumns('reports');

assert.ok(
  !commitmentCols.some((col) => col.includes('report')),
  `commitments table must NOT contain report columns. Found: ${commitmentCols.join(', ')}`
);
assert.ok(
  !reportCols.some((col) => col.includes('commitment') || col.includes('roll_no') || col.includes('nullifier')),
  `reports table must NOT contain commitment, roll_no, or nullifier columns. Found: ${reportCols.join(', ')}`
);

const reportFks = getForeignKeys('reports');
assert.ok(
  !reportFks.some((fk) => ['commitments', 'members', 'used_nullifiers'].includes(fk.table)),
  'reports table must NOT reference commitments, members, or used_nullifiers'
);
assert.ok(
  !commitmentFks.some((fk) => fk.table === 'reports'),
  'commitments table must NOT reference reports'
);
console.log('✔ Test 7 Passed: No column or FK connecting commitments to reports.');

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

// Test 8b: Timing correlation prevention: verify created_at removed from used_nullifiers and reports
console.log('Test 8b: Checking timing correlation prevention (no created_at on used_nullifiers or reports)...');
assert.ok(
  !nullifierCols.includes('created_at'),
  'used_nullifiers must NOT contain persistent created_at timestamp'
);
assert.ok(
  !reportCols.includes('created_at'),
  'reports must NOT contain persistent created_at timestamp'
);
assert.ok(
  memberCols.includes('created_at'),
  'members should retain created_at for OTP lifecycle management'
);
const queueCols = getTableColumns('queue');
assert.ok(
  queueCols.includes('created_at'),
  'queue should retain created_at for queue scheduling'
);
console.log('✔ Test 8b Passed: created_at removed from used_nullifiers and reports; retained in members and queue.');

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

console.log('\n--- ALL DATABASE FOUNDATION TESTS PASSED SUCCESSFULLY! ---');
