import express from 'express';
import { getDatabase } from '../db/database.js';
import { isValidTopic } from '../config/topics.js';
import {
  getServerDay,
  encodeScope,
  encodeComplaintMessage
} from '../services/cryptoEncoding.js';
import { getGroupRoot } from '../semaphore/groupService.js';
import { verifyComplaintProof } from '../services/proofVerificationService.js';
import { moderateComplaintText } from '../services/moderationService.js';
import { generateTrackingCode } from '../services/queueService.js';
import { analyzeComplaint } from '../services/aiAnalysisService.js';
import { upsertThemeSupport } from '../services/insightsService.js';

const router = express.Router();

/**
 * POST /api/submit
 *
 * Anonymous, privacy-preserving complaint submission endpoint.
 *
 * Request body:
 * {
 *   proof: <SemaphoreProof>,
 *   topicId: "FACULTY" | "INFRASTRUCTURE" | "OTHER",
 *   text: "<exact complaint text>"
 * }
 *
 * Execution Order:
 * 1. Validate request structure.
 * 2. Validate topicId.
 * 3. Validate complaint text.
 * 4. Calculate serverDay using authoritative backend clock.
 * 5. Calculate expected scope using topicId + ":" + serverDay.
 * 6. Calculate expected message from EXACT received complaint text.
 * 7. Obtain CURRENT Semaphore Group root from groupService.
 * 8. Verify proof using proofVerificationService.
 * 9. Reject if proof is invalid.
 * 10. Perform moderation on complaint text.
 * 11. If moderation REJECTS: stop without consuming nullifier.
 * 12. If moderation ACCEPTS: execute atomic SQLite transaction:
 *     - INSERT nullifier into used_nullifiers (uniqueness gate)
 *     - UPSERT aggregate bucket in insights (topic_id + server_day counters)
 *       NOTE: the original complaint text is NEVER persisted. Only aggregate
 *       counters (submission_count, warn_count) are retained.
 * 12b. Best-effort AI analysis of the in-memory text; generalized themes and a
 *      short neutral summary are upserted into insight_themes. Failures are
 *      swallowed and never affect the nullifier, aggregates, or the response.
 * 13. Return { ok: true, trackingCode: "..." }
 */
router.post('/submit', async (req, res) => {
  try {
    const body = req.body;

    // 1. Validate request structure
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ ok: false, error: 'Malformed request body' });
    }

    const { proof, topicId, text } = body;

    if (!proof || typeof proof !== 'object') {
      return res.status(400).json({ ok: false, error: 'Missing or invalid proof object' });
    }

    // 2. Validate topicId
    if (!topicId || typeof topicId !== 'string' || !isValidTopic(topicId)) {
      return res.status(400).json({ ok: false, error: 'Invalid or unsupported topicId' });
    }

    // 3. Validate complaint text
    if (typeof text !== 'string' || text.length === 0) {
      return res.status(400).json({ ok: false, error: 'Complaint text must be a non-empty string' });
    }

    // 4. Calculate serverDay authoritative value (client cannot override)
    const serverDay = getServerDay();

    // 5. Calculate expected scope
    let expectedScope;
    try {
      expectedScope = encodeScope(topicId, serverDay);
    } catch {
      return res.status(400).json({ ok: false, error: 'Error calculating expected scope' });
    }

    // 6. Calculate expected message from EXACT received text (byte-for-byte)
    let expectedMessage;
    try {
      expectedMessage = encodeComplaintMessage(text);
    } catch {
      return res.status(400).json({ ok: false, error: 'Error calculating expected message' });
    }

    // 7. Obtain CURRENT Semaphore Group root from groupService
    const currentRoot = getGroupRoot();
    if (!currentRoot) {
      return res.status(500).json({ ok: false, error: 'Semaphore group is not initialized' });
    }

    // 8 & 9. Call proofVerificationService and reject if invalid
    const verificationResult = await verifyComplaintProof({
      proof,
      expectedRoot: currentRoot,
      expectedScope,
      expectedMessage
    });

    if (!verificationResult.verified) {
      // Differentiate between structural/match mismatches and invalid crypto
      return res.status(400).json({
        ok: false,
        error: verificationResult.error || 'Semaphore proof verification failed'
      });
    }

    // 10 & 11. Perform deterministic moderation on the complaint text
    const moderation = moderateComplaintText(text);
    if (moderation.action === 'REJECT') {
      // Stop without consuming nullifier, inserting report, or creating queue row
      return res.status(422).json({
        ok: false,
        error: 'Complaint text rejected by moderation policy',
        reasons: moderation.reasons
      });
    }

    // 12. Moderation ACCEPTED (ALLOW or WARN) -> Execute atomic SQLite transaction
    const db = getDatabase();
    const nullifierStr = String(proof.nullifier);
    const warnIncrement = moderation.action === 'WARN' ? 1 : 0;
    const trackingCode = generateTrackingCode();

    try {
      const submitTx = db.transaction(() => {
        // Step A: Direct INSERT into used_nullifiers (uniqueness gate)
        // If nullifier already exists, PRIMARY KEY constraint immediately throws SQLite error,
        // which aborts the whole transaction -> aggregates are never double-counted.
        db.prepare('INSERT INTO used_nullifiers (nullifier) VALUES (?)').run(nullifierStr);

        // Step B: Increment the aggregate bucket for (topicId, serverDay).
        // CRITICAL: the original complaint text is never passed to any SQL statement.
        db.prepare(`
          INSERT INTO insights (topic_id, server_day, submission_count, warn_count)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(topic_id, server_day) DO UPDATE SET
            submission_count = submission_count + 1,
            warn_count = warn_count + excluded.warn_count
        `).run(topicId, serverDay, warnIncrement);
      });

      submitTx();
    } catch (err) {
      // Check for uniqueness constraint violation on used_nullifiers
      if (
        err.message.includes('UNIQUE constraint failed: used_nullifiers.nullifier') ||
        err.message.includes('PRIMARY KEY constraint failed') ||
        err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY' ||
        err.code === 'SQLITE_CONSTRAINT'
      ) {
        return res.status(409).json({
          ok: false,
          error: 'Complaint for this topic and day has already been submitted'
        });
      }

      // Any other unexpected failure
      return res.status(500).json({
        ok: false,
        error: 'Failed to process complaint submission'
      });
    }

    // 12b. Best-effort AI analysis (in-memory only, fail-safe).
    // Runs ONLY after the atomic transaction above has committed, so a provider
    // failure/timeout NEVER consumes a nullifier incorrectly or double-counts
    // aggregates. The raw complaint text is passed in memory to the AI service
    // (which truncates it for the request) and is never persisted or logged.
    try {
      const analysis = await analyzeComplaint({ text, topicId });
      if (analysis.ok && Array.isArray(analysis.themes) && analysis.themes.length > 0) {
        upsertThemeSupport(db, topicId, serverDay, analysis.themes, analysis.summary);
      }
    } catch {
      // Best-effort: AI insights are optional and must never break anonymous submission.
    }

    // 13. Successful submission response
    return res.status(200).json({
      ok: true,
      trackingCode
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: 'Internal server error'
    });
  }
});

export default router;
