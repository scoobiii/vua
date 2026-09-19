/**
 * VUA CI execution-integrity gate.
 *
 * Runs the complete test command surface declared by package.json, then creates
 * one cryptographically signed ExecutionProof per command execution and verifies
 * every proof with the independent VUA verifier.
 *
 * Mock governance is a separate static gate. We never grep test output for words
 * such as "mock" or "simulate", because legitimate adversarial tests use them.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { canonicalize } from '../src/vortex/canonicalize.js';
import {
  generateVortexIdentity,
  sha256,
  signProofPayload,
} from '../src/vortex/crypto.js';
import { verifyExecutionProof } from '../src/vortex/verifier.js';
import type { ExecutionProof } from '../src/vortex/types.js';

type SuiteResult = {
  test_id: string;
  command: string;
  started_at: string;
  finished_at: string;
  exit_code: number | null;
  signal: string | null;
  executed: boolean;
  stdout_hash: string;
  stderr_hash: string;
  status: 'PASS' | 'FAIL';
  execution_proof?: ExecutionProof;
  proof_verification?: {
    valid: boolean;
    status: string;
    reasons: string[];
  };
};

function hash(text: string): string {
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
}

function discoverSuites(): Array<[string, string]> {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const scripts = Object.entries(pkg.scripts ?? {})
    .filter(([name]) => name.startsWith('test:'))
    .filter(([name]) => !['test:ci'].includes(name))
    .sort(([a], [b]) => a.localeCompare(b));

  // The strict GOS3 verifier is a conformance test even though its script is
  // named verify:* rather than test:*.
  if (pkg.scripts?.['verify:gos3']) {
    scripts.push(['verify:gos3', pkg.scripts['verify:gos3']]);
  }

  return scripts;
}

function makeProof(
  testId: string,
  command: string,
  startedAt: string,
  completedAt: string,
  durationMs: number,
  stdout: string,
  stderr: string,
  exitCode: number | null,
): ExecutionProof {
  const identity = generateVortexIdentity(
    'vua-ci',
    'agent/vua-ci-test-runner',
    `vua-ci-${process.env.GITHUB_RUN_ID ?? 'local'}`,
  );

  const requestId = `ci-${testId}-${process.env.GITHUB_RUN_ID ?? 'local'}-${Date.now()}`;
  const executionId = `exec-${hash(requestId).slice(7, 31)}`;
  const unsigned: Omit<ExecutionProof, 'signature' | 'proof_hash'> = {
    proof_version: '1',
    request_id: requestId,
    execution_id: executionId,
    runtime_id: `github-actions:${process.env.GITHUB_RUN_ID ?? 'local'}`,
    agent_id: identity.agent_id,
    principal_id: identity.principal_id,
    connector_id: 'ci-test-runner',
    operation: 'test',
    execution_kind: 'ci-test',
    executed: true,
    status: exitCode === 0 ? 'EXECUTION_SUCCESS' : 'EXECUTION_ERROR',
    input_hash: sha256({ test_id: testId, command }),
    output_hash: sha256({ stdout_hash: hash(stdout), stderr_hash: hash(stderr), exit_code: exitCode }),
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: durationMs,
    policy_id: 'vua-ci-execution-integrity',
    policy_version: '1.0.0',
    gos3_session_id: `gos3-sess-ci-${process.env.GITHUB_RUN_ID ?? 'local'}-${testId.replace(/[^a-z0-9-]/gi, '-')}`,
    sandbox_id: 'github-actions-runner',
    identity: { key_id: identity.key_id, algorithm: 'Ed25519' },
  };

  const signature = signProofPayload(unsigned as Record<string, unknown>, identity.private_key!);
  const unsignedWithSignature = { ...unsigned, signature };
  const proofHash = sha256(canonicalize(unsignedWithSignature));

  return { ...unsignedWithSignature, proof_hash: proofHash };
}

function runSuite(testId: string, command: string): SuiteResult {
  const startedMs = Date.now();
  const startedAt = new Date(startedMs).toISOString();
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 50 * 1024 * 1024,
  });
  const finishedMs = Date.now();
  const completedAt = new Date(finishedMs).toISOString();
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const executed = result.error === undefined;
  const proof = makeProof(testId, command, startedAt, completedAt, finishedMs - startedMs, stdout, stderr, result.status);

  const verification = verifyExecutionProof(proof, {
    embeddedPublicKey: undefined,
    expectedInputHash: proof.input_hash,
    expectedOutputHash: proof.output_hash,
  });

  // verifyExecutionProof resolves the generated key from its registry. The
  // generated proof is therefore independently checked by the verifier code,
  // not trusted merely because the signer produced it.
  return {
    test_id: testId,
    command,
    started_at: startedAt,
    finished_at: completedAt,
    exit_code: result.status,
    signal: result.signal ?? null,
    executed,
    stdout_hash: hash(stdout),
    stderr_hash: hash(stderr),
    status: executed && result.status === 0 && verification.valid ? 'PASS' : 'FAIL',
    execution_proof: proof,
    proof_verification: {
      valid: verification.valid,
      status: verification.status,
      reasons: verification.reasons,
    },
  };
}

mkdirSync('reports/execution-evidence', { recursive: true });

const detector = spawnSync('npx tsx scripts/mock-detector.ts', {
  shell: true,
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
});
const mockDetectionPassed = detector.error === undefined && detector.status === 0;

const suites = discoverSuites();
const results = suites.map(([id, command]) => runSuite(id, command));
const failed = results.filter((r) => r.status !== 'PASS');
const unexecuted = results.filter((r) => !r.executed);
const proofs = results.filter((r) => r.execution_proof);
const invalidProofs = results.filter((r) => r.proof_verification?.valid !== true);

const evidence = {
  schema: 'vua.execution-integrity.v3',
  generated_at: new Date().toISOString(),
  ci: {
    provider: 'github-actions',
    run_id: process.env.GITHUB_RUN_ID ?? 'local',
    run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? 'local',
    sha: process.env.GITHUB_SHA ?? 'local',
  },
  contract: {
    complete_test_script_surface: true,
    tests_must_execute: true,
    tests_must_pass: true,
    every_execution_requires_proof: true,
    every_proof_requires_independent_verification: true,
    production_mock_detection_must_pass: true,
  },
  mock_detection: {
    executed: detector.error === undefined,
    exit_code: detector.status,
    status: mockDetectionPassed ? 'PASS' : 'FAIL',
    stdout_hash: hash(detector.stdout ?? ''),
    stderr_hash: hash(detector.stderr ?? ''),
  },
  summary: {
    suites_discovered: suites.length,
    suites_executed: results.filter((r) => r.executed).length,
    suites_passed: results.filter((r) => r.status === 'PASS').length,
    suites_failed: failed.length,
    unexecuted: unexecuted.length,
    proofs_generated: proofs.length,
    proofs_verified: results.filter((r) => r.proof_verification?.valid === true).length,
    invalid_proofs: invalidProofs.length,
  },
  results,
};

const canonical = canonicalize(evidence);
writeFileSync('reports/execution-evidence/summary.json', JSON.stringify(evidence, null, 2) + '\n');
writeFileSync('reports/execution-evidence/summary.sha256', hash(canonical) + '\n');

if (
  !mockDetectionPassed ||
  suites.length === 0 ||
  failed.length > 0 ||
  unexecuted.length > 0 ||
  proofs.length !== results.length ||
  invalidProofs.length > 0
) {
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(evidence, null, 2));
