/**
 * Canary Adapter Verification Tests
 * 
 * Asserts the fundamental invariant:
 * "Never derive execution from action=tool; verify proof before success: true;
 *  and block side-effects on policy denial, missing approval, or invalid proof."
 */

import { vuaRegistry, CanaryAdapter } from '../src/vortex/adapters/registry.js';
import { verifyExecutionProof } from '../src/vortex/verifier.js';
import { signProofPayload } from '../src/vortex/crypto.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Canary Assertion Failed: ${message}`);
  }
}

export async function runCanaryTests(): Promise<number> {
  let passedTests = 0;
  const canary = vuaRegistry.get('canary') as CanaryAdapter;
  assert(Boolean(canary), 'CanaryAdapter must be registered in VUAAdapterRegistry');

  // Reset canary state
  canary.sideEffectCount = 0;

  console.log('\n🐤 [CANARY INVARIANT TESTS]');

  // Test 1: Missing approval for mutable action (risk: write)
  console.log('  1. Testing missing approval for mutable action...');
  let approvalBlocked = false;
  try {
    await vuaRegistry.invoke({
      adapterId: 'canary',
      action: 'write',
      payload: { value: 42 },
      // Note: No approvalToken provided!
    });
  } catch (err: any) {
    if (err.message.includes('APPROVAL_REQUIRED')) {
      approvalBlocked = true;
    }
  }
  assert(approvalBlocked, 'Mutable write action without approval must be blocked');
  assert(canary.sideEffectCount === 0, 'Side effect count must remain 0 when approval is missing');
  passedTests++;
  console.log('     ✅ Missing approval successfully blocked before execution. sideEffectCount = 0');

  // Test 2: Policy denial via forbidden wildcard scope
  console.log('  2. Testing policy denial (overbroad wildcard scope)...');
  let scopeBlocked = false;
  try {
    await vuaRegistry.invoke({
      adapterId: 'canary',
      action: 'write',
      approvalToken: 'appr-token-12345',
      authorization: {
        principal_id: 'attacker',
        agent_id: 'agent/rogue',
        policy_id: 'vortex-runtime-policy',
        policy_version: '1.0.0',
        capability: 'vua.canary.execute',
        scope: {
          paths: ['*'], // Wildcard scope is strictly rejected!
        },
      },
    });
  } catch (err: any) {
    if (err.message.includes('WILDCARD_SCOPE_FORBIDDEN')) {
      scopeBlocked = true;
    }
  }
  assert(scopeBlocked, 'Wildcard scope must be blocked by policy');
  assert(canary.sideEffectCount === 0, 'Side effect count must remain 0 on policy denial');
  passedTests++;
  console.log('     ✅ Overbroad scope blocked before execution. sideEffectCount = 0');

  // Test 3: Authorized execution with valid approval and legitimate scope
  console.log('  3. Testing authorized execution with approval and bounded scope...');
  const validRes = await vuaRegistry.invoke({
    adapterId: 'canary',
    action: 'write',
    approvalToken: 'appr-token-verified',
    payload: { task: 'safe_write' },
  });

  assert(validRes.success === true, 'Authorized execution must return success: true');
  assert(validRes.execution_kind === 'capability', 'Execution kind must be capability');
  assert(validRes.capability_executed === true, 'Capability executed must be true');
  assert(canary.sideEffectCount === 1, 'Side effect count must now increment to 1');
  assert(Boolean(validRes.execution_proof), 'Execution proof must be present');
  assert(validRes.verification?.valid === true, 'Execution proof must be cryptographically valid');
  passedTests++;
  console.log('     ✅ Authorized execution succeeded. sideEffectCount = 1, proof verified = true');

  // Test 4: Tampered proof verification failure (proof tampering detection)
  console.log('  4. Testing detection of tampered execution proof...');
  if (validRes.execution_proof) {
    const tamperedProof = {
      ...validRes.execution_proof,
      output_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000', // Tampered hash!
    };
    const tamperedVerification = verifyExecutionProof(tamperedProof as any);
    assert(tamperedVerification.valid === false, 'Tampered proof must fail verification');
    assert(
      tamperedVerification.checks.signature.passed === false,
      'Tampered proof signature check must fail'
    );
    passedTests++;
    console.log('     ✅ Tampered proof rejected by independent verifier');
  }

  // Test 5: Read-only action does not require approval and does not cause mutation
  console.log('  5. Testing read-only non-mutating action...');
  const readRes = await vuaRegistry.invoke({
    adapterId: 'canary',
    action: 'read',
  });
  assert(readRes.success === true, 'Read-only action must succeed');
  assert(canary.sideEffectCount === 1, 'Read action must not increment sideEffectCount');
  passedTests++;
  console.log('     ✅ Read action executed without mutation. sideEffectCount = 1');

  console.log(`\n🎉 All ${passedTests} Canary Invariant Tests Passed!\n`);
  return passedTests;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCanaryTests().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
