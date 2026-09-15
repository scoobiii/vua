/**
 * Vortex Foundation Conformance Engine
 * 
 * 1. Adversarial Conformance Suite:
 *    - FORGE (tamper output_hash, executed, agent_id -> SIGNATURE_INVALID)
 *    - REPLAY (resend consumed request_id -> REPLAY_REJECTED)
 *    - ESCALATE (request write with read-only policy -> POLICY_DENIED)
 *    - ESCAPE (path traversal ../, sibling prefix, credential -> SANDBOX_DENIED)
 *    - TAMPER (mutate post-exec output -> HASH_MISMATCH)
 * 
 * 2. 10 Foundation E2Es (E2E-001 to E2E-010)
 */

import { sha256 } from './crypto.js';
import { executeVortexPipeline, resetAntiReplayCache } from './gateway.js';
import { createGOS3Session } from './gos3.js';
import { handleMCPMessage } from './mcp-server.js';
import type { AdversarialResult, ExecutionProof, FoundationE2EResult } from './types.js';
import { verifyExecutionProof } from './verifier.js';

/**
 * Execute the 5 Adversarial Conformance Tests
 */
export async function runAdversarialSuite(): Promise<AdversarialResult[]> {
  const results: AdversarialResult[] = [];

  // 1. FORGE TEST
  {
    const reqId = `adv-forge-${Date.now()}`;
    const res = await executeVortexPipeline({
      request_id: reqId,
      operation: 'inspect',
      input: { target_type: 'repository' },
    });

    if (res.execution_proof) {
      // Attacker tampers with output_hash and executed state
      const forgedProof: ExecutionProof = {
        ...res.execution_proof,
        output_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
        executed: !res.execution_proof.executed,
      };

      const verification = verifyExecutionProof(forgedProof);
      const passed = !verification.valid && verification.reasons.some((r) => r.includes('SIGNATURE_INVALID'));

      results.push({
        scenario: 'FORGE',
        name: 'Cryptographic Proof Forgery Defense',
        description: 'Altering output_hash or executed flag must invalidate Ed25519 signature',
        expected_status: 'SIGNATURE_INVALID',
        actual_status: verification.reasons[0] || 'VERIFIED',
        passed,
        executed: res.execution_proof.executed,
        proof: forgedProof,
        evidence: `Tampered output_hash verified by Independent Verifier -> Result: ${verification.status} (${verification.reasons.join('; ')})`,
      });
    }
  }

  // 2. REPLAY TEST
  {
    const replayId = `adv-replay-nonce-${Date.now()}`;
    const initial = await executeVortexPipeline({
      request_id: replayId,
      operation: 'inspect',
      input: { ping: true },
    });

    // Attempt replay with exact same request_id
    const replayed = await executeVortexPipeline({
      request_id: replayId,
      operation: 'inspect',
      input: { ping: true },
    });

    const passed = replayed.status === 'REPLAY_REJECTED';
    results.push({
      scenario: 'REPLAY',
      name: 'Anti-Replay Nonce Enforcement',
      description: 'Re-submitting consumed request_id must be rejected as REPLAY_REJECTED',
      expected_status: 'REPLAY_REJECTED',
      actual_status: replayed.status,
      passed,
      executed: replayed.execution_proof?.executed || false, // Must be false!
      proof: replayed.execution_proof,
      evidence: `Initial call status: ${initial.status}. Replay call status: ${replayed.status}, executed=${replayed.execution_proof?.executed}`,
    });
  }

  // 3. ESCALATE TEST
  {
    const reqId = `adv-escalate-${Date.now()}`;
    const escalated = await executeVortexPipeline({
      request_id: reqId,
      operation: 'branch.write',
      target: { repository: 'scoobiii/vortex', branch: 'feat/unauthorized' },
      input: { content: 'malicious payload' },
      authorization: {
        principal_id: 'attacker',
        agent_id: 'agent/malicious',
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        capability: 'repository.read', // Read-only capability attempting write!
        scope: { repositories: ['scoobiii/vortex'] },
      },
    });

    const passed = escalated.status === 'POLICY_DENIED';
    results.push({
      scenario: 'ESCALATE',
      name: 'Privilege Escalation Defense',
      description: 'Requesting branch.write using read-only capability must be rejected as POLICY_DENIED',
      expected_status: 'POLICY_DENIED',
      actual_status: escalated.status,
      passed,
      executed: escalated.execution_proof?.executed || false,
      proof: escalated.execution_proof,
      evidence: `Escalation attempt error: ${escalated.error?.message}. executed: ${escalated.execution_proof?.executed}`,
    });
  }

  // 4. ESCAPE TEST (Sandbox Traversal & Sibling Prefix)
  {
    const reqId = `adv-escape-${Date.now()}`;
    const escaped = await executeVortexPipeline({
      request_id: reqId,
      operation: 'execute',
      target: { path: '/workspace/vortex/../../etc/shadow' },
      input: { path: '/workspace/vortex/../../etc/shadow' },
      authorization: {
        principal_id: 'tester',
        agent_id: 'agent/test',
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        capability: 'sandbox.execute',
        scope: {},
      },
    });

    const passed = escaped.status === 'SANDBOX_DENIED';
    results.push({
      scenario: 'ESCAPE',
      name: 'Lexical Sandbox Escape Defense',
      description: 'Lexical traversal (../) or unauthorized path must trigger SANDBOX_DENIED',
      expected_status: 'SANDBOX_DENIED',
      actual_status: escaped.status,
      passed,
      executed: escaped.execution_proof?.executed || false,
      proof: escaped.execution_proof,
      evidence: `Escape attempt error: ${escaped.error?.message}. Violation: ${escaped.error?.code}`,
    });
  }

  // 5. TAMPER TEST (Post-Execution Output Mutation)
  {
    const reqId = `adv-tamper-${Date.now()}`;
    const res = await executeVortexPipeline({
      request_id: reqId,
      operation: 'inspect',
      input: { file: 'src/main.ts' },
    });

    if (res.execution_proof && res.output) {
      // Attacker alters output content after execution
      const fakeOutput = { ...(res.output as Record<string, unknown>), state: 'compromised' };
      const expectedOutputHash = sha256(fakeOutput);

      const verification = verifyExecutionProof(res.execution_proof, {
        expectedOutputHash,
      });

      const passed = !verification.valid && verification.reasons.some((r) => r.includes('Output hash mismatch'));
      results.push({
        scenario: 'TAMPER',
        name: 'Post-Execution Output Tamper Detection',
        description: 'Altered output artifact detected via cryptographic SHA-256 hash mismatch',
        expected_status: 'HASH_MISMATCH',
        actual_status: verification.reasons[0] || 'VERIFIED',
        passed,
        executed: res.execution_proof.executed,
        proof: res.execution_proof,
        evidence: `Tampered output hash mismatch verified. Actual proof output hash: ${res.execution_proof.output_hash} vs Tampered hash: ${expectedOutputHash}`,
      });
    }
  }

  return results;
}

