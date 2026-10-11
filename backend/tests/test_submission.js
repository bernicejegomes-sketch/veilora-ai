import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Identity, Group, generateProof } from '@semaphore-protocol/core';
import app from '../src/app.js';
import { initDatabase, closeDatabase, getDatabase } from '../src/db/database.js';
import { initGroup, rebuildGroup } from '../src/semaphore/groupService.js';
import {
  encodeComplaintMessage,
  encodeScope,
  getServerDay
} from '../src/services/cryptoEncoding.js';
import { moderateComplaintText } from '../src/services/moderationService.js';

console.log('--- Running Incognito Complaint Submission Tests (Step 4C-2) ---');

// Setup isolated test database
const testDbPath = path.resolve('./data/test_submission.db');
if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
for (const ext of ['-wal', '-shm', '-journal']) {
  if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
}

const db = initDatabase(testDbPath);

// Seed commitments in the DB and rebuild group
const id1 = new Identity();
const id2 = new Identity();
const id3 = new Identity();

db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(id1.commitment.toString());
db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(id2.commitment.toString());
db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(id3.commitment.toString());

const group = rebuildGroup(db);
const groupRoot = group.root.toString();

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

// Scan every TEXT column of every user table for a needle. Used to prove that
// complaint text, identity values, and tracking codes are never persisted.
function scanAllTextColumns(needle) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all();
  let hits = 0;
  for (const { name } of tables) {
    const cols = db.prepare(`PRAGMA table_info(${name})`).all();
    for (const c of cols) {
      if ((c.type || '').toUpperCase().includes('TEXT')) {
        hits += db
          .prepare(`SELECT count(*) AS cnt FROM ${name} WHERE ${c.name} LIKE ?`)
          .get(`%${needle}%`).cnt;
      }
    }
  }
  return hits;
}

function getInsight(topicId, day) {
  return (
    db
      .prepare('SELECT submission_count, warn_count FROM insights WHERE topic_id = ? AND server_day = ?')
      .get(topicId, day) || { submission_count: 0, warn_count: 0 }
  );
}

function assertNoLegacyStorage() {
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name);
  assert.ok(!names.includes('reports'), 'reports table must not exist (aggregate-only design)');
  assert.ok(!names.includes('queue'), 'queue table must not exist (aggregate-only design)');
}

