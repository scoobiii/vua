/**
 * ==============================================================================
 * VORTEX FOUNDATION: PATCH ARENA POLICY & CHANGE CLASSIFICATION TESTS
 * ==============================================================================
 * Test coverage for intent-aware Patch Arena gate:
 * - Security changes (e.g. OAuth under src/vortex/oauth.ts)
 * - Performance changes
 * - Governance changes (Arena evaluator / workflow policy changes)
 * - Correctness changes
 * - Mixed security + performance changes (fails closed)
 * - Bounded no-regression criteria vs >=5% gain
 * ==============================================================================
 */

import {
  classifyFilePath,
  classifyChangeIntent,
  enforceIntentAwareVerdict,
  type ChangeIntent,
} from '../scripts/change-classification.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, description: string) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
}

console.log('🧪 Running Patch Arena Policy & Intent Classification Tests...\n');

// 1. File Path Classification Tests
console.log('📋 Suite 1: File Path Classification');
assert(classifyFilePath('src/vortex/oauth.ts') === 'security', 'OAuth is classified as security');
assert(classifyFilePath('src/vortex/crypto.ts') === 'security', 'Crypto is classified as security');
assert(classifyFilePath('src/vortex/policy.ts') === 'security', 'Policy is classified as security');
assert(classifyFilePath('scripts/agent-patch-arena.ts') === 'governance', 'Arena script is classified as governance');
assert(classifyFilePath('.github/workflows/agent-patch-arena.yml') === 'governance', 'Arena workflow is classified as governance');
assert(classifyFilePath('tests/patch-arena-policy.test.ts') === 'governance', 'Policy tests are classified as governance');
assert(classifyFilePath('src/vortex/canonicalize.ts') === 'performance', 'Canonicalize is classified as performance');
assert(classifyFilePath('src/vortex/semantic-oracle.ts') === 'performance', 'Semantic oracle is classified as performance');
assert(classifyFilePath('src/vortex/types.ts') === 'correctness', 'Types file is classified as correctness');
assert(classifyFilePath('docs/08-conectar-ao-claude-app.md') === 'documentation', 'Docs are classified as documentation');

// 2. Change Intent Set Classification Tests
console.log('\n📋 Suite 2: Multi-File Change Set Classification');
{
  const secResult = classifyChangeIntent(['src/vortex/oauth.ts', 'docs/oauth-guide.md']);
  assert(secResult.intent === 'security', 'Set with OAuth is classified as security');
}

{
  const perfResult = classifyChangeIntent(['src/vortex/canonicalize.ts']);
  assert(perfResult.intent === 'performance', 'Set with canonicalize is classified as performance');
}

{
  const govResult = classifyChangeIntent([
    'scripts/agent-patch-arena.ts',
    '.github/workflows/agent-patch-arena.yml',
    'tests/patch-arena-policy.test.ts',
  ]);
  assert(govResult.intent === 'governance', 'Set with arena files is classified as governance');
}

{
  const mixedResult = classifyChangeIntent([
    'src/vortex/oauth.ts',
    'src/vortex/canonicalize.ts',
  ]);
  assert(mixedResult.intent === 'mixed', 'Mixed security + performance is classified as mixed');
  assert(mixedResult.reasons.some((r) => r.includes('Fails closed')), 'Mixed reasons explain fail-closed');
}

{
  const corrResult = classifyChangeIntent(['src/vortex/types.ts', 'src/vortex/adapters/registry.ts']);
  assert(corrResult.intent === 'correctness', 'Set with types and adapters is classified as correctness');
}

// 3. Verdict Enforcement: Security Changes (PR #19 Scenario)
console.log('\n📋 Suite 3: Security Change Verdicts (PR #19 PREREQUISITE)');
{
  // PR #19 measured -0.35% throughput vs base
  const pr19Result = enforceIntentAwareVerdict({
    intent: 'security',
    canary_passed: true,
    delta_throughput_pct: -0.35,
    delta_latency_pct: 0.8, // slight latency change within 2%
    delta_memory_pct: 1.0,
    cv_pct: 4.2,
  });
  assert(pr19Result.verdict === 'PASS_SECURITY', 'PR #19 with -0.35% throughput achieves PASS_SECURITY');
  assert(pr19Result.is_approved === true, 'PR #19 is approved');
  assert(pr19Result.auto_merge_eligible === true, 'PR #19 is eligible for auto-merge');
}

