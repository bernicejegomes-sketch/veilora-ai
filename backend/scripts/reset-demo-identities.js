/**
 * DEV-ONLY: reset synthetic demo identities (DEV001-DEV030) for local re-testing.
 *
 * Clears the one-time verification state for the synthetic development roster so
 * a student can run the enrollment/verification flow again:
 *   claimed -> 0, otp_hash -> NULL, otp_expiry -> NULL, otp_used -> 0
 *
 * It NEVER weakens production identity checks:
 *   - only rolls in the DEVELOPMENT_ROSTER (DEV001-DEV030) are touched
 *   - it does not alter the roster, commitments, or any real credentials
 *   - it does not disable OTP/proof verification or duplicate prevention
 *
 * SAFETY GUARDS (all required):
 *   1. NODE_ENV !== 'production'
 *   2. DEMO_MODE must be enabled
 *   3. explicit --yes flag
 *
 * Usage (from backend/):  node scripts/reset-demo-identities.js --yes
 *
 * NOTE: this resets server-side state only. If a browser still shows the
 * "already verified" navbar state, clear its local storage (or call
 * clearClientSession() in the app) as well.
 */
import { initDatabase, closeDatabase, resolveDatabasePath } from '../src/db/database.js';
import { isDemoModeEnabled } from '../src/config/demoMode.js';
import { DEVELOPMENT_ROSTER } from '../src/config/roster.js';

function refuse(reason) {
  console.error(`Refusing to run: ${reason}`);
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  refuse('NODE_ENV is "production". This reset is development-only.');
}
if (!isDemoModeEnabled()) {
  refuse('DEMO_MODE is not enabled. Demo identity resets are only allowed in demo mode.');
}
if (!process.argv.includes('--yes')) {
  refuse('Missing --yes confirmation flag. Re-run with: node scripts/reset-demo-identities.js --yes');
}

const dbPath = resolveDatabasePath();
console.log(`Target database: ${dbPath}`);

const db = initDatabase();

const rolls = DEVELOPMENT_ROSTER.map((entry) => entry.rollNo);
const resetStmt = db.prepare(
  `UPDATE members
   SET claimed = 0, otp_hash = NULL, otp_expiry = NULL, otp_used = 0
   WHERE roll_no = ?`
);

const tx = db.transaction((list) => {
  let updated = 0;
  for (const rollNo of list) {
    updated += resetStmt.run(rollNo).changes;
  }
  return updated;
});

const updated = tx(rolls);

console.log(`Reset ${updated} of ${rolls.length} demo identities (${rolls[0]}..${rolls[rolls.length - 1]}).`);
console.log('Preserved: commitments, aggregate insights, and all non-demo members.');

closeDatabase(db);
console.log('Done.');
