import crypto from 'node:crypto';
import { isDemoModeEnabled } from '../config/demoMode.js';

// In-memory verification attempt tracking to prevent brute-force attacks
const failedAttempts = new Map();
const MAX_ATTEMPTS = 5;

// Default OTP for development/testing (clearly documented as DEVELOPMENT-ONLY)
export const DEFAULT_DEV_OTP = process.env.DEV_OTP || '123456';
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes validity

/**
 * Cryptographically hash an OTP value using SHA-256.
 * Raw OTP values are never stored or logged.
 */
export function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp)).digest('hex');
}

/**
 * Issue an OTP for a student roll number.
 * Updates members table with the SHA-256 hash, expiry, and resets otp_used.
 * 
 * If DEMO_MODE is disabled and no real OTP provider is configured, fails safely.
 */
export function issueOtp(db, rollNo, otpValue = null, ttlMs = OTP_TTL_MS) {
  // If demo mode is not enabled and no external OTP value is supplied by a real provider,
  // fail safely instead of silently generating/accepting the static development OTP.
  if (!isDemoModeEnabled() && !otpValue) {
    return { ok: false, error: 'OTP delivery unavailable: Demo mode is disabled and no real OTP provider is configured' };
  }

  const effectiveOtp = otpValue || DEFAULT_DEV_OTP;
  const otpHash = hashOtp(effectiveOtp);
  const expiry = Date.now() + ttlMs;

  db.prepare(`
    UPDATE members
    SET otp_hash = ?, otp_expiry = ?, otp_used = 0
    WHERE roll_no = ?
  `).run(otpHash, expiry, rollNo);

  // Reset attempt counter on fresh OTP generation
  failedAttempts.delete(rollNo);

  return { expiry };
}

/**
 * Verify an incoming OTP for a student roll number.
 * 
 * Returns:
 * { valid: true } or { valid: false, reason: string }
 */
export function verifyOtp(db, rollNo, inputOtp) {
  // Check attempt rate limits
  const attempts = failedAttempts.get(rollNo) || 0;
  if (attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: 'rate_limited' };
  }

  const member = db.prepare(`
    SELECT otp_hash, otp_expiry, otp_used
    FROM members
    WHERE roll_no = ?
  `).get(rollNo);

  if (!member || !member.otp_hash) {
    return { valid: false, reason: 'not_found' };
  }

  if (member.otp_used === 1) {
    return { valid: false, reason: 'already_used' };
  }

  if (Date.now() > member.otp_expiry) {
    return { valid: false, reason: 'expired' };
  }

  const inputHash = hashOtp(inputOtp);
  if (inputHash !== member.otp_hash) {
    failedAttempts.set(rollNo, attempts + 1);
    return { valid: false, reason: 'mismatch' };
  }

  // Clear attempts on success
  failedAttempts.delete(rollNo);
  return { valid: true };
}

/**
 * Reset failed attempts (useful for tests)
 */
export function resetAttempts(rollNo) {
  if (rollNo) {
    failedAttempts.delete(rollNo);
  } else {
    failedAttempts.clear();
  }
}
