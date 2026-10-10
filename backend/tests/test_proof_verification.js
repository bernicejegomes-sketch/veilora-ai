import assert from 'node:assert';
import { Identity, Group, generateProof } from '@semaphore-protocol/core';
import {
  encodeComplaintMessage,
  encodeScope,
  getServerDay
} from '../src/services/cryptoEncoding.js';
import {
  verifyComplaintProof,
  validateProofStructure
} from '../src/services/proofVerificationService.js';

console.log('--- Running Proof Verification Service Tests (Step 4C-1) ---');

async function runTests() {
  // Setup baseline Semaphore test identity and group
  const identity1 = new Identity();
  const identity2 = new Identity();
  const testGroup = new Group([identity1.commitment, identity2.commitment]);
  const groupRoot = testGroup.root.toString();

  const validText = 'Water dispenser on the 3rd floor of the CS building is leaking.';
  const validTopic = 'INFRASTRUCTURE';
  const serverDay = getServerDay();

  const expectedMessage = encodeComplaintMessage(validText);
  const expectedScope = encodeScope(validTopic, serverDay);

  console.log('Generating baseline genuine Semaphore proof for tests...');
  const genuineProof = await generateProof(identity1, testGroup, expectedMessage, expectedScope);
  console.log('Baseline proof generated.');

  // Test 1: Genuinely generated Semaphore proof verifies successfully
  console.log('Test 1: Verifying genuine proof with valid root, scope, and message...');
  const test1Result = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: groupRoot,
    expectedScope,
    expectedMessage
  });
  assert.strictEqual(test1Result.verified, true, 'Genuine proof should verify successfully');
  assert.strictEqual(test1Result.error, undefined);
  console.log('✔ Test 1 Passed: Genuine proof verified successfully.');

  // Test 2: Wrong Merkle root is rejected
  console.log('Test 2: Verifying rejection on wrong Merkle root...');
  const wrongRoot = '999999999999999999999999999999999999';
  const test2Result = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: wrongRoot,
    expectedScope,
    expectedMessage
  });
  assert.strictEqual(test2Result.verified, false, 'Wrong root must be rejected');
  assert.match(test2Result.error, /Merkle root does not match/);
  console.log('✔ Test 2 Passed: Wrong Merkle root rejected.');

  // Test 3: Wrong scope is rejected
  console.log('Test 3: Verifying rejection on wrong scope...');
  const wrongScope = encodeScope('FACULTY', serverDay); // different topic
  const test3Result = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: groupRoot,
    expectedScope: wrongScope,
    expectedMessage
  });
  assert.strictEqual(test3Result.verified, false, 'Wrong scope must be rejected');
  assert.match(test3Result.error, /scope does not match/);
  console.log('✔ Test 3 Passed: Wrong scope rejected.');

  // Test 4: Wrong message is rejected
  console.log('Test 4: Verifying rejection on wrong message...');
  const wrongMessage = encodeComplaintMessage('Different complaint text entirely.');
  const test4Result = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: groupRoot,
    expectedScope,
    expectedMessage: wrongMessage
  });
  assert.strictEqual(test4Result.verified, false, 'Wrong message must be rejected');
  assert.match(test4Result.error, /message does not match/);
  console.log('✔ Test 4 Passed: Wrong message rejected.');

  // Test 5: Tampered proof points are rejected by cryptographic verification
  console.log('Test 5: Verifying rejection of tampered proof points...');
  const tamperedProof = {
    ...genuineProof,
    points: ['123', '456', '789', '012', '345', '678', '901', '234'] // invalid points
  };
  const test5Result = await verifyComplaintProof({
    proof: tamperedProof,
    expectedRoot: groupRoot,
    expectedScope,
    expectedMessage
  });
  assert.strictEqual(test5Result.verified, false, 'Tampered proof points must fail verification');
  assert.ok(test5Result.error, 'Should have an error message');
  console.log('✔ Test 5 Passed: Tampered proof rejected cryptographically.');

  // Test 6: Missing required proof fields are rejected cleanly
  console.log('Test 6: Verifying rejection of malformed/missing proof fields...');
  const fields = ['merkleTreeDepth', 'merkleTreeRoot', 'message', 'nullifier', 'scope', 'points'];
  for (const field of fields) {
    const invalidProof = { ...genuineProof };
    delete invalidProof[field];
    const res = await verifyComplaintProof({
      proof: invalidProof,
      expectedRoot: groupRoot,
      expectedScope,
      expectedMessage
    });
    assert.strictEqual(res.verified, false, `Missing ${field} must fail`);
    assert.match(res.error, new RegExp(`Missing or empty required proof field: ${field}`));
  }

  // Also test null or non-object proof
  const nullProofRes = await verifyComplaintProof({
    proof: null,
    expectedRoot: groupRoot,
    expectedScope,
    expectedMessage
  });
  assert.strictEqual(nullProofRes.verified, false);
  assert.strictEqual(nullProofRes.error, 'Proof must be a valid non-null object');
  console.log('✔ Test 6 Passed: Missing/invalid proof fields rejected cleanly.');

  // Test 7: Proof generated for one group/root is rejected when checked against another group's root
  console.log('Test 7: Verifying cross-group proof rejection...');
  const otherIdentity1 = new Identity();
  const otherIdentity2 = new Identity();
  const otherGroup = new Group([otherIdentity1.commitment, otherIdentity2.commitment]);
  const otherGroupRoot = otherGroup.root.toString();

  // genuineProof was created for testGroup, check it against otherGroupRoot
  const test7Result = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: otherGroupRoot,
    expectedScope,
    expectedMessage
  });
  assert.strictEqual(test7Result.verified, false, 'Proof for testGroup must fail against otherGroupRoot');
  assert.match(test7Result.error, /Merkle root does not match/);
  console.log('✔ Test 7 Passed: Proof for different group/root rejected.');

  // Test 8: Explicit boundary test - verify that server expected parameters cannot be empty/omitted
  console.log('Test 8: Verifying server boundary: expected values cannot be empty or omitted...');
  const missingRootRes = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: null,
    expectedScope,
    expectedMessage
  });
  assert.strictEqual(missingRootRes.verified, false);
  assert.strictEqual(missingRootRes.error, 'Missing expectedRoot parameter');

  const missingScopeRes = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: groupRoot,
    expectedScope: '',
    expectedMessage
  });
  assert.strictEqual(missingScopeRes.verified, false);
  assert.strictEqual(missingScopeRes.error, 'Missing expectedScope parameter');

  const missingMsgRes = await verifyComplaintProof({
    proof: genuineProof,
    expectedRoot: groupRoot,
    expectedScope,
    expectedMessage: undefined
  });
  assert.strictEqual(missingMsgRes.verified, false);
  assert.strictEqual(missingMsgRes.error, 'Missing expectedMessage parameter');

  // Verify that passing client-provided proof fields as expected values is strictly rejected
  // if client tampered with them
  const clientTamperedProof = {
    ...genuineProof,
    scope: '123456789' // client tries to claim scope 123456789
  };
  const boundaryCheck = await verifyComplaintProof({
    proof: clientTamperedProof,
    expectedRoot: groupRoot,
    expectedScope, // authoritative server scope
    expectedMessage
  });
  assert.strictEqual(boundaryCheck.verified, false);
  assert.match(boundaryCheck.error, /Proof scope does not match/);
  console.log('✔ Test 8 Passed: Server-authoritative boundary enforced; client values not accepted.');

  console.log('\n--- ALL 8 PROOF VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
