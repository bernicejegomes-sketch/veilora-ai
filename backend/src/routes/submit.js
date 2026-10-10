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
import {
  generateReportId,
  generateQueueId,
  calculateQueueAvailableAfter,
  generateTrackingCode
} from '../services/queueService.js';

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
 *     - INSERT report into reports
 *     - INSERT queue row into queue
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
    const reportId = generateReportId();
    const queueId = generateQueueId();
    const availableAfter = calculateQueueAvailableAfter();
    const trackingCode = generateTrackingCode();

    try {
      const submitTx = db.transaction(() => {
        // Step A: Direct INSERT into used_nullifiers (uniqueness gate)
        // If nullifier already exists, PRIMARY KEY constraint immediately throws SQLite error
        db.prepare('INSERT INTO used_nullifiers (nullifier) VALUES (?)').run(nullifierStr);

        // Step B: Insert report into reports with exact received text
        db.prepare(`
          INSERT INTO reports (report_id, topic_id, complaint_text, status)
          VALUES (?, ?, ?, 'pending')
        `).run(reportId, topicId, text);

        // Step C: Insert corresponding queue row
        db.prepare(`
          INSERT INTO queue (queue_id, report_id, available_after, status)
          VALUES (?, ?, ?, 'queued')
        `).run(queueId, reportId, availableAfter);
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