{
  // Excessive regression should fail
  const regressedSecurity = enforceIntentAwareVerdict({
    intent: 'security',
    canary_passed: true,
    delta_throughput_pct: -3.5, // exceeds -2.0% bound
    delta_latency_pct: 1.0,
  });
  assert(regressedSecurity.verdict === 'FAIL_REGRESSION', 'Security change with -3.5% throughput fails regression');
  assert(regressedSecurity.is_approved === false, 'Regressed security change is rejected');
}

// 4. Verdict Enforcement: Performance Changes
console.log('\n📋 Suite 4: Performance Change Verdicts');
{
  const superiorPerf = enforceIntentAwareVerdict({
    intent: 'performance',
    canary_passed: true,
    delta_throughput_pct: 6.2, // >= 5.0%
    delta_latency_pct: 0.5,
  });
  assert(superiorPerf.verdict === 'PASS_SUPERIOR', 'Performance gain of +6.2% achieves PASS_SUPERIOR');
  assert(superiorPerf.is_approved === true, 'Superior performance change is approved');
}

{
  const weakPerf = enforceIntentAwareVerdict({
    intent: 'performance',
    canary_passed: true,
    delta_throughput_pct: 2.1, // < 5.0% required
    delta_latency_pct: 0.5,
  });
  assert(weakPerf.verdict === 'FAIL_REGRESSION', 'Performance change with only +2.1% fails to meet threshold');
  assert(weakPerf.is_approved === false, 'Weak performance change is not approved');
}

// 5. Verdict Enforcement: Governance Changes (PR #20 Scenario)
console.log('\n📋 Suite 5: Governance Change Verdicts (PR #20 Policy Fix)');
{
  const pr20Result = enforceIntentAwareVerdict({
    intent: 'governance',
    canary_passed: true,
    delta_throughput_pct: -0.1,
    delta_latency_pct: 0.2,
    policy_tests_passed: true,
  });
  assert(pr20Result.verdict === 'PASS_GOVERNANCE', 'PR #20 governance change achieves PASS_GOVERNANCE');
  assert(pr20Result.is_approved === true, 'PR #20 governance change is approved');
  assert(pr20Result.auto_merge_eligible === true, 'PR #20 is auto-merge eligible');
}

{
  const failedPolicyGov = enforceIntentAwareVerdict({
    intent: 'governance',
    canary_passed: true,
    delta_throughput_pct: 0.0,
    delta_latency_pct: 0.0,
    policy_tests_passed: false, // failed policy test
  });
  assert(failedPolicyGov.verdict === 'FAIL_REGRESSION', 'Governance change with failed policy tests fails');
}

// 6. Verdict Enforcement: Mixed Changes (Fail Closed)
console.log('\n📋 Suite 6: Mixed Changes');
{
  const mixedVerdict = enforceIntentAwareVerdict({
    intent: 'mixed',
    canary_passed: true,
    delta_throughput_pct: 10.0,
    delta_latency_pct: 0.0,
  });
  assert(mixedVerdict.verdict === 'NEEDS_MANUAL_REVIEW', 'Mixed change results in NEEDS_MANUAL_REVIEW');
  assert(mixedVerdict.is_approved === false, 'Mixed change is NOT auto-approved');
}

// 7. Binary Canary Disqualification
console.log('\n📋 Suite 7: Binary Canary Invariant Disqualification');
{
  const canaryFail = enforceIntentAwareVerdict({
    intent: 'security',
    canary_passed: false, // Canary failed
    delta_throughput_pct: 20.0,
    delta_latency_pct: 0.0,
  });
  assert(canaryFail.verdict === 'DISQUALIFIED', 'Canary failure triggers immediate DISQUALIFIED verdict');
  assert(canaryFail.is_approved === false, 'Disqualified change is rejected');
}

console.log(`\n🎉 All ${passed}/${total} Patch Arena Policy Tests Passed!`);
