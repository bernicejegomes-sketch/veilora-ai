import express from 'express';
import { getDatabase } from '../db/database.js';
import { isDemoModeEnabled } from '../config/demoMode.js';
import {
  getTopicDayInsights,
  getThemeInsights,
  K_ANONYMITY_THRESHOLD,
} from '../services/insightsService.js';

const router = express.Router();

/**
 * GET /api/insights
 *
 * Read-only aggregated insights. Returns ONLY topic/day counters and derived
 * theme aggregates. Suppresses any bucket or theme below the k-anonymity
 * threshold (k=3) so that no individual submission is inferable.
 *
 * Does NOT expose complaint text, report ids, nullifiers, commitments,
 * roll numbers, names, DOB, or any per-submission record.
 */
router.get('/insights', (req, res) => {
  try {
    const db = getDatabase();
    res.status(200).json({
      ok: true,
      threshold: K_ANONYMITY_THRESHOLD,
      demoMode: isDemoModeEnabled(),
      topics: getTopicDayInsights(db),
      themes: getThemeInsights(db),
    });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to retrieve aggregated insights' });
  }
});

export default router;
