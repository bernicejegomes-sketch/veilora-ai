import crypto from 'node:crypto';

import { TOPICS, isValidTopic } from '../config/topics.js';

export { TOPICS, isValidTopic };
export const VALID_TOPICS = TOPICS;

/**
 * Derive the authoritative serverDay formatted as YYYY-MM-DD
 * in the configured server timezone.
 * 
 * @param {Date} [date=new Date()]
 * @param {string} [timezone]
 * @returns {string} e.g. "2026-10-10"
 */
export function getServerDay(date = new Date(), timezone = process.env.SERVER_TIMEZONE || 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Deterministically bind complaint text to a Semaphore proof message.
 * 
 * Exact Canonicalization Rule:
 * The exact UTF-8 byte sequence submitted by the client is preserved byte-for-byte.
 * No trimming, no lowercasing, and no Unicode normalization is performed.
 * 
 * Cryptographic Encoding:
 * 1. Compute SHA-256 over the UTF-8 bytes: SHA-256(UTF8(complaintText)).
 * 2. Convert the 32-byte digest to a 256-bit BigInt: BigInt("0x" + hexDigest).
 * 3. Serialize as base-10 decimal string: bigInt.toString().
 * 
 * Why this is valid for Semaphore v4.14.3:
 * Semaphore's internal hash function takes toBeHex(message, 32), which accepts
 * any integer in [0, 2^256 - 1]. A 32-byte SHA-256 hash strictly fits within 32 bytes.
 * Semaphore then internally computes keccak256(toBeHex(message, 32)) >> 8n to reduce
 * it to a 248-bit scalar field element inside the SNARK circuit.
 * Passing raw arbitrary text longer than 31 bytes causes ethers encodeBytes32String
 * to crash; hashing first guarantees universal text length support and constant width.
 * 
 * @param {string} text - The raw complaint text
 * @returns {string} Base-10 numeric decimal string
 */
export function encodeComplaintMessage(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Complaint text must be a string');
  }

  // Exact UTF-8 bytes preserved byte-for-byte
  const utf8Bytes = Buffer.from(text, 'utf-8');
  const hashHex = crypto.createHash('sha256').update(utf8Bytes).digest('hex');
  const messageBigInt = BigInt('0x' + hashHex);

  return messageBigInt.toString();
}

/**
 * Deterministically bind a complaint topic and serverDay to a Semaphore proof scope.
 * 
 * Canonicalization:
 * Format: `${topicId}:${serverDay}`
 * - topicId is strictly validated against VALID_TOPICS ('FACULTY', 'INFRASTRUCTURE', 'OTHER').
 * - serverDay must strictly follow 'YYYY-MM-DD'.
 * - Colon ':' is used as a strict non-colliding delimiter.
 * 
 * Cryptographic Encoding:
 * 1. UTF-8 encode the canonical string `${topicId}:${serverDay}`.
 * 2. Compute SHA-256 over the bytes.
 * 3. Convert 32-byte digest to 256-bit BigInt: BigInt("0x" + hexDigest).
 * 4. Return as base-10 decimal string: bigInt.toString().
 * 
 * @param {string} topicId - One of VALID_TOPICS
 * @param {string} serverDay - Date formatted as YYYY-MM-DD
 * @returns {string} Base-10 numeric decimal string
 */
export function encodeScope(topicId, serverDay) {
  if (!isValidTopic(topicId)) {
    throw new Error(`Invalid topic: '${topicId}'. Must be one of: ${VALID_TOPICS.join(', ')}`);
  }

  if (typeof serverDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(serverDay)) {
    throw new Error(`Invalid serverDay: '${serverDay}'. Must be in YYYY-MM-DD format.`);
  }

  const rawScopeString = `${topicId}:${serverDay}`;
  const utf8Bytes = Buffer.from(rawScopeString, 'utf-8');
  const hashHex = crypto.createHash('sha256').update(utf8Bytes).digest('hex');
  const scopeBigInt = BigInt('0x' + hashHex);

  return scopeBigInt.toString();
}
