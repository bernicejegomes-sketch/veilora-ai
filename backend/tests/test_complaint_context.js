import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { TOPICS } from '../src/config/topics.js';
import { getServerDay, encodeScope } from '../src/services/cryptoEncoding.js';

console.log('--- Running Complaint Context Endpoint Tests (Step 4B) ---');

// Start ephemeral test server
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function getContext() {
  const res = await fetch(`${baseUrl}/api/complaint-context`);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

try {
  // Test 1: GET /api/complaint-context returns HTTP 200
  console.log('Test 1: Verifying HTTP 200 status...');
  const res1 = await getContext();
  assert.strictEqual(res1.status, 200, 'Expected status 200');
  console.log('✔ Test 1 Passed: Returns HTTP 200.');

  // Test 2: Response contains ok: true
  console.log('Test 2: Verifying ok: true in response...');
  assert.strictEqual(res1.data.ok, true, 'Expected ok: true');
  console.log('✔ Test 2 Passed: ok is true.');

  // Test 3: serverDay is in exact YYYY-MM-DD format
  console.log('Test 3: Verifying serverDay format YYYY-MM-DD...');
  assert.ok(typeof res1.data.serverDay === 'string', 'serverDay must be a string');
  assert.match(res1.data.serverDay, /^\d{4}-\d{2}-\d{2}$/, 'serverDay must match YYYY-MM-DD');
  console.log(`✔ Test 3 Passed: serverDay format matches YYYY-MM-DD (${res1.data.serverDay}).`);

  // Test 4: serverDay matches the configured server timezone
  console.log('Test 4: Verifying serverDay matches configured server timezone...');
  const expectedDay = getServerDay();
  assert.strictEqual(res1.data.serverDay, expectedDay, 'serverDay must match getServerDay() output');
  console.log('✔ Test 4 Passed: serverDay matches configured server timezone.');

  // Test 5 & 6: Exactly three topics and exactly FACULTY, INFRASTRUCTURE, OTHER
  console.log('Test 5 & 6: Verifying topics array...');
  assert.ok(Array.isArray(res1.data.topics), 'topics must be an array');
  assert.strictEqual(res1.data.topics.length, 3, 'Must contain exactly three topics');
  assert.deepStrictEqual(res1.data.topics, ['FACULTY', 'INFRASTRUCTURE', 'OTHER'], 'Topics must match exactly');
  assert.deepStrictEqual(res1.data.topics, [...TOPICS], 'Topics must match TOPICS constant');
  console.log('✔ Test 5 & 6 Passed: Exactly three topics [FACULTY, INFRASTRUCTURE, OTHER].');

  // Test 7: No student identity or commitment fields returned
  console.log('Test 7: Verifying no student identity or commitment data leaks...');
  const leakedFields = [
    'rollNo',
    'roll_no',
    'studentId',
    'student_id',
    'commitment',
    'commitments',
    'nullifier',
    'nullifiers',
    'privateKey',
    'private_key',
    'secret',
    'name',
    'dob',
  ];
  for (const field of leakedFields) {
    assert.strictEqual(res1.data[field], undefined, `Response must NOT contain field '${field}'`);
  }
  const allowedKeys = ['ok', 'serverDay', 'topics'];
  assert.deepStrictEqual(Object.keys(res1.data).sort(), allowedKeys.sort(), 'Response must only contain allowed public keys');
  console.log('✔ Test 7 Passed: No student identity, commitment, or metadata fields returned.');

  // Test 8: Calling endpoint repeatedly during same day returns same serverDay
  console.log('Test 8: Verifying repeated calls return identical serverDay...');
  const res2 = await getContext();
  const res3 = await getContext();
  assert.strictEqual(res2.data.serverDay, res1.data.serverDay);
  assert.strictEqual(res3.data.serverDay, res1.data.serverDay);
  console.log('✔ Test 8 Passed: Repeated calls return consistent serverDay.');

  // Test 9: Returned serverDay with encodeScope produces exact expected scope
  console.log('Test 9: Verifying returned serverDay integrates with encodeScope()...');
  for (const topic of res1.data.topics) {
    const scopeFromContext = encodeScope(topic, res1.data.serverDay);
    const expectedScope = encodeScope(topic, expectedDay);
    assert.strictEqual(scopeFromContext, expectedScope, `Scope for ${topic} must match backend expectation`);
    assert.ok(/^\d+$/.test(scopeFromContext), 'Scope must be a decimal numeric string');
  }
  console.log('✔ Test 9 Passed: Returned serverDay produces exact expected Semaphore scope.');

  // Test 10: Change SERVER_TIMEZONE and verify date calculation uses that timezone
  console.log('Test 10: Verifying custom SERVER_TIMEZONE behavior...');
  // Use a fixed timestamp where UTC-11 and UTC+14 are on different calendar days
  // 2026-10-10T12:00:00Z:
  // In Pacific/Kiritimati (UTC+14): 2026-10-11 02:00 (Day: 2026-10-11)
  // In Pacific/Niue (UTC-11): 2026-10-10 01:00 (Day: 2026-10-10)
  const testTime = new Date('2026-10-10T12:00:00.000Z');
  const kiritimatiDay = getServerDay(testTime, 'Pacific/Kiritimati');
  const niueDay = getServerDay(testTime, 'Pacific/Niue');
  assert.strictEqual(kiritimatiDay, '2026-10-11');
  assert.strictEqual(niueDay, '2026-10-10');
  assert.notStrictEqual(kiritimatiDay, niueDay, 'Timezone offsets must produce corresponding calendar days');

  // Verify dynamic env override
  const originalEnv = process.env.SERVER_TIMEZONE;
  try {
    process.env.SERVER_TIMEZONE = 'UTC';
    const dynamicDay = getServerDay(testTime);
    assert.strictEqual(dynamicDay, '2026-10-10');
  } finally {
    if (originalEnv) {
      process.env.SERVER_TIMEZONE = originalEnv;
    } else {
      delete process.env.SERVER_TIMEZONE;
    }
  }
  console.log('✔ Test 10 Passed: Timezone-aware date calculation accurately reflects configured timezone.');

  console.log('\n--- ALL 10 COMPLAINT CONTEXT TESTS PASSED SUCCESSFULLY! ---');
} finally {
  server.close();
}
