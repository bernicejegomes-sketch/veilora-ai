/**
 * DEV-ONLY: remove synthetic test aggregates from the LOCAL development database.
 *
 * This clears the aggregate analytics and rate-limit residue produced by demo /
 * synthetic submissions so the Insights page and demo flows start clean:
 *   - insights        (topic/day counters)
 *   - insight_themes  (AI-derived theme aggregates)
 *   - used_nullifiers (per-day rate-limit markers)
 *
 * It NEVER touches:
 *   - members     (student roster / verification state)
 *   - commitments (enrollment / identity commitments)
 *
 * SAFETY GUARDS (all required):
 *   1. NODE_ENV !== 'production'
 *   2. DEMO_MODE must be enabled
 *   3. explicit --yes flag
 *
 * Usage (from backend/):  node scripts/reset-synthetic-insights.js --yes
 */
import { initDatabase, closeDatabase, resolveDatabasePath } from '../src/db/database.js';
import { isDemoModeEnabled } from '../src/config/demoMode.js';

function refuse(reason) {
  console.error(`Refusing to run: ${reason}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  refuse('NODE_ENV is "production". This reset is development-only.');
}
if (!isDemoModeEnabled()) {
  refuse('DEMO_MODE is not enabled. Synthetic resets are only allowed in demo mode.');
}
if (!process.argv.includes('--yes')) {
  refuse('Missing --yes confirmation flag. Re-run with: node scripts/reset-synthetic-insights.js --yes');
}

const dbPath = resolveDatabasePath();
console.log(`Target database: ${dbPath}`);

const db = initDatabase();

const counts = {
  insights: db.prepare('SELECT count(*) AS c FROM insights').get().c,
  insight_themes: db.prepare('SELECT count(*) AS c FROM insight_themes').get().c,
  used_nullifiers: db.prepare('SELECT count(*) AS c FROM used_nullifiers').get().c,
};

const tx = db.transaction(() => {
  db.prepare('DELETE FROM insights').run();
  db.prepare('DELETE FROM insight_themes').run();
  db.prepare('DELETE FROM used_nullifiers').run();
});
tx();

console.log('Removed synthetic aggregate records:');
console.log(`  insights        : ${counts.insights}`);
console.log(`  insight_themes  : ${counts.insight_themes}`);
console.log(`  used_nullifiers : ${counts.used_nullifiers}`);
console.log('Preserved: members, commitments (enrollment/verification data).');

closeDatabase(db);
console.log('Done.');
