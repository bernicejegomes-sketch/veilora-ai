import assert from 'node:assert/strict';
import {
  encodeComplaintMessage,
  encodeScope,
  getServerDay,
  VALID_TOPICS,
} from '../src/services/cryptoEncoding.js';
import { Identity, Group, generateProof, verifyProof } from '@semaphore-protocol/core';

console.log('--- Running Cryptographic Message & Scope Contract Tests (Step 4A) ---');

// Test 1: Same complaint text -> same message value
console.log('Test 1: Verifying same complaint text produces identical message...');
const textA = 'Water supply in Hostel Block C has been interrupted since yesterday.';
const msgA1 = encodeComplaintMessage(textA);
const msgA2 = encodeComplaintMessage(textA);
assert.strictEqual(msgA1, msgA2, 'Same complaint text must produce identical message');
console.log('✔ Test 1 Passed: Identical text produces identical message.');

// Test 2: Different complaint text -> different message value
console.log('Test 2: Verifying different complaint texts produce distinct messages...');
const textB = 'Water supply in Hostel Block D has been interrupted since yesterday.';
const textC = 'Water supply in Hostel Block C has been interrupted since yesterday!'; // 1 character difference
const msgB = encodeComplaintMessage(textB);
const msgC = encodeComplaintMessage(textC);
assert.notStrictEqual(msgA1, msgB, 'Different texts must produce different messages');
assert.notStrictEqual(msgA1, msgC, 'Slightly different texts must produce different messages');
assert.notStrictEqual(msgB, msgC, 'Distinct texts must produce different messages');
console.log('✔ Test 2 Passed: Different complaint texts produce distinct message values.');

// Test 3: Unicode complaint text is deterministic
console.log('Test 3: Verifying Unicode, accented, and multi-byte text is deterministic...');
const unicodeText = 'Professeur René: élève mécontent 🚨 — परीक्षा प्रश्नपत्र में त्रुटि थी (Exam paper had errors) 💯';
const unicodeMsg1 = encodeComplaintMessage(unicodeText);
const unicodeMsg2 = encodeComplaintMessage(unicodeText);
assert.strictEqual(unicodeMsg1, unicodeMsg2, 'Unicode complaint text must be strictly deterministic');
console.log('✔ Test 3 Passed: Unicode complaint text is deterministic.');

// Test 4: Empty complaint text handling
console.log('Test 4: Verifying empty complaint text handling...');
const emptyMsg = encodeComplaintMessage('');
assert.ok(typeof emptyMsg === 'string' && emptyMsg.length > 0, 'Empty text must produce a valid non-empty string');
assert.ok(/^\d+$/.test(emptyMsg), 'Empty text must produce a valid decimal numeric string');
// SHA-256 of empty string is e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
const expectedEmptyBigInt = BigInt('0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855').toString();
assert.strictEqual(emptyMsg, expectedEmptyBigInt, 'Empty text must match canonical SHA-256 digest of empty string');
console.log('✔ Test 4 Passed: Empty complaint text handled deterministically.');

// Test 5: Very long complaint text is deterministic
console.log('Test 5: Verifying very long complaint text (100,000 characters)...');
const longText = 'Long complaint text segment with details. '.repeat(2500); // 105,000 chars
const longMsg1 = encodeComplaintMessage(longText);
const longMsg2 = encodeComplaintMessage(longText);
assert.strictEqual(longMsg1, longMsg2, 'Long complaint text must produce identical message');
assert.ok(/^\d+$/.test(longMsg1), 'Long text message must be a valid decimal string');
console.log('✔ Test 5 Passed: Very long complaint text produces deterministic decimal message.');

// Test 6: Message representation does not use JavaScript Number
console.log('Test 6: Verifying message avoids JavaScript Number precision loss...');
// 256-bit hash integer exceeds Number.MAX_SAFE_INTEGER (9007199254740991)
const parsedAsNumber = Number(msgA1);
assert.ok(msgA1 !== parsedAsNumber.toString(), 'Converting 256-bit message to JS Number must lose precision');
assert.ok(typeof msgA1 === 'string', 'Message must be represented as a string');
assert.strictEqual(BigInt(msgA1).toString(), msgA1, 'Message must be exact lossless string representation of BigInt');
console.log('✔ Test 6 Passed: Message representation maintains full 256-bit precision without JS Number.');

