import express from 'express';
import { getDatabase } from '../db/database.js';

const router = express.Router();

/**
 * GET /api/semaphore-group
 *
 * Public read-only endpoint returning the ordered list of registered
 * Semaphore commitments. Commitments are public pseudonymous group leaves.
 *
 * Ordering strictly matches backend groupService.rebuildGroup:
 * "ORDER BY rowid ASC"
 *
 * Does NOT expose student identity, roll numbers, names, DOB, OTP,
 * secrets, nullifiers, or reports.
 */
router.get('/semaphore-group', (req, res) => {
  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT commitment FROM commitments ORDER BY rowid ASC').all();
    const members = rows.map((r) => r.commitment);

    res.status(200).json({
      ok: true,
      members,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: 'Failed to retrieve semaphore group members',
    });
  }
});

export default router;
