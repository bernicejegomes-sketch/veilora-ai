import { Group } from '@semaphore-protocol/core';

// BN254 scalar field order used by Semaphore V4 Poseidon Merkle Trees
export const SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

let groupInstance = null;

/**
 * Validate that an incoming commitment is a non-empty decimal string
 * representing a valid non-zero element in the Semaphore SNARK scalar field.
 */
export function isValidCommitment(commitment) {
  if (typeof commitment !== 'string') return false;
  if (!commitment || !/^[0-9]+$/.test(commitment)) return false;

  try {
    const val = BigInt(commitment);
    return val > 0n && val < SNARK_SCALAR_FIELD;
  } catch {
    return false;
  }
}

/**
 * Initialize or rebuild the in-memory Semaphore Group from SQLite commitments.
 * The SQLite database is the source of truth; the Group is derived in-memory state.
 */
export function rebuildGroup(db) {
  const rows = db.prepare('SELECT commitment FROM commitments ORDER BY rowid ASC').all();
  const group = new Group();

  for (const row of rows) {
    try {
      group.addMember(BigInt(row.commitment));
    } catch (err) {
      // Continue or log error if a stored commitment fails addition
      console.error('Failed to load commitment into group:', err.message);
    }
  }

  groupInstance = group;
  return groupInstance;
}

/**
 * Initialize the group on startup.
 */
export function initGroup(db) {
  return rebuildGroup(db);
}

/**
 * Get the current in-memory Semaphore Group.
 */
export function getGroup() {
  if (!groupInstance) {
    groupInstance = new Group();
  }
  return groupInstance;
}

/**
 * Idempotently add a newly enrolled commitment to the in-memory group.
 */
export function addCommitmentToGroup(commitment) {
  const group = getGroup();
  const commBigInt = BigInt(commitment);

  if (group.indexOf(commBigInt) === -1) {
    group.addMember(commBigInt);
  }
  return group;
}

/**
 * Helper to get group root as decimal string.
 */
export function getGroupRoot() {
  const group = getGroup();
  return group.root ? group.root.toString() : null;
}

/**
 * Helper to get current group size.
 */
export function getGroupSize() {
  const group = getGroup();
  return group.size;
}