/**
 * Execute the 10 Foundation Integration E2Es
 */
export async function runFoundationE2ESuite(): Promise<FoundationE2EResult[]> {
  const suite: FoundationE2EResult[] = [];

  // E2E-001: MCP -> Gateway -> filesystem real write & proof
  {
    const start = Date.now();
    const session = createGOS3Session('scoobiii', 'agent/vortex', '/workspace/vortex/src/lib.ts');
    const mcpRes = await handleMCPMessage({
      jsonrpc: '2.0',
      id: 'e2e-001',
      method: 'tools/call',
      params: {
        name: 'vortex.branch.write',
        arguments: {
          request_id: `e2e-001-req-${Date.now()}`,
          target: { repository: 'scoobiii/vortex', branch: 'feat/test', path: '/workspace/vortex/src/lib.ts' },
          input: { content: 'export const version = "1.0.0";' },
          authorization: {
            principal_id: 'scoobiii',
            agent_id: 'agent/vortex',
            policy_id: 'vortex-development',
            policy_version: '1.0.0',
            capability: 'repository.write',
            scope: { repositories: ['scoobiii/vortex'], branches: ['feat/*'] },
            gos3_session_id: session.session_id,
          },
          approval_token: 'vortex-approved-human',
        },
      },
    });

    const result = mcpRes.result as { status: string; execution_proof: ExecutionProof };
    const proof = result?.execution_proof;
    const verification = proof ? verifyExecutionProof(proof) : undefined;
    const passed = result?.status === 'EXECUTION_SUCCESS' && proof?.executed === true && verification?.valid === true;

    suite.push({
      id: 'E2E-001',
      name: 'MCP -> Gateway -> Filesystem Real Write & Proof',
      description: 'End-to-end MCP tool call triggering governed execution with valid GOS3 session and verified proof',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: proof,
      verification,
      details: { executed: proof?.executed, proof_status: result?.status },
    });
  }

  // E2E-002: MCP policy deny (write without write capability)
  {
    const start = Date.now();
    const mcpRes = await handleMCPMessage({
      jsonrpc: '2.0',
      id: 'e2e-002',
      method: 'tools/call',
      params: {
        name: 'vortex.branch.write',
        arguments: {
          request_id: `e2e-002-req-${Date.now()}`,
          target: { repository: 'scoobiii/vortex', branch: 'feat/test' },
          input: { content: 'alert(1);' },
          authorization: {
            principal_id: 'user',
            agent_id: 'agent',
            policy_id: 'vortex-development',
            policy_version: '1.0.0',
            capability: 'repository.read', // Read-only attempting branch write!
            scope: { repositories: ['scoobiii/vortex'] },
          },
        },
      },
    });

    const result = mcpRes.result as { status: string; execution_proof: ExecutionProof };
    const passed = result?.status === 'POLICY_DENIED' && result?.execution_proof?.executed === false;

    suite.push({
      id: 'E2E-002',
      name: 'MCP Policy Deny Enforcement',
      description: 'Unauthorized capability rejected at MCP governance boundary with executed: false',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: result?.execution_proof,
      details: { executed: result?.execution_proof?.executed, status: result?.status },
    });
  }

  // E2E-003: MCP policy allow (proper scoped operation)
  {
    const start = Date.now();
    const mcpRes = await handleMCPMessage({
      jsonrpc: '2.0',
      id: 'e2e-003',
      method: 'tools/call',
      params: {
        name: 'vortex.inspect',
        arguments: {
          request_id: `e2e-003-req-${Date.now()}`,
          target: { repository: 'scoobiii/vortex' },
          input: { target_type: 'repository' },
          authorization: {
            principal_id: 'scoobiii',
            agent_id: 'agent/vortex',
            policy_id: 'vortex-development',
            policy_version: '1.0.0',
            capability: 'repository.read',
            scope: { repositories: ['scoobiii/vortex'] },
          },
        },
      },
    });

    const result = mcpRes.result as { status: string; execution_proof: ExecutionProof };
    const passed = result?.status === 'EXECUTION_SUCCESS' && result?.execution_proof?.executed === true;

    suite.push({
      id: 'E2E-003',
      name: 'MCP Policy Allow for Governed Inspection',
      description: 'Authorized scoped inspection executes cleanly and outputs verifiable proof',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: result?.execution_proof,
      details: { executed: result?.execution_proof?.executed, status: result?.status },
    });
  }

  // E2E-004: Gateway sandbox deny (lexical / directory escape / sibling prefix)
  {
    const start = Date.now();
    const res = await executeVortexPipeline({
      request_id: `e2e-004-req-${Date.now()}`,
      operation: 'execute',
      target: { path: '/workspace/vortex-secret/key.pem' }, // Sibling directory escape!
      input: { path: '/workspace/vortex-secret/key.pem' },
      authorization: {
        principal_id: 'tester',
        agent_id: 'agent',
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        capability: 'sandbox.execute',
        scope: {},
      },
    });

    const passed = res.status === 'SANDBOX_DENIED' && res.execution_proof?.executed === false;
    suite.push({
      id: 'E2E-004',
      name: 'Gateway Sandbox Deny (Sibling Prefix Boundary)',
      description: 'Sibling prefix directory escape correctly rejected with executed=false',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: res.execution_proof,
      details: { error: res.error?.message, executed: res.execution_proof?.executed },
    });
  }

  // E2E-005: Credential scope deny
  {
    const start = Date.now();
    const res = await executeVortexPipeline({
      request_id: `e2e-005-req-${Date.now()}`,
      operation: 'execute',
      input: { credential_id: 'cred-super-admin-root' }, // Unauthorized credential
      authorization: {
        principal_id: 'tester',
        agent_id: 'agent',
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        capability: 'sandbox.execute',
        scope: {},
      },
    });

    const passed = res.status === 'SANDBOX_DENIED' && res.error?.code === 'CREDENTIAL_DENIED' && res.execution_proof?.executed === false;
    suite.push({
      id: 'E2E-005',
      name: 'Credential Scope Deny Boundary',
      description: 'Unauthorized credential access blocked before connector invocation',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: res.execution_proof,
      details: { error: res.error?.message, executed: res.execution_proof?.executed },
    });
  }

  // E2E-006: Timeout real
  {
    const start = Date.now();
    const res = await executeVortexPipeline({
      request_id: `e2e-006-req-${Date.now()}`,
      operation: 'execute',
      input: { simulate_timeout: true },
      authorization: {
        principal_id: 'tester',
        agent_id: 'agent',
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        capability: 'sandbox.execute',
        scope: {},
      },
    });

    // Normative rule: timeout initiated connector, so executed=true, status=EXECUTION_TIMEOUT
    const passed = res.status === 'EXECUTION_TIMEOUT' && res.execution_proof?.executed === true;
    suite.push({
      id: 'E2E-006',
      name: 'Deterministic Timeout Invariant',
      description: 'Connector started execution then timed out; executed MUST be true with status EXECUTION_TIMEOUT',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: res.execution_proof,
      details: { executed: res.execution_proof?.executed, status: res.status },
    });
  }

  // E2E-007: Independent verification
  {
    const start = Date.now();
    const res = await executeVortexPipeline({
      request_id: `e2e-007-req-${Date.now()}`,
      operation: 'propose',
      input: { type: 'config-update', diff: '+governance: strict' },
    });

    const verif = res.execution_proof ? verifyExecutionProof(res.execution_proof) : undefined;
    const passed = verif?.valid === true && verif.checks.signature.passed && verif.checks.canonicalization.passed;

    suite.push({
      id: 'E2E-007',
      name: 'Independent Verification Third-Party Audit',
      description: 'Unbiased external verifier reconstructs RFC 8785 JCS and verifies Ed25519 signature',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: res.execution_proof,
      verification: verif,
      details: { verified: verif?.valid, checks: verif?.checks },
    });
  }

  // E2E-008: Concurrent replay prevention
  {
    const start = Date.now();
    const sharedNonce = `e2e-008-nonce-${Date.now()}`;
    const p1 = executeVortexPipeline({ request_id: sharedNonce, operation: 'inspect', input: { query: 'p1' } });
    const p2 = executeVortexPipeline({ request_id: sharedNonce, operation: 'inspect', input: { query: 'p2' } });

    const [r1, r2] = await Promise.all([p1, p2]);
    const replayRejectedCount = [r1, r2].filter((r) => r.status === 'REPLAY_REJECTED').length;
    const successCount = [r1, r2].filter((r) => r.status === 'EXECUTION_SUCCESS').length;
    const passed = replayRejectedCount === 1 && successCount === 1;

    suite.push({
      id: 'E2E-008',
      name: 'Concurrent Anti-Replay Prevention',
      description: 'Parallel requests with identical nonce guarantee exactly one execution and one REPLAY_REJECTED',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      details: { r1_status: r1.status, r2_status: r2.status, replay_blocked: replayRejectedCount === 1 },
    });
  }

  // E2E-009: Tamper post-execution detection
  {
    const start = Date.now();
    const res = await executeVortexPipeline({
      request_id: `e2e-009-req-${Date.now()}`,
      operation: 'inspect',
      input: { file: 'vortex.config.json' },
    });

    const forgedProof: ExecutionProof = {
      ...(res.execution_proof as ExecutionProof),
      agent_id: 'agent/impersonator', // Tamper with agent_id!
    };
    const verif = verifyExecutionProof(forgedProof);
    const passed = verif.valid === false && verif.reasons.some((r) => r.includes('SIGNATURE_INVALID'));

    suite.push({
      id: 'E2E-009',
      name: 'Post-Execution Tamper Invariant',
      description: 'Tampering with agent_id or metadata instantly trips Ed25519 cryptographic mismatch',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: forgedProof,
      verification: verif,
      details: { tamper_detected: !verif.valid, rejection_reason: verif.reasons[0] },
    });
  }

  // E2E-010: Governance context propagation
  {
    const start = Date.now();
    const session = createGOS3Session('scoobiii', 'agent/llm', '/workspace/vortex/spec/vortex-mcp.md');
    const res = await executeVortexPipeline({
      request_id: `e2e-010-req-${Date.now()}`,
      operation: 'branch.write',
      target: { repository: 'scoobiii/vortex', branch: 'feat/e2e', path: '/workspace/vortex/spec/vortex-mcp.md' },
      input: { content: '# Vortex Spec update' },
      authorization: {
        principal_id: 'scoobiii',
        agent_id: 'agent/llm',
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        capability: 'repository.write',
        scope: { repositories: ['scoobiii/vortex'], branches: ['feat/*'] },
        gos3_session_id: session.session_id,
        sandbox_id: 'sandbox-vortex-strict',
      },
      approval_token: 'vortex-approved-human',
    });

    const proof = res.execution_proof;
    const passed =
      res.status === 'EXECUTION_SUCCESS' &&
      proof?.gos3_session_id === session.session_id &&
      proof?.sandbox_id === 'sandbox-vortex-strict' &&
      proof?.policy_id === 'vortex-development';

    suite.push({
      id: 'E2E-010',
      name: 'End-to-End Governance Context Propagation',
      description: 'Verifies GOS3 session, sandbox ID, policy version, and identities propagate unbroken to proof',
      status: passed ? 'PASS' : 'FAIL',
      duration_ms: Date.now() - start,
      execution_proof: proof,
      details: {
        gos3_session_propagated: proof?.gos3_session_id === session.session_id,
        sandbox_propagated: proof?.sandbox_id === 'sandbox-vortex-strict',
      },
    });
  }

  return suite;
}

