import { verifyProof } from '@semaphore-protocol/core';

/**
 * Validate that an object has the essential structure and fields of a SemaphoreProof (v4).
 * A valid SemaphoreProof contains:
 * - merkleTreeDepth: number
 * - merkleTreeRoot: string | bigint | number
 * - message: string | bigint | number
 * - nullifier: string | bigint | number
 * - scope: string | bigint | number
 * - points: Array
 *
 * @param {any} proof
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateProofStructure(proof) {
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) {
    return { valid: false, error: 'Proof must be a valid non-null object' };
  }

  const requiredFields = [
    'merkleTreeDepth',
    'merkleTreeRoot',
    'message',
    'nullifier',
    'scope',
    'points'
  ];

  for (const field of requiredFields) {
    if (proof[field] === undefined || proof[field] === null || proof[field] === '') {
      return { valid: false, error: `Missing or empty required proof field: ${field}` };
    }
  }

  if (typeof proof.merkleTreeDepth !== 'number' || proof.merkleTreeDepth <= 0) {
    return { valid: false, error: 'merkleTreeDepth must be a positive number' };
  }

  if (!Array.isArray(proof.points) || proof.points.length === 0) {
    return { valid: false, error: 'points must be a non-empty array' };
  }

  return { valid: true };
}

/**
 * Independently verify a submitted Semaphore proof against server-authoritative values.
 *
 * Checks performed:
 * 1. Validate proof has expected required fields and types.
 * 2. Validate proof.merkleTreeRoot strictly matches server's expectedRoot.
 * 3. Validate proof.scope strictly matches server's expectedScope.
 * 4. Validate proof.message strictly matches server's expectedMessage.
 * 5. Call Semaphore's verifyProof(proof) to perform the cryptographic SNARK verification.
 *
 * NOTE: For privacy and security, no sensitive proof inputs, texts, or nullifiers are logged.
 *
 * @param {object} params
 * @param {object} params.proof - The Semaphore proof object submitted by client
 * @param {string|bigint} params.expectedRoot - The server's current authoritative Semaphore group root
 * @param {string|bigint} params.expectedScope - The server-computed authoritative scope
 * @param {string|bigint} params.expectedMessage - The server-computed authoritative message hash
 * @returns {Promise<{ verified: boolean, error?: string }>}
 */
export async function verifyComplaintProof({
  proof,
  expectedRoot,
  expectedScope,
  expectedMessage
}) {
  // 1. Validate structural presence of expected parameters
  if (expectedRoot === undefined || expectedRoot === null || expectedRoot === '') {
    return { verified: false, error: 'Missing expectedRoot parameter' };
  }
  if (expectedScope === undefined || expectedScope === null || expectedScope === '') {
    return { verified: false, error: 'Missing expectedScope parameter' };
  }
  if (expectedMessage === undefined || expectedMessage === null || expectedMessage === '') {
    return { verified: false, error: 'Missing expectedMessage parameter' };
  }

  // 2. Validate structural integrity of the proof
  const structuralCheck = validateProofStructure(proof);
  if (!structuralCheck.valid) {
    return { verified: false, error: structuralCheck.error };
  }

  // 3. Compare proof.merkleTreeRoot with server authoritative root
  if (String(proof.merkleTreeRoot) !== String(expectedRoot)) {
    return { verified: false, error: 'Proof Merkle root does not match accepted group root' };
  }

  // 4. Compare proof.scope with server calculated scope
  if (String(proof.scope) !== String(expectedScope)) {
    return { verified: false, error: 'Proof scope does not match expected server scope' };
  }

  // 5. Compare proof.message with server calculated message
  if (String(proof.message) !== String(expectedMessage)) {
    return { verified: false, error: 'Proof message does not match expected complaint message hash' };
  }

  // 6. Cryptographic SNARK proof verification via Semaphore core
  try {
    const isCryptoValid = await verifyProof(proof);
    if (!isCryptoValid) {
      return { verified: false, error: 'Cryptographic proof verification failed' };
    }
  } catch (err) {
    return { verified: false, error: `Semaphore proof verification error: ${err.message}` };
  }

  return { verified: true };
}