// Test 7: Same topic + same server day -> same scope
console.log('Test 7: Verifying same topic + same server day produces identical scope...');
const scope1 = encodeScope('FACULTY', '2026-10-10');
const scope2 = encodeScope('FACULTY', '2026-10-10');
assert.strictEqual(scope1, scope2, 'Same topic and day must produce identical scope');
console.log('✔ Test 7 Passed: Same topic and day produces identical scope.');

// Test 8: Different topic + same day -> different scope
console.log('Test 8: Verifying different topic + same day produces different scope...');
const scopeInfra = encodeScope('INFRASTRUCTURE', '2026-10-10');
const scopeOther = encodeScope('OTHER', '2026-10-10');
assert.notStrictEqual(scope1, scopeInfra, 'FACULTY vs INFRASTRUCTURE must differ');
assert.notStrictEqual(scope1, scopeOther, 'FACULTY vs OTHER must differ');
assert.notStrictEqual(scopeInfra, scopeOther, 'INFRASTRUCTURE vs OTHER must differ');
console.log('✔ Test 8 Passed: Different topics on same day produce distinct scopes.');

// Test 9: Same topic + different day -> different scope
console.log('Test 9: Verifying same topic + different day produces different scope...');
const scopeDay2 = encodeScope('FACULTY', '2026-10-11');
assert.notStrictEqual(scope1, scopeDay2, 'Different days for same topic must produce distinct scopes');
console.log('✔ Test 9 Passed: Different days for same topic produce distinct scopes.');

// Test 10: Scope serialization cannot ambiguously collide
console.log('Test 10: Verifying scope serialization collision resistance...');
// Format: `${topicId}:${serverDay}`
assert.throws(() => encodeScope('INVALID_TOPIC', '2026-10-10'), /Invalid topic/);
assert.throws(() => encodeScope('FACULTY', 'invalid-date'), /Invalid serverDay/);
for (const topic of VALID_TOPICS) {
  assert.ok(!topic.includes(':'), 'Topics must not contain colon delimiter');
}
console.log('✔ Test 10 Passed: Scope serialization is strictly prefix-delimited and rejects invalid inputs.');

// Test 11: Frontend Web Crypto parity simulation
console.log('Test 11: Verifying frontend Web Crypto API parity...');
async function simulateFrontendEncodeMessage(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex).toString();
}

async function simulateFrontendEncodeScope(topicId, serverDay) {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${topicId}:${serverDay}`);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return BigInt('0x' + hex).toString();
}

const frontendMsg = await simulateFrontendEncodeMessage(textA);
assert.strictEqual(frontendMsg, msgA1, 'Frontend Web Crypto message must equal backend message byte-for-byte');

const frontendUnicodeMsg = await simulateFrontendEncodeMessage(unicodeText);
assert.strictEqual(frontendUnicodeMsg, unicodeMsg1, 'Frontend Web Crypto Unicode message must equal backend message');

const frontendScope = await simulateFrontendEncodeScope('INFRASTRUCTURE', '2026-10-10');
assert.strictEqual(frontendScope, scopeInfra, 'Frontend Web Crypto scope must equal backend scope');
console.log('✔ Test 11 Passed: Frontend Web Crypto and backend Node crypto produce identical outputs.');

// Test 12: Real Semaphore proof generation and verification using encoded message and scope
console.log('Test 12: Generating and verifying genuine Semaphore v4.14.3 proof...');
const testId = new Identity();
const testGroup = new Group([testId.commitment, new Identity().commitment]);

const proof = await generateProof(testId, testGroup, msgA1, scopeInfra);
assert.strictEqual(proof.message, msgA1, 'proof.message must strictly equal encoded complaint message');
assert.strictEqual(proof.scope, scopeInfra, 'proof.scope must strictly equal encoded scope');

const isProofValid = await verifyProof(proof);
assert.strictEqual(isProofValid, true, 'Semaphore proof generated with encoded message and scope must be valid');
console.log('✔ Test 12 Passed: Real Semaphore v4.14.3 proof generated and verified successfully.');

console.log('\n--- ALL 12 CRYPTO ENCODING TESTS PASSED SUCCESSFULLY! ---');
