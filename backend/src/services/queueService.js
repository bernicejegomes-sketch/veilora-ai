import crypto from 'node:crypto';

/**
 * Generate a cryptographically secure random queue delay in seconds.
 * 
 * Range: e.g. 5 minutes to 30 minutes (300 to 1800 seconds).
 * Ensures release timing is not deterministic from identity or nullifier.
 *
 * @param {number} [minMinutes=5]
 * @param {number} [maxMinutes=30]
 * @returns {number} Unix epoch timestamp in seconds when report becomes available
 */
export function calculateQueueAvailableAfter(minMinutes = 5, maxMinutes = 30) {
  const minSeconds = minMinutes * 60;
  const maxSeconds = maxMinutes * 60;
  const range = maxSeconds - minSeconds;

  // Cryptographically secure random integer offset
  const randomOffset = crypto.randomInt(0, range + 1);
  const nowInSeconds = Math.floor(Date.now() / 1000);

  return nowInSeconds + minSeconds + randomOffset;
}

/**
 * Generate a random tracking code for one-time return to client upon submission.
 * 
 * Format: "INC-" + 16 hex characters
 * Cryptographically random, independent of identity, nullifier, or report_id.
 *
 * @returns {string}
 */
export function generateTrackingCode() {
  return 'INC-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}

/**
 * Generate a cryptographically random report_id.
 * 
 * Cryptographically random UUID v4 or random hex.
 * Independent of identity, nullifier, roll number, or timestamp.
 *
 * @returns {string}
 */
export function generateReportId() {
  return crypto.randomUUID();
}

/**
 * Generate a cryptographically random queue_id.
 *
 * @returns {string}
 */
export function generateQueueId() {
  return crypto.randomUUID();
}
