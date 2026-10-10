import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Identity } from '@semaphore-protocol/core';
import app from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { syncRoster } from '../src/services/rosterService.js';
import { issueOtp, resetAttempts, DEFAULT_DEV_OTP } from '../src/services/otpService.js';
import { initGroup, rebuildGroup, getGroup, isValidCommitment } from '../src/semaphore/groupService.js';

console.log('--- Running Incognito Enrollment Tests (Step 3B) ---');

// Setup isolated test database
const testDbPath = path.resolve('./data/test_enrollment.db');
// Clean up any previous test artifact
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
for (const ext of ['-wal', '-shm', '-journal']) {
  if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
}

const db = initDatabase(testDbPath);
syncRoster(db);
initGroup(db);

// Start ephemeral test HTTP server
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function postJson(endpoint, body) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

try {
  // Test 1: Valid enrollment succeeds
  console.log('Test 1: Valid enrollment succeeds...');
  const id1 = new Identity();
  const comm1 = id1.commitment.toString();

  // Request development OTP
  const otpReq1 = await postJson('/api/request-otp', { rollNo: 'DEV001' });
  assert.strictEqual(otpReq1.status, 200);
  assert.strictEqual(otpReq1.data.ok, true);

  const enrollRes1 = await postJson('/api/enroll', {
    rollNo: 'DEV001',
    otp: DEFAULT_DEV_OTP,
    dob: '2007-01-01',
    name: 'Test Student One',
    commitment: comm1,
  });

  assert.strictEqual(enrollRes1.status, 200, `Expected 200, got ${enrollRes1.status}: ${JSON.stringify(enrollRes1.data)}`);
  assert.strictEqual(enrollRes1.data.ok, true);
  // Verify no identity secret, rollNo, or commitment in response
  assert.strictEqual(enrollRes1.data.commitment, undefined);
  assert.strictEqual(enrollRes1.data.rollNo, undefined);
  assert.strictEqual(enrollRes1.data.privateKey, undefined);
  console.log('✔ Test 1 Passed: Valid enrollment succeeded with { ok: true }.');

  // Test 2: Invalid roll number fails
  console.log('Test 2: Invalid roll number fails...');
  const enrollRes2 = await postJson('/api/enroll', {
    rollNo: 'DEV999',
    otp: DEFAULT_DEV_OTP,
    dob: '2007-01-01',
    name: 'Ghost Student',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes2.status, 400);
  assert.strictEqual(enrollRes2.data.ok, false);
  assert.strictEqual(enrollRes2.data.error, 'invalid student');
  console.log('✔ Test 2 Passed: Invalid roll number rejected.');

  // Test 3: Wrong DOB fails
  console.log('Test 3: Wrong DOB fails...');
  issueOtp(db, 'DEV002');
  const enrollRes3 = await postJson('/api/enroll', {
    rollNo: 'DEV002',
    otp: DEFAULT_DEV_OTP,
    dob: '1999-12-31',
    name: 'Test Student Two',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes3.status, 400);
  assert.strictEqual(enrollRes3.data.ok, false);
  assert.strictEqual(enrollRes3.data.error, 'invalid student');
  console.log('✔ Test 3 Passed: Wrong DOB rejected.');

  // Test 4: Wrong name fails
  console.log('Test 4: Wrong name fails...');
  const enrollRes4 = await postJson('/api/enroll', {
    rollNo: 'DEV002',
    otp: DEFAULT_DEV_OTP,
    dob: '2007-02-02',
    name: 'Wrong Student Name',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes4.status, 400);
  assert.strictEqual(enrollRes4.data.ok, false);
  assert.strictEqual(enrollRes4.data.error, 'invalid student');
  console.log('✔ Test 4 Passed: Wrong name rejected.');

  // Test 5: Invalid OTP fails
  console.log('Test 5: Invalid OTP fails...');
  const enrollRes5 = await postJson('/api/enroll', {
    rollNo: 'DEV002',
    otp: '000000',
    dob: '2007-02-02',
    name: 'Test Student Two',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes5.status, 400);
  assert.strictEqual(enrollRes5.data.ok, false);
  assert.strictEqual(enrollRes5.data.error, 'invalid otp');
  console.log('✔ Test 5 Passed: Invalid OTP rejected.');

  // Test 6: Expired OTP fails
  console.log('Test 6: Expired OTP fails...');
  // Set an expired OTP (ttl -10000 ms)
  issueOtp(db, 'DEV002', '999999', -10000);
  const enrollRes6 = await postJson('/api/enroll', {
    rollNo: 'DEV002',
    otp: '999999',
    dob: '2007-02-02',
    name: 'Test Student Two',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes6.status, 400);
  assert.strictEqual(enrollRes6.data.ok, false);
  assert.strictEqual(enrollRes6.data.error, 'invalid otp');
  console.log('✔ Test 6 Passed: Expired OTP rejected.');

  // Test 7: Reused OTP fails
  console.log('Test 7: Reused OTP fails...');
  // Fresh valid OTP for DEV002
  issueOtp(db, 'DEV002', '654321');
  const id2 = new Identity();
  const comm2 = id2.commitment.toString();

  const enrollRes7a = await postJson('/api/enroll', {
    rollNo: 'DEV002',
    otp: '654321',
    dob: '2007-02-02',
    name: 'Test Student Two',
    commitment: comm2,
  });
  assert.strictEqual(enrollRes7a.status, 200);

  // Attempt to reuse same OTP on claimed student
  const enrollRes7b = await postJson('/api/enroll', {
    rollNo: 'DEV002',
    otp: '654321',
    dob: '2007-02-02',
    name: 'Test Student Two',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes7b.status, 409);
  assert.strictEqual(enrollRes7b.data.error, 'already claimed');
  console.log('✔ Test 7 Passed: Reused OTP rejected and claim blocked.');

  // Test 8: Same roll number cannot be enrolled twice
  console.log('Test 8: Same roll number cannot be enrolled twice...');
  const enrollRes8 = await postJson('/api/enroll', {
    rollNo: 'DEV001',
    otp: DEFAULT_DEV_OTP,
    dob: '2007-01-01',
    name: 'Test Student One',
    commitment: new Identity().commitment.toString(),
  });
  assert.strictEqual(enrollRes8.status, 409);
  assert.strictEqual(enrollRes8.data.ok, false);
  assert.strictEqual(enrollRes8.data.error, 'already claimed');
  console.log('✔ Test 8 Passed: Duplicate roll number enrollment blocked.');

  // Test 9: Same commitment cannot be enrolled twice
  console.log('Test 9: Same commitment cannot be enrolled twice...');
  issueOtp(db, 'DEV003');
  const enrollRes9 = await postJson('/api/enroll', {
    rollNo: 'DEV003',
    otp: DEFAULT_DEV_OTP,
    dob: '2007-03-03',
    name: 'Test Student Three',
    commitment: comm1, // comm1 was already enrolled for DEV001
  });
  assert.strictEqual(enrollRes9.status, 409);
  assert.strictEqual(enrollRes9.data.ok, false);
  assert.strictEqual(enrollRes9.data.error, 'commitment already registered');
  console.log('✔ Test 9 Passed: Duplicate commitment registration blocked.');

  // Test 10: Two concurrent enrollment attempts using the same roll number cannot both succeed
  console.log('Test 10: Concurrency guard - two simultaneous requests for same roll number...');
  issueOtp(db, 'DEV003');
  const comm3a = new Identity().commitment.toString();
  const comm3b = new Identity().commitment.toString();

  const [concurrentA, concurrentB] = await Promise.all([
    postJson('/api/enroll', {
      rollNo: 'DEV003',
      otp: DEFAULT_DEV_OTP,
      dob: '2007-03-03',
      name: 'Test Student Three',
      commitment: comm3a,
    }),
    postJson('/api/enroll', {
      rollNo: 'DEV003',
      otp: DEFAULT_DEV_OTP,
      dob: '2007-03-03',
      name: 'Test Student Three',
      commitment: comm3b,
    }),
  ]);

  const statuses = [concurrentA.status, concurrentB.status].sort();
  assert.deepStrictEqual(statuses, [200, 409], 'Exactly one concurrent request must succeed (200) and the other must fail (409)');
  console.log('✔ Test 10 Passed: Race condition prevented via atomic transaction.');

  // Test 11: Successful enrollment creates exactly one claimed member and one commitment
  console.log('Test 11: Verifying DB state after enrollment...');
  const dev003Record = db.prepare('SELECT claimed, otp_used FROM members WHERE roll_no = ?').get('DEV003');
  assert.strictEqual(dev003Record.claimed, 1);
  assert.strictEqual(dev003Record.otp_used, 1);

  const commCount = db.prepare('SELECT count(*) as count FROM commitments WHERE commitment = ? OR commitment = ?').get(comm3a, comm3b);
  assert.strictEqual(commCount.count, 1, 'Only one commitment from concurrent attempts must be stored');
  console.log('✔ Test 11 Passed: Exactly one claimed member and one commitment created.');

  // Test 12: Database still has NO persistent rollNo -> commitment relationship
  console.log('Test 12: Verifying database privacy boundary...');
  const memberCols = db.prepare('PRAGMA table_info(members)').all().map((c) => c.name);
  const commitmentCols = db.prepare('PRAGMA table_info(commitments)').all().map((c) => c.name);

  assert.ok(!memberCols.includes('commitment'), 'members must NOT have commitment column');
  assert.ok(!commitmentCols.includes('roll_no'), 'commitments must NOT have roll_no column');
  assert.ok(!commitmentCols.includes('name'), 'commitments must NOT have name column');
  assert.ok(!commitmentCols.includes('dob'), 'commitments must NOT have dob column');

  const memberFks = db.prepare('PRAGMA foreign_key_list(members)').all();
  const commFks = db.prepare('PRAGMA foreign_key_list(commitments)').all();
  assert.strictEqual(memberFks.length, 0);
  assert.strictEqual(commFks.length, 0);
  console.log('✔ Test 12 Passed: No column, metadata, or FK connecting members to commitments.');

  // Test 13: Restarting/rebuilding the Semaphore Group from SQLite includes all stored commitments
  console.log('Test 13: Verifying Semaphore Group rebuilds from SQLite source of truth...');
  const totalStoredCommitments = db.prepare('SELECT count(*) as count FROM commitments').get().count;
  const rebuiltGroup = rebuildGroup(db);

  assert.strictEqual(rebuiltGroup.size, totalStoredCommitments);
  assert.ok(rebuiltGroup.indexOf(BigInt(comm1)) !== -1, 'comm1 must be in rebuilt group');
  assert.ok(rebuiltGroup.indexOf(BigInt(comm2)) !== -1, 'comm2 must be in rebuilt group');
  console.log(`✔ Test 13 Passed: Semaphore Group rebuilt from SQLite with all ${totalStoredCommitments} commitments.`);

  // Test 14: Private identity material is never accepted by enrollment endpoint
  console.log('Test 14: Rejecting private identity material...');
  issueOtp(db, 'DEV004');
  const id4 = new Identity();
  const leakRes = await postJson('/api/enroll', {
    rollNo: 'DEV004',
    otp: DEFAULT_DEV_OTP,
    dob: '2007-04-04',
    name: 'Test Student Four',
    commitment: id4.commitment.toString(),
    privateKey: id4.export(), // FORBIDDEN!
  });
  assert.strictEqual(leakRes.status, 400);
  assert.strictEqual(leakRes.data.error, 'invalid commitment');
  console.log('✔ Test 14 Passed: Submission containing private identity secret rejected immediately.');

  // Test 15: Invalid commitment formats are rejected
  console.log('Test 15: Rejecting invalid commitment formats...');
  const invalidCommitments = [
    '',
    'not_a_number',
    '123.456',
    '-9999',
    '   ',
    '9999999999999999999999999999999999999999999999999999999999999999999999999999999999999999999', // overflow
  ];

  for (const badComm of invalidCommitments) {
    const badRes = await postJson('/api/enroll', {
      rollNo: 'DEV004',
      otp: DEFAULT_DEV_OTP,
      dob: '2007-04-04',
      name: 'Test Student Four',
      commitment: badComm,
    });
    assert.strictEqual(badRes.status, 400, `Expected 400 for bad commitment '${badComm}'`);
    assert.strictEqual(badRes.data.error, 'invalid commitment');
  }
  console.log('✔ Test 15 Passed: All invalid commitment formats strictly rejected.');

  // Test 16: SQLite Transaction Rollback Verification
  console.log('Test 16: Verifying SQLite transaction rollback on duplicate commitment...');
  // 1. Have an eligible development student who is currently unclaimed (DEV005)
  const initialDev5 = db.prepare('SELECT claimed, otp_used FROM members WHERE roll_no = ?').get('DEV005');
  assert.strictEqual(initialDev5.claimed, 0, 'DEV005 must initially be unclaimed');
  assert.strictEqual(initialDev5.otp_used, 0, 'DEV005 otp_used must initially be 0');

  // Issue a fresh valid OTP for DEV005
  issueOtp(db, 'DEV005', '777888');

  // 2. comm1 is already present in the commitments table
  const initialCommitmentCount = db.prepare('SELECT count(*) as count FROM commitments').get().count;

  // 3. Attempt enrollment with valid rollNo, DOB, name, OTP, but duplicate commitment
  const rollbackRes = await postJson('/api/enroll', {
    rollNo: 'DEV005',
    otp: '777888',
    dob: '2007-05-05',
    name: 'Test Student Five',
    commitment: comm1, // duplicate!
  });

  // 4. Enrollment must fail with 'commitment already registered'
  assert.strictEqual(rollbackRes.status, 409);
  assert.strictEqual(rollbackRes.data.ok, false);
  assert.strictEqual(rollbackRes.data.error, 'commitment already registered');

  // 5. After failed enrollment, verify members.claimed is still 0, otp_used is still 0, no new commitment
  const afterDev5 = db.prepare('SELECT claimed, otp_used FROM members WHERE roll_no = ?').get('DEV005');
  assert.strictEqual(afterDev5.claimed, 0, 'DEV005 claimed must remain 0 after rollback');
  assert.strictEqual(afterDev5.otp_used, 0, 'DEV005 otp_used must remain 0 after rollback');

  const afterCommitmentCount = db.prepare('SELECT count(*) as count FROM commitments').get().count;
  assert.strictEqual(afterCommitmentCount, initialCommitmentCount, 'No new commitment should be added to commitments table');
  console.log('✔ Test 16 Passed: SQLite transaction rolled back completely (claimed=0, otp_used=0, commitments count unchanged).');

  console.log('\n--- ALL 16 ENROLLMENT TESTS PASSED SUCCESSFULLY! ---');
} finally {
  server.close();
  closeDatabase(db);
  // Clean up temporary database files
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  for (const ext of ['-wal', '-shm', '-journal']) {
    if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
  }
}
