import { DEVELOPMENT_ROSTER } from '../config/roster.js';
import { isDemoModeEnabled } from '../config/demoMode.js';

/**
 * Synchronize the predefined development roster into the members table.
 * Preserves existing claims and OTP records.
 * Only executes when DEMO_MODE is explicitly enabled.
 */
export function syncRoster(db) {
  if (!isDemoModeEnabled()) {
    return;
  }
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO members (roll_no, dob, name, claimed)
    VALUES (?, ?, ?, 0)
  `);

  const syncTx = db.transaction(() => {
    for (const student of DEVELOPMENT_ROSTER) {
      insertStmt.run(student.rollNo, student.dob, student.name);
    }
  });

  syncTx();
}

/**
 * Check if a student is valid according to the development roster and members table.
 */
export function findMember(db, rollNo) {
  return db.prepare('SELECT * FROM members WHERE roll_no = ?').get(rollNo);
}

/**
 * Validate that student credentials match the roster record.
 */
export function validateStudentCredentials(member, dob, name) {
  if (!member) return false;
  if (!dob || typeof dob !== 'string') return false;
  if (!name || typeof name !== 'string') return false;

  const dobMatches = member.dob.trim() === dob.trim();
  const nameMatches = member.name.trim().toLowerCase() === name.trim().toLowerCase();

  return dobMatches && nameMatches;
}
