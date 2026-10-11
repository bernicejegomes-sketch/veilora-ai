import assert from 'node:assert/strict';
import http from 'node:http';
import app from '../src/app.js';
import { initDatabase, closeDatabase } from '../src/db/database.js';
import { K_ANONYMITY_THRESHOLD } from '../src/services/insightsService.js';

console.log('--- Running Incognito Aggregate Insights Tests (k-anonymity) ---');

const db = initDatabase(':memory:');

// Seed aggregate buckets straddling the k threshold.
db.prepare(
  'INSERT INTO insights (topic_id, server_day, submission_count, warn_count) VALUES (?, ?, ?, ?)'
).run('FACULTY', '2026-01-01', 1, 0);
db.prepare(
  'INSERT INTO insights (topic_id, server_day, submission_count, warn_count) VALUES (?, ?, ?, ?)'
).run('INFRASTRUCTURE', '2026-01-01', 2, 1);
db.prepare(
  'INSERT INTO insights (topic_id, server_day, submission_count, warn_count) VALUES (?, ?, ?, ?)'
).run('OTHER', '2026-01-01', 3, 0);
db.prepare(
  'INSERT INTO insights (topic_id, server_day, submission_count, warn_count) VALUES (?, ?, ?, ?)'
).run('FACULTY', '2026-01-02', 4, 2);

db.prepare(
  'INSERT INTO insight_themes (topic_id, server_day, theme_key, theme_label, support_count) VALUES (?, ?, ?, ?, ?)'
).run('OTHER', '2026-01-01', 'noise', 'Excessive noise', 2);
db.prepare(
  'INSERT INTO insight_themes (topic_id, server_day, theme_key, theme_label, support_count) VALUES (?, ?, ?, ?, ?)'
).run('OTHER', '2026-01-02', 'parking', 'Parking shortage', 3);

const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function getInsights() {
  const res = await fetch(`${baseUrl}/api/insights`);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

try {
  // Test 1: HTTP 200 and ok:true
  const res1 = await getInsights();
  assert.strictEqual(res1.status, 200, 'Expected HTTP 200');
  assert.strictEqual(res1.data.ok, true, 'Expected ok:true');
  console.log('✔ Test 1 Passed: GET /api/insights returns 200 { ok: true }.');

  // Test 2: advertised threshold is 3
  assert.strictEqual(K_ANONYMITY_THRESHOLD, 3, 'K_ANONYMITY_THRESHOLD must be 3');
  assert.strictEqual(res1.data.threshold, 3, 'Response must advertise threshold 3');
  console.log('✔ Test 2 Passed: k-anonymity threshold is exactly 3.');

  // Test 3: topic/day buckets below k are suppressed
  const bucketKeys = res1.data.topics.map((t) => `${t.topic_id}@${t.server_day}`);
  assert.deepStrictEqual(
    bucketKeys.sort(),
    ['FACULTY@2026-01-02', 'OTHER@2026-01-01'].sort(),
    `Only buckets with count >= 3 may appear. Got: ${bucketKeys.join(', ')}`
  );
  assert.ok(!bucketKeys.includes('FACULTY@2026-01-01'), 'count=1 bucket must be suppressed');
  assert.ok(!bucketKeys.includes('INFRASTRUCTURE@2026-01-01'), 'count=2 bucket must be suppressed');
  console.log('✔ Test 3 Passed: Buckets below k=3 are suppressed.');

  // Test 4: themes below k are suppressed
  const themeKeys = res1.data.themes.map((t) => t.theme_key);
  assert.deepStrictEqual(themeKeys, ['parking'], `Only themes with support >= 3 may appear. Got: ${themeKeys.join(', ')}`);
  assert.ok(!themeKeys.includes('noise'), 'theme with support=2 must be suppressed');
  console.log('✔ Test 4 Passed: Themes below k=3 are suppressed.');

  // Test 5: no complaint text or identity fields leak
  assert.deepStrictEqual(
    Object.keys(res1.data).sort(),
    ['ok', 'threshold', 'demoMode', 'themes', 'topics'].sort(),
    'Response must only contain aggregate keys'
  );
  const serialized = JSON.stringify(res1.data).toLowerCase();
  for (const forbidden of ['complaint', 'report_id', 'nullifier', 'commitment', 'roll_no', 'dob']) {
    assert.ok(!serialized.includes(forbidden), `response must not contain '${forbidden}'`);
  }
  // no per-submission identifier columns on any returned topic bucket
  for (const bucket of res1.data.topics) {
    assert.deepStrictEqual(
      Object.keys(bucket).sort(),
      ['server_day', 'submission_count', 'topic_id', 'warn_count'].sort(),
      'topic buckets must expose only aggregate counters'
    );
  }
  console.log('✔ Test 5 Passed: No complaint text or identity fields in insights response.');

  // Test 6: visible buckets return exact aggregate counts
  const other = res1.data.topics.find((t) => t.topic_id === 'OTHER');
  const faculty2 = res1.data.topics.find((t) => t.topic_id === 'FACULTY');
  assert.strictEqual(other.submission_count, 3);
  assert.strictEqual(faculty2.submission_count, 4);
  console.log('✔ Test 6 Passed: Visible buckets return exact aggregate counts.');

  console.log('\n--- ALL AGGREGATE INSIGHTS TESTS PASSED SUCCESSFULLY! ---');
} finally {
  server.close();
  closeDatabase(db);
}
