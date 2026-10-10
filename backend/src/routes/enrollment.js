import express from 'express';
import { getDatabase } from '../db/database.js';
import { findMember, validateStudentCredentials } from '../services/rosterService.js';
import { issueOtp, verifyOtp } from '../services/otpService.js';
import { isValidCommitment, addCommitmentToGroup } from '../semaphore/groupService.js';

const router = express.Router();

/**
 * POST /api/request-otp
 * 
 * Development-only endpoint to dispatch a short-lived, single-use OTP.
 * For hackathon demonstration: saves hashed OTP in database.
 * Does NOT return or log the raw OTP value.
 */
router.post('/request-otp', (req, res) => {
  const { rollNo } = req.body || {};

  if (!rollNo || typeof rollNo !== 'string') {
    return res.status(400).json({ ok: false, error: 'invalid student' });
  }

  const db = getDatabase();
  const member = findMember(db, rollNo);

  if (!member) {
    return res.status(400).json({ ok: false, error: 'invalid student' });
  }

  if (member.claimed === 1) {
    return res.status(409).json({ ok: false, error: 'already claimed' });
  }

  issueOtp(db, rollNo);

  return res.status(200).json({ ok: true });
});

/**
 * POST /api/enroll
 * 
 * Validates eligibility against the predefined roster, checks OTP,
 * verifies commitment format, and performs claim + commitment insertion
 * in a single atomic SQLite transaction without linking the two.
 */
router.post('/enroll', (req, res) => {
  const body = req.body || {};

  // Reject any private identity material immediately
  const forbiddenKeys = ['privateKey', 'secret', 'secretScalar', 'identitySecret', 'private_key', 'export'];
  for (const key of forbiddenKeys) {
    if (body[key] !== undefined) {
      return res.status(400).json({ ok: false, error: 'invalid commitment' });
    }
  }

  const { rollNo, otp, dob, name, commitment } = body;

  // Validate required student identity and authentication fields
  if (
    !rollNo || typeof rollNo !== 'string' ||
    !otp || typeof otp !== 'string' ||
    !dob || typeof dob !== 'string' ||
    !name || typeof name !== 'string'
  ) {
    return res.status(400).json({ ok: false, error: 'invalid student' });
  }

  // Validate Semaphore commitment format
  if (!isValidCommitment(commitment)) {
    return res.status(400).json({ ok: false, error: 'invalid commitment' });
  }

  const db = getDatabase();
  const member = findMember(db, rollNo);

  // Validate student exists
  if (!member) {
    return res.status(400).json({ ok: false, error: 'invalid student' });
  }

  // Validate DOB and Name match roster
  if (!validateStudentCredentials(member, dob, name)) {
    return res.status(400).json({ ok: false, error: 'invalid student' });
  }

  // Check if roll number has already been claimed
  if (member.claimed === 1) {
    return res.status(409).json({ ok: false, error: 'already claimed' });
  }

  // Verify OTP
  const otpResult = verifyOtp(db, rollNo, otp);
  if (!otpResult.valid) {
    return res.status(400).json({ ok: false, error: 'invalid otp' });
  }

  // Execute claim and commitment insertion in one SQLite transaction
  try {
    const enrollTx = db.transaction(() => {
      // Re-verify claimed state inside transaction
      const currentMember = db.prepare('SELECT claimed, otp_used FROM members WHERE roll_no = ?').get(rollNo);
      if (!currentMember || currentMember.claimed === 1) {
        throw new Error('ALREADY_CLAIMED');
      }
      if (currentMember.otp_used === 1) {
        throw new Error('INVALID_OTP');
      }

      // Atomic update with concurrency guard
      const updateResult = db.prepare(`
        UPDATE members
        SET claimed = 1, otp_used = 1
        WHERE roll_no = ? AND claimed = 0
      `).run(rollNo);

      if (updateResult.changes === 0) {
        throw new Error('ALREADY_CLAIMED');
      }

      // Insert commitment into isolated commitments table (UNIQUE constraint guarantees rollback if duplicate)
      db.prepare('INSERT INTO commitments (commitment) VALUES (?)').run(commitment);
    });

    enrollTx();
  } catch (err) {
    if (err.message === 'ALREADY_CLAIMED' || err.message.includes('members.roll_no')) {
      return res.status(409).json({ ok: false, error: 'already claimed' });
    }
    if (err.message === 'COMMITMENT_EXISTS' || err.message.includes('commitments.commitment')) {
      return res.status(409).json({ ok: false, error: 'commitment already registered' });
    }
    if (err.message === 'INVALID_OTP') {
      return res.status(400).json({ ok: false, error: 'invalid otp' });
    }
    return res.status(500).json({ ok: false, error: 'enrollment transaction failed' });
  }

  // Update in-memory Semaphore Group (derived state)
  try {
    addCommitmentToGroup(commitment);
  } catch (err) {
    console.error('Failed to update in-memory Semaphore group:', err.message);
  }

  return res.status(200).json({ ok: true });
});

export default router;
