import express from 'express';
import { TOPICS } from '../config/topics.js';
import { getServerDay } from '../services/cryptoEncoding.js';

const router = express.Router();

/**
 * GET /api/complaint-context
 * 
 * Unauthenticated public endpoint providing authoritative serverDay
 * and valid complaint topics for client-side Semaphore proof generation.
 */
router.get('/complaint-context', (req, res) => {
  res.status(200).json({
    ok: true,
    serverDay: getServerDay(),
    topics: [...TOPICS],
  });
});

export default router;