/**
 * Execute VUA Multi-Environment Conformance Suite
 * Tests all 4 platform adapters: GitHub, Linux, Android, and Windows.
 */
export async function runVUAAdaptersE2ESuite(): Promise<{
  adapter: string;
  action: string;
  passed: boolean;
  duration_ms: number;
  proof_verified: boolean;
  output: Record<string, unknown>;
}[]> {
  const { vuaRegistry } = await import('./adapters/registry.js');
  const results: any[] = [];

  // 1. GitHub Adapter: inspect_repo
  {
    const t0 = Date.now();
    const res = await vuaRegistry.invoke({
      adapterId: 'github',
      action: 'inspect_repo',
      target: { owner: 'vortex-foundation', repo: 'vua-connector' },
    });
    results.push({
      adapter: 'github',
      action: 'inspect_repo',
      passed: res.success && res.verification?.valid === true,
      duration_ms: Date.now() - t0,
      proof_verified: res.verification?.valid === true,
      output: res.data,
    });
  }

  // 2. Linux Adapter: inspect_system & sandbox jail check
  {
    const t0 = Date.now();
    const res = await vuaRegistry.invoke({
      adapterId: 'linux',
      action: 'sandbox_jail_check',
      payload: { test_path: '/tmp/vua-sandbox/../etc/shadow' },
    });
    results.push({
      adapter: 'linux',
      action: 'sandbox_jail_check',
      passed: res.success && res.verification?.valid === true && res.data.containment_secure === true,
      duration_ms: Date.now() - t0,
      proof_verified: res.verification?.valid === true,
      output: res.data,
    });
  }

  // 3. Android Adapter: verify_apk & scoped_storage_audit
  {
    const t0 = Date.now();
    const res = await vuaRegistry.invoke({
      adapterId: 'android',
      action: 'verify_apk',
      payload: { package_name: 'com.vortex.foundation.vua' },
    });
    results.push({
      adapter: 'android',
      action: 'verify_apk',
      passed: res.success && res.verification?.valid === true && res.data.apk_signing_scheme_v2 === true,
      duration_ms: Date.now() - t0,
      proof_verified: res.verification?.valid === true,
      output: res.data,
    });
  }

  // 4. Windows Adapter: inspect_acls & powershell_exec
  {
    const t0 = Date.now();
    const res = await vuaRegistry.invoke({
      adapterId: 'windows',
      action: 'inspect_acls',
      payload: { path: 'C:\\VUA\\Sandbox\\secure_payload.dat' },
    });
    results.push({
      adapter: 'windows',
      action: 'inspect_acls',
      passed: res.success && res.verification?.valid === true && res.data.dacl_compliant === true,
      duration_ms: Date.now() - t0,
      proof_verified: res.verification?.valid === true,
      output: res.data,
    });
  }

  return results;
}
