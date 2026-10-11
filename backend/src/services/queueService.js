import crypto from 'node:crypto';

/**
 * Generate a random tracking code for one-time return to client upon submission.
 *
 * Format: "INC-" + 16 hex characters.
 * Cryptographically random, independent of identity, nullifier, or any stored record.
 * The tracking code is intentionally NEVER persisted anywhere in the database.
 *
 * @returns {string}
 */
export function generateTrackingCode() {
  return 'INC-' + crypto.randomBytes(8).toString('hex').toUpperCase();
}