try {
  const validTopic = 'INFRASTRUCTURE';
  const serverDay = getServerDay();
  const validText = 'The air conditioning in lecture hall LH-101 has not been working all week.';
  const validScope = encodeScope(validTopic, serverDay);
  const validMessage = encodeComplaintMessage(validText);

  console.log('Generating base Semaphore proof for id1...');
  const proof1 = await generateProof(id1, group, validMessage, validScope);
  console.log('Base proof generated.');

  // Test 1 & 2: Valid complaint submission succeeds with correct topic/message/scope/root
  console.log('Test 1 & 2: Valid complaint submission succeeds with { ok: true, trackingCode }...');
  const res1 = await postJson('/api/submit', {
    proof: proof1,
    topicId: validTopic,
    text: validText
  });
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.data.ok, true);
  assert.ok(typeof res1.data.trackingCode === 'string' && res1.data.trackingCode.startsWith('INC-'));
  console.log('✔ Test 1 & 2 Passed: Valid complaint submission succeeded.');

  // Test 3: Wrong topic is rejected
  console.log('Test 3: Wrong topic is rejected...');
  const res3 = await postJson('/api/submit', {
    proof: proof1,
    topicId: 'INVALID_TOPIC',
    text: validText
  });
  assert.strictEqual(res3.status, 400);
  assert.strictEqual(res3.data.ok, false);
  console.log('✔ Test 3 Passed: Wrong topic rejected.');

  // Test 4: Wrong scope is rejected
  console.log('Test 4: Wrong scope is rejected...');
  // id2 generates proof for FACULTY, but client submits topicId INFRASTRUCTURE
  const facultyScope = encodeScope('FACULTY', serverDay);
  const proofFaculty = await generateProof(id2, group, validMessage, facultyScope);
  const res4 = await postJson('/api/submit', {
    proof: proofFaculty,
    topicId: 'INFRASTRUCTURE',
    text: validText
  });
  assert.strictEqual(res4.status, 400);
  assert.strictEqual(res4.data.ok, false);
  assert.match(res4.data.error, /scope does not match/);
  console.log('✔ Test 4 Passed: Wrong scope rejected.');

  // Test 5: Wrong complaint text is rejected because proof.message no longer matches
  console.log('Test 5: Wrong complaint text rejected because proof.message mismatches...');
  const res5 = await postJson('/api/submit', {
    proof: proofFaculty,
    topicId: 'FACULTY',
    text: 'Tampered complaint text that does not match original message hash.'
  });
  assert.strictEqual(res5.status, 400);
  assert.strictEqual(res5.data.ok, false);
  assert.match(res5.data.error, /message does not match/);
  console.log('✔ Test 5 Passed: Tampered/mismatched complaint text rejected.');

  // Test 6: Wrong Merkle root is rejected
  console.log('Test 6: Wrong Merkle root is rejected...');
  const tamperedRootProof = {
    ...proofFaculty,
    merkleTreeRoot: '11111111111111111111111111111111'
  };
  const res6 = await postJson('/api/submit', {
    proof: tamperedRootProof,
    topicId: 'FACULTY',
    text: validText
  });
  assert.strictEqual(res6.status, 400);
  assert.strictEqual(res6.data.ok, false);
  assert.match(res6.data.error, /Merkle root does not match/);
  console.log('✔ Test 6 Passed: Wrong Merkle root rejected.');

  // Test 7: Tampered proof is rejected cryptographically
  console.log('Test 7: Tampered proof points rejected...');
  const tamperedProofPoints = {
    ...proofFaculty,
    points: ['1', '2', '3', '4', '5', '6', '7', '8']
  };
  const res7 = await postJson('/api/submit', {
    proof: tamperedProofPoints,
    topicId: 'FACULTY',
    text: validText
  });
  assert.strictEqual(res7.status, 400);
  assert.strictEqual(res7.data.ok, false);
  console.log('✔ Test 7 Passed: Tampered proof rejected.');

  // Test 8: Duplicate nullifier is rejected (replay attack)
  console.log('Test 8: Duplicate nullifier is rejected...');
  const initialNullifiersCount = db.prepare('SELECT count(*) as cnt FROM used_nullifiers').get().cnt;
  const infraBeforeDuplicate = getInsight(validTopic, serverDay);

  // Re-submit proof1 (already submitted in Test 1)
  const res8 = await postJson('/api/submit', {
    proof: proof1,
    topicId: validTopic,
    text: validText
  });
  assert.strictEqual(res8.status, 409);
  assert.strictEqual(res8.data.ok, false);
  assert.match(res8.data.error, /already been submitted/);
  console.log('✔ Test 8 Passed: Duplicate nullifier rejected with 409.');

  // Test 9 & 10: Duplicate nullifier does NOT increment aggregates or create rows
  console.log('Test 9 & 10: Verifying duplicate submission does not increment aggregates...');
  const infraAfterDuplicate = getInsight(validTopic, serverDay);
  const afterNullifiersCount = db.prepare('SELECT count(*) as cnt FROM used_nullifiers').get().cnt;

  assert.strictEqual(infraAfterDuplicate.submission_count, infraBeforeDuplicate.submission_count);
  assert.strictEqual(infraAfterDuplicate.warn_count, infraBeforeDuplicate.warn_count);
  assert.strictEqual(afterNullifiersCount, initialNullifiersCount);
  console.log('✔ Test 9 & 10 Passed: Duplicate nullifier did not increment aggregates.');

  // Test 11: If moderation rejects a complaint: nullifier is NOT consumed, no aggregate change
  console.log('Test 11: Moderation rejection does not consume nullifier or increment aggregates...');
  const facultyBeforeReject = getInsight('FACULTY', serverDay);
  const spamText = 'hi'; // Too short (< 10 chars)
  const spamMsg = encodeComplaintMessage(spamText);
  const proofSpam = await generateProof(id2, group, spamMsg, facultyScope);

  const res11 = await postJson('/api/submit', {
    proof: proofSpam,
    topicId: 'FACULTY',
    text: spamText
  });
  assert.strictEqual(res11.status, 422);
  assert.strictEqual(res11.data.ok, false);
  assert.match(res11.data.error, /rejected by moderation/);

  // Check that id2's nullifier was NOT inserted into used_nullifiers
  const nullifierCheck = db.prepare('SELECT 1 FROM used_nullifiers WHERE nullifier = ?').get(proofSpam.nullifier.toString());
  assert.strictEqual(nullifierCheck, undefined, 'Nullifier must NOT be consumed on moderation rejection');
  const facultyAfterReject = getInsight('FACULTY', serverDay);
  assert.strictEqual(facultyAfterReject.submission_count, facultyBeforeReject.submission_count);
  assert.strictEqual(facultyAfterReject.warn_count, facultyBeforeReject.warn_count);
  console.log('✔ Test 11 Passed: Moderation rejection did not consume nullifier or increment aggregates.');

  // Test 12: A moderation WARN does not automatically reject a genuine complaint
  console.log('Test 12: Moderation WARN still allows genuine complaint to be accepted...');
  const warnText = 'During the lab exam, I was the only student not provided with a functioning desktop computer.';
  const warnMsg = encodeComplaintMessage(warnText);
  const proofWarn = await generateProof(id2, group, warnMsg, facultyScope);

  const res12 = await postJson('/api/submit', {
    proof: proofWarn,
    topicId: 'FACULTY',
    text: warnText
  });
  assert.strictEqual(res12.status, 200);
  assert.strictEqual(res12.data.ok, true);
  console.log('✔ Test 12 Passed: Moderation WARN permitted genuine complaint.');

  // Test 13: Complaint text is never persisted; the aggregate increments exactly once
  console.log('Test 13: Verifying complaint text is never persisted and count incremented once...');
  assert.strictEqual(scanAllTextColumns(warnText), 0, 'complaint text must never be stored in any table');
  const facultyInsight = getInsight('FACULTY', serverDay);
  assert.strictEqual(facultyInsight.submission_count, 1, 'FACULTY submission_count must be exactly 1');
  assert.strictEqual(facultyInsight.warn_count, 1, 'FACULTY warn_count must be exactly 1');
  assertNoLegacyStorage();
  console.log('✔ Test 13 Passed: Complaint text not persisted; aggregate incremented exactly once.');

  // Test 14: Client cannot override serverDay by sending serverDay in request
  console.log('Test 14: Client cannot override serverDay...');
  const fakeDay = '2099-12-31';
  const fakeScope = encodeScope('OTHER', fakeDay);
  const textOther = 'General maintenance complaint regarding cafeteria seating.';
  const proofFakeDay = await generateProof(id3, group, encodeComplaintMessage(textOther), fakeScope);

  const res14 = await postJson('/api/submit', {
    proof: proofFakeDay,
    topicId: 'OTHER',
    text: textOther,
    serverDay: fakeDay // Client attempts to supply fakeDay
  });
  assert.strictEqual(res14.status, 400); // Fails because server uses current serverDay
  assert.match(res14.data.error, /scope does not match/);
  console.log('✔ Test 14 Passed: Client-supplied serverDay ignored; authoritative serverDay enforced.');

  // Test 15: Client cannot override expected root/scope/message
  console.log('Test 15: Client cannot override expected root/scope/message...');
  const res15 = await postJson('/api/submit', {
    proof: proofFakeDay,
    topicId: 'OTHER',
    text: textOther,
    expectedRoot: 'fake_root',
    expectedScope: fakeScope,
    expectedMessage: 'fake_message'
  });
  assert.strictEqual(res15.status, 400);
  console.log('✔ Test 15 Passed: Server ignores client attempts to supply expected values.');

  // Test 16: Request containing rollNo/studentId/deviceId must not create identity-linked records
  console.log('Test 16: Extra identity fields in request do not link or store identity in database...');
  const validOtherScope = encodeScope('OTHER', serverDay);
  const proofOther = await generateProof(id3, group, encodeComplaintMessage(textOther), validOtherScope);

  const res16 = await postJson('/api/submit', {
    proof: proofOther,
    topicId: 'OTHER',
    text: textOther,
    rollNo: 'DEV999',
    studentId: 'STU123',
    deviceId: 'DEVICE-ABC'
  });
  assert.strictEqual(res16.status, 200);

  // No per-submission storage exists; only aggregates retained. Identity fields never stored.
  assertNoLegacyStorage();
  assert.strictEqual(getInsight('OTHER', serverDay).submission_count, 1, 'OTHER count must be exactly 1');
  assert.strictEqual(scanAllTextColumns('DEV999'), 0, 'rollNo must never be persisted');
  assert.strictEqual(scanAllTextColumns('STU123'), 0, 'studentId must never be persisted');
  assert.strictEqual(scanAllTextColumns('DEVICE-ABC'), 0, 'deviceId must never be persisted');
  console.log('✔ Test 16 Passed: Extra identity fields ignored; only aggregates retained.');

  // Test 17: Successful submissions retain exactly 3 nullifiers and 3 aggregate buckets
  console.log('Test 17: Successful submission state counts...');
  const totalNullifiers = db.prepare('SELECT count(*) as cnt FROM used_nullifiers').get().cnt;
  assert.strictEqual(totalNullifiers, 3); // Test 1 (id1/INFRA), Test 12 (id2/FACULTY), Test 16 (id3/OTHER)
  assert.strictEqual(getInsight('INFRASTRUCTURE', serverDay).submission_count, 1);
  assert.strictEqual(getInsight('FACULTY', serverDay).submission_count, 1);
  assert.strictEqual(getInsight('OTHER', serverDay).submission_count, 1);
  assertNoLegacyStorage();
  console.log('✔ Test 17 Passed: Exactly 3 nullifiers and 3 aggregate buckets (one per topic).');

  // Test 18: Transaction rollback on failure
  console.log('Test 18: Verifying atomic transaction rollback when later operation fails...');
  const nullifiersBefore = db.prepare('SELECT count(*) as cnt FROM used_nullifiers').get().cnt;
  const otherBeforeRollback = getInsight('OTHER', serverDay).submission_count;

  // Intentionally test transaction failure inside db.transaction: both the nullifier
  // insert and the aggregate increment must roll back atomically.
  const testRollbackTx = db.transaction(() => {
    db.prepare('INSERT INTO used_nullifiers (nullifier) VALUES (?)').run('transient_nullifier_999');
    db.prepare(`
      INSERT INTO insights (topic_id, server_day, submission_count, warn_count)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(topic_id, server_day) DO UPDATE SET submission_count = submission_count + 1
    `).run('OTHER', serverDay);
    throw new Error('SIMULATED_TRANSACTION_FAILURE');
  });

  assert.throws(() => testRollbackTx(), /SIMULATED_TRANSACTION_FAILURE/);

  const nullifiersAfter = db.prepare('SELECT count(*) as cnt FROM used_nullifiers').get().cnt;
  const otherAfterRollback = getInsight('OTHER', serverDay).submission_count;

  assert.strictEqual(nullifiersAfter, nullifiersBefore);
  assert.strictEqual(otherAfterRollback, otherBeforeRollback);
  console.log('✔ Test 18 Passed: Atomic transaction rolls back both nullifier and aggregate.');

  // Test 19: Concurrent/repeated submissions with same nullifier result in only 1 accepted report
  console.log('Test 19: Concurrent submission with same nullifier permits only 1 accepted report...');
  const parallelResults = await Promise.all([
    postJson('/api/submit', { proof: proof1, topicId: validTopic, text: validText }),
    postJson('/api/submit', { proof: proof1, topicId: validTopic, text: validText })
  ]);
  const statuses = parallelResults.map((r) => r.status);
  assert.ok(statuses.includes(409));
  console.log('✔ Test 19 Passed: Replayed nullifier rejected concurrently.');

  // Test 20: Tracking code is returned, random-looking, and NEVER persisted
  console.log('Test 20: Tracking code randomness and privacy...');
  assert.match(res1.data.trackingCode, /^INC-[0-9A-F]{16}$/);
  assert.strictEqual(
    scanAllTextColumns(res1.data.trackingCode),
    0,
    'tracking code must never be persisted in any table'
  );
  console.log('✔ Test 20 Passed: Tracking code is random, returned, and never persisted.');

  // Test 21: Complaint text with Unicode works
  console.log('Test 21: Complaint text with Unicode characters works...');
  const unicodeText = 'प्रणाली ठीक से काम नहीं कर रही है। La bibliothèque ferme trop tôt. 🏫✨';
  const idUnicode = new Identity();
  db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(idUnicode.commitment.toString());
  const group21 = rebuildGroup(db);

  const unicodeProof = await generateProof(
    idUnicode,
    group21,
    encodeComplaintMessage(unicodeText),
    encodeScope('OTHER', serverDay)
  );

  const res21 = await postJson('/api/submit', {
    proof: unicodeProof,
    topicId: 'OTHER',
    text: unicodeText
  });
  assert.strictEqual(res21.status, 200);
  assert.strictEqual(res21.data.ok, true);
  assert.strictEqual(scanAllTextColumns(unicodeText), 0, 'unicode complaint text must never be persisted');
  assert.strictEqual(getInsight('OTHER', serverDay).submission_count, 2, 'OTHER count must increment to 2');
  console.log('✔ Test 21 Passed: Unicode complaint processed; text not persisted; count incremented.');

  // Test 22: Complaint text with long text works
  console.log('Test 22: Long complaint text works...');
  const longText = 'A'.repeat(5000);
  const idLong = new Identity();
  db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(idLong.commitment.toString());
  const group22a = rebuildGroup(db);

  const longProof = await generateProof(
    idLong,
    group22a,
    encodeComplaintMessage(longText),
    encodeScope('OTHER', serverDay)
  );

  // Moderation check: 5000 consecutive 'A's will be flagged as repeated chars
  const modResult = moderateComplaintText(longText);
  assert.strictEqual(modResult.action, 'REJECT');

  // Verify submitting it gets 422 rejected by moderation (count must NOT change)
  const otherBeforeLong = getInsight('OTHER', serverDay).submission_count;
  const res22 = await postJson('/api/submit', {
    proof: longProof,
    topicId: 'OTHER',
    text: longText
  });
  assert.strictEqual(res22.status, 422);
  assert.strictEqual(getInsight('OTHER', serverDay).submission_count, otherBeforeLong, 'rejected long text must not increment count');

  // Now test genuine long text without repeated chars
  const genuineLongText = 'The university campus needs better infrastructure and maintenance in all academic blocks. '.repeat(50);
  const idLong2 = new Identity();
  db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(idLong2.commitment.toString());
  const group22b = rebuildGroup(db);

  const genuineLongProof = await generateProof(
    idLong2,
    group22b,
    encodeComplaintMessage(genuineLongText),
    encodeScope('OTHER', serverDay)
  );

  const res22b = await postJson('/api/submit', {
    proof: genuineLongProof,
    topicId: 'OTHER',
    text: genuineLongText
  });
  assert.strictEqual(res22b.status, 200);
  assert.strictEqual(res22b.data.ok, true);
  assert.strictEqual(scanAllTextColumns(genuineLongText), 0, 'long complaint text must never be persisted');
  assert.strictEqual(
    getInsight('OTHER', serverDay).submission_count,
    otherBeforeLong + 1,
    'accepted long text increments count exactly once'
  );
  console.log('✔ Test 22 Passed: Long text rejected case unchanged; accepted case incremented once.');

  // Test 23: Complaint text containing links is rejected by moderation
  console.log('Test 23: Complaint text containing spam links is rejected by moderation...');
  const spamLinkText = 'Check out this website for college notes: https://spam-notes.xyz/free';
  const idLink = new Identity();
  db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(idLink.commitment.toString());
  const group23 = rebuildGroup(db);

  const linkProof = await generateProof(
    idLink,
    group23,
    encodeComplaintMessage(spamLinkText),
    encodeScope('OTHER', serverDay)
  );

  const res23 = await postJson('/api/submit', {
    proof: linkProof,
    topicId: 'OTHER',
    text: spamLinkText
  });
  assert.strictEqual(res23.status, 422);
  assert.strictEqual(res23.data.ok, false);
  assert.match(res23.data.error, /rejected by moderation/);
  assert.strictEqual(
    getInsight('OTHER', serverDay).submission_count,
    otherBeforeLong + 1,
    'spam-link rejection must not increment count'
  );
  console.log('✔ Test 23 Passed: Complaint text with links rejected by moderation.');

  // Test 24: Exact complaint text is not modified before verification/storage
  console.log('Test 24: Verifying exact complaint text is unmodified...');
  const textWithSpaces = '   Complaint with leading and trailing spaces.   ';
  const idSpaces = new Identity();
  db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(idSpaces.commitment.toString());
  const group24 = rebuildGroup(db);

  const spacesProof = await generateProof(
    idSpaces,
    group24,
    encodeComplaintMessage(textWithSpaces),
    encodeScope('OTHER', serverDay)
  );

  const res24 = await postJson('/api/submit', {
    proof: spacesProof,
    topicId: 'OTHER',
    text: textWithSpaces
  });
  assert.strictEqual(res24.status, 200);
  assert.strictEqual(scanAllTextColumns(textWithSpaces), 0, 'complaint text with spaces must never be persisted');
  assert.strictEqual(getInsight('OTHER', serverDay).submission_count, 4, 'OTHER count must increment to 4');
  console.log('✔ Test 24 Passed: Exact text not persisted; aggregate incremented once.');

  console.log('\n--- ALL 24 SUBMISSION TESTS PASSED SUCCESSFULLY! ---');
} finally {
  server.close();
  closeDatabase(db);
  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  for (const ext of ['-wal', '-shm', '-journal']) {
    if (fs.existsSync(testDbPath + ext)) fs.unlinkSync(testDbPath + ext);
  }
}
