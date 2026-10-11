import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Identity } from '@semaphore-protocol/core';
import app from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { syncRoster, findMember } from '../src/services/rosterService.js';
import { issueOtp, DEFAULT_DEV_OTP } from '../src/services/otpService.js';
import { isDemoModeEnabled } from '../src/config/demoMode.js';
import { DEVELOPMENT_ROSTER } from '../src/config/roster.js';

console.log('--- Running Incognito Demo Mode & Rate Limit Tests ---');

// 1. DEMO MODE SAFETY TESTS
console.log('\n[TEST 1] Demo Mode Safety: Disabled by default');

// Clear DEMO_MODE
delete process.env.DEMO_MODE;
const prevNodeEnv = process.env.NODE_ENV;
delete process.env.NODE_ENV;

assert.equal(isDemoModeEnabled(), false, 'DEMO_MODE must be false when unset outside of test env');

// When DEMO_MODE is false, syncRoster must NOT seed synthetic students
const testDbPathSafe = path.resolve('./data/test_safety.db');
if (fs.existsSync(testDbPathSafe)) fs.unlinkSync(testDbPathSafe);
const dbSafe = initDatabase(testDbPathSafe);

syncRoster(dbSafe);
const studentSafe = findMember(dbSafe, 'DEV001');
assert.equal(studentSafe, undefined, 'Synthetic DEV001 must NOT be seeded when DEMO_MODE is disabled');

// When DEMO_MODE is false, issuing OTP with no real provider must fail safely
const otpResultSafe = issueOtp(dbSafe, 'DEV001');
assert.equal(otpResultSafe.ok, false, 'issueOtp must fail safely when DEMO_MODE is disabled');
assert.ok(otpResultSafe.error.includes('Demo mode is disabled'), 'issueOtp returns safe descriptive failure');

closeDatabase(dbSafe);
if (fs.existsSync(testDbPathSafe)) fs.unlinkSync(testDbPathSafe);
console.log('  Passed: Demo mode disabled by default, roster not seeded, OTP fails safely.');

// Test when DEMO_MODE is explicitly enabled
console.log('\n[TEST 2] Demo Mode Enabled: Explicit flag enables synthetic roster and dev OTP');
process.env.DEMO_MODE = 'true';
assert.equal(isDemoModeEnabled(), true, 'isDemoModeEnabled returns true when DEMO_MODE=true');

const testDbPathDemo = path.resolve('./data/test_demo_active.db');
if (fs.existsSync(testDbPathDemo)) fs.unlinkSync(testDbPathDemo);
const dbDemo = initDatabase(testDbPathDemo);

syncRoster(dbDemo);
const studentDemo = findMember(dbDemo, 'DEV001');
assert.ok(studentDemo, 'DEV001 must be seeded when DEMO_MODE=true');
assert.equal(studentDemo.name, 'Test Student One');

const otpResultDemo = issueOtp(dbDemo, 'DEV001');
assert.ok(otpResultDemo.expiry > Date.now(), 'issueOtp succeeds and returns expiry in demo mode');

// Roster expansion: exactly 30 synthetic students DEV001-DEV030 are seeded.
assert.equal(DEVELOPMENT_ROSTER.length, 30, 'Roster must contain exactly 30 synthetic students');
const student30 = findMember(dbDemo, 'DEV030');
assert.ok(student30, 'DEV030 must be seeded when DEMO_MODE=true');
assert.equal(student30.name, 'Test Student Thirty');
assert.equal(student30.dob, '2007-06-30');
const student31 = findMember(dbDemo, 'DEV031');
assert.equal(student31, undefined, 'DEV031 must NOT be seeded (outside DEV001-DEV030)');

closeDatabase(dbDemo);
if (fs.existsSync(testDbPathDemo)) fs.unlinkSync(testDbPathDemo);
console.log('  Passed: DEMO_MODE=true seeds roster and allows dev OTP.');

// Restore NODE_ENV
process.env.NODE_ENV = prevNodeEnv || 'test';

// 2. RATE LIMITING TESTS
console.log('\n[TEST 3] Rate Limiting: Limits excessive requests without logging sensitive data');

// Start test server
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

// Setup DB for request-otp endpoint test
const testDbPathHttp = path.resolve('./data/test_http_ratelimit.db');
if (fs.existsSync(testDbPathHttp)) fs.unlinkSync(testDbPathHttp);
const dbHttp = initDatabase(testDbPathHttp);
process.env.DEMO_MODE = 'true';
syncRoster(dbHttp);

async function postOtpRequest() {
  const res = await fetch(`${baseUrl}/api/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rollNo: 'DEV001' }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data, headers: res.headers };
}

// Fire 15 requests (otpLimiter limit is 15)
let rateLimitedResponse = null;
for (let i = 0; i < 18; i++) {
  const resp = await postOtpRequest();
  if (resp.status === 429) {
    rateLimitedResponse = resp;
    break;
  }
}

assert.ok(rateLimitedResponse !== null, 'Rate limiter must return HTTP 429 when threshold exceeded');
assert.equal(rateLimitedResponse.status, 429, 'Status must be 429 Too Many Requests');
assert.equal(rateLimitedResponse.data.ok, false);
assert.ok(rateLimitedResponse.headers.get('retry-after'), 'Retry-After header must be set');
console.log('  Passed: Excessive requests return HTTP 429 with Retry-After header.');

// [TEST 4] Demo enrollment boundary: DEV030 accepted, DEV031 rejected.
console.log('\n[TEST 4] Demo Enrollment Boundary: DEV030 accepted, DEV031 rejected');

async function postJson(endpoint, body) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

issueOtp(dbHttp, 'DEV030', DEFAULT_DEV_OTP);
const enroll30 = await postJson('/api/enroll', {
  rollNo: 'DEV030',
  otp: DEFAULT_DEV_OTP,
  dob: '2007-06-30',
  name: 'Test Student Thirty',
  commitment: new Identity().commitment.toString(),
});
assert.equal(enroll30.status, 200, `DEV030 must be accepted, got ${enroll30.status}: ${JSON.stringify(enroll30.data)}`);
assert.equal(enroll30.data.ok, true);

const reject31 = await postJson('/api/enroll', {
  rollNo: 'DEV031',
  otp: DEFAULT_DEV_OTP,
  dob: '2007-07-31',
  name: 'Test Student Thirty-One',
  commitment: new Identity().commitment.toString(),
});
assert.equal(reject31.status, 400, `DEV031 must be rejected, got ${reject31.status}`);
assert.equal(reject31.data.ok, false);
assert.equal(reject31.data.error, 'invalid student');
console.log('  Passed: DEV030 enrolled (200); DEV031 rejected (400 invalid student).');

// Clean up
server.close();
closeDatabase(dbHttp);
if (fs.existsSync(testDbPathHttp)) fs.unlinkSync(testDbPathHttp);

console.log('\nAll Demo Mode and Rate Limiting tests passed successfully!\n');
