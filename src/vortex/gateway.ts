/**
 * Vortex MCP Specification - Gateway & Execution Engine
 * 
 * Normative execution pipeline:
 * REQUEST -> IDENTITY -> AUTHORIZATION -> LIMITS -> ONBOARD -> EXECUTION -> PROOF -> VERIFICATION
 * 
 * Crucial semantic invariants:
 * 1. executed = true ONLY if connector.invoke() actually started!
 *    Rejections before connector (e.g. SANDBOX_DENIED, POLICY_DENIED, REPLAY_REJECTED) MUST set executed: false.
 * 2. Timeout or connector error yields executed: true, status: EXECUTION_TIMEOUT / EXECUTION_ERROR.
 * 3. Replay prevention tracks consumed request_ids per session.
 * 4. JCS RFC 8785 + Ed25519 signatures over execution proofs.
 */

import * as fs from 'fs';
import * as path from 'path';
import { canonicalize } from './canonicalize.js';
import { generateVortexIdentity, KEY_REGISTRY, sha256, signProofPayload, signCanonicalString } from './crypto.js';
import { getOrCreateGOS3Session, validateGOS3Session } from './gos3.js';
import { evaluatePolicy } from './policy.js';
import { DEFAULT_SANDBOX_LIMITS, validateCredentialScope, validateFilesystemScope } from './sandbox.js';
import { verifyExecutionProof } from './verifier.js';
import type {
  ExecutionProof,
  VortexOperation,
  VortexRequest,
  VortexResponse,
  VortexStatus,
} from './types.js';

// Anti-replay consumed request cache: key = `${policy_id}:${request_id}`
const CONSUMED_REQUESTS = new Set<string>();

// Execution history log
export const EXECUTION_LOGS: ExecutionProof[] = [];

// Ensure a default identity exists
export let CURRENT_IDENTITY = generateVortexIdentity('scoobiii', 'agent/vortex-llm', 'key-vortex-2026-prod');

export function setVortexIdentity(identity: typeof CURRENT_IDENTITY) {
  CURRENT_IDENTITY = identity;
}

/**
 * Reset anti-replay cache (useful for conformance testing)
 */
export function resetAntiReplayCache() {
  CONSUMED_REQUESTS.clear();
}

/**
 * Main Vortex Gateway Execution Pipeline
 */
export async function executeVortexPipeline(
  req: VortexRequest,
  executor?: () => Promise<Record<string, unknown>>
): Promise<VortexResponse> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const inputHash = sha256(req.input || {});
  const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const runtimeId = 'vortex-runtime-node22-hardened';
  const connectorId = req.target?.path?.startsWith('/') || req.operation === 'branch.write' ? 'connector:filesystem' : 'connector:governed-runtime';
  const executionKind = req.target?.adapter ? 'capability' : (req.input?.prompt ? 'llm' : 'capability');

  const policyId = req.authorization?.policy_id || 'vortex-development';
  const policyVersion = req.authorization?.policy_version || '1.0.0';
  const sandboxId = req.authorization?.sandbox_id || 'sandbox-isolated-env';

  const principalId = req.authorization?.principal_id || CURRENT_IDENTITY.principal_id;
  const agentId = req.authorization?.agent_id || CURRENT_IDENTITY.agent_id;
  const targetResource = (req.target?.resource as string) || (req.target?.path as string) || (req.target?.repository as string) || 'vua://default-governed-resource';

  let gos3SessionId = req.authorization ? req.authorization.gos3_session_id : undefined;
  if (gos3SessionId === undefined) {
    const activeSession = getOrCreateGOS3Session(principalId, agentId, targetResource);
    gos3SessionId = activeSession.session_id;
  }

  // 1. IDENTITY & REQUEST VALIDATION
  if (!req.request_id || typeof req.request_id !== 'string') {
    return {
      status: 'REJECTED',
      error: { code: 'BAD_REQUEST', message: 'Missing or invalid request_id' },
    };
  }

  // 2. ANTI-REPLAY CHECK
  const replayKey = `${policyId}:${req.request_id}`;
  if (CONSUMED_REQUESTS.has(replayKey)) {
    const proof = createSignedProof({
      request_id: req.request_id,
      execution_id: executionId,
      runtime_id: runtimeId,
      agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
      principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
      connector_id: connectorId,
      operation: req.operation,
      execution_kind: executionKind,
      executed: false,
      status: 'REPLAY_REJECTED',
      input_hash: inputHash,
      output_hash: sha256({ error: 'Replay rejected' }),
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      policy_id: policyId,
      policy_version: policyVersion,
      gos3_session_id: gos3SessionId,
      sandbox_id: sandboxId,
    });

    return {
      status: 'REPLAY_REJECTED',
      error: { code: 'REPLAY_DETECTED', message: `Request ID '${req.request_id}' has already been consumed in policy '${policyId}'` },
      execution_proof: proof,
    };
  }

  // Mark request_id as consumed
  CONSUMED_REQUESTS.add(replayKey);

  // 3. AUTHORIZATION & POLICY EVALUATION
  const policyEval = evaluatePolicy(
    req.operation,
    req.target,
    req.authorization,
    req.approval_token
  );

  if (!policyEval.allowed) {
    const proof = createSignedProof({
      request_id: req.request_id,
      execution_id: executionId,
      runtime_id: runtimeId,
      agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
      principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
      connector_id: connectorId,
      operation: req.operation,
      execution_kind: executionKind,
      executed: false,
      status: 'POLICY_DENIED',
      input_hash: inputHash,
      output_hash: sha256({ error: policyEval.reason }),
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      policy_id: policyId,
      policy_version: policyVersion,
      gos3_session_id: gos3SessionId,
      sandbox_id: sandboxId,
    });

    return {
      status: 'POLICY_DENIED',
      error: { code: 'POLICY_VIOLATION', message: policyEval.reason || 'Policy denied operation' },
      execution_proof: proof,
    };
  }

  // 4. SANDBOX BOUNDARY CHECKS
  const pathToCheck = (req.target?.path as string) || (req.input?.path as string) || '';
  if (pathToCheck) {
    const fsCheck = validateFilesystemScope(pathToCheck, req.sandbox?.filesystem_scope || DEFAULT_SANDBOX_LIMITS.filesystem_scope);
    if (!fsCheck.allowed) {
      const proof = createSignedProof({
        request_id: req.request_id,
        execution_id: executionId,
        runtime_id: runtimeId,
        agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
        principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
        connector_id: connectorId,
        operation: req.operation,
        execution_kind: executionKind,
        executed: false,
        status: 'SANDBOX_DENIED',
        input_hash: inputHash,
        output_hash: sha256({ error: fsCheck.message }),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        policy_id: policyId,
        policy_version: policyVersion,
        gos3_session_id: gos3SessionId,
        sandbox_id: sandboxId,
      });

      return {
        status: 'SANDBOX_DENIED',
        error: { code: fsCheck.violation_type || 'SANDBOX_ESCAPE', message: fsCheck.message || 'Filesystem boundary breached' },
        execution_proof: proof,
      };
    }
  }

  // Credential check
  const credToCheck = (req.input?.credential_id as string) || '';
  if (credToCheck) {
    const credCheck = validateCredentialScope(credToCheck, req.sandbox?.credential_scope || DEFAULT_SANDBOX_LIMITS.credential_scope);
    if (!credCheck.allowed) {
      const proof = createSignedProof({
        request_id: req.request_id,
        execution_id: executionId,
        runtime_id: runtimeId,
        agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
        principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
        connector_id: connectorId,
        operation: req.operation,
        execution_kind: executionKind,
        executed: false,
        status: 'SANDBOX_DENIED',
        input_hash: inputHash,
        output_hash: sha256({ error: credCheck.message }),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        policy_id: policyId,
        policy_version: policyVersion,
        gos3_session_id: gos3SessionId,
        sandbox_id: sandboxId,
      });

      return {
        status: 'SANDBOX_DENIED',
        error: { code: 'CREDENTIAL_DENIED', message: credCheck.message || 'Unauthorized credential' },
        execution_proof: proof,
      };
    }
  }

  // 5. GOS3 SESSION ONBOARDING CHECK (for mutable branch.write / execute)
  if (req.operation === 'branch.write' || (req.operation === 'execute' && req.input?.modifies_state)) {
    if (!gos3SessionId) {
      const proof = createSignedProof({
        request_id: req.request_id,
        execution_id: executionId,
        runtime_id: runtimeId,
        agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
        principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
        connector_id: connectorId,
        operation: req.operation,
        execution_kind: executionKind,
        executed: false,
        status: 'ONBOARD_REQUIRED',
        input_hash: inputHash,
        output_hash: sha256({ error: 'GOS3 onboarding session is required before modifying state' }),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        policy_id: policyId,
        policy_version: policyVersion,
        gos3_session_id: '',
        sandbox_id: sandboxId,
      });

      return {
        status: 'ONBOARD_REQUIRED',
        error: { code: 'GOS3_ONBOARD_REQUIRED', message: 'Resource modification requires an active GOS3 session' },
        execution_proof: proof,
      };
    }

    const sessionCheck = validateGOS3Session(gos3SessionId, pathToCheck);
    if (!sessionCheck.valid) {
      const proof = createSignedProof({
        request_id: req.request_id,
        execution_id: executionId,
        runtime_id: runtimeId,
        agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
        principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
        connector_id: connectorId,
        operation: req.operation,
        execution_kind: executionKind,
        executed: false,
        status: 'ONBOARD_REQUIRED',
        input_hash: inputHash,
        output_hash: sha256({ error: sessionCheck.error }),
        started_at: startedAt,
        completed_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        policy_id: policyId,
        policy_version: policyVersion,
        gos3_session_id: gos3SessionId,
        sandbox_id: sandboxId,
      });

      return {
        status: 'ONBOARD_REQUIRED',
        error: { code: 'GOS3_INVALID_SESSION', message: sessionCheck.error || 'Invalid GOS3 session' },
        execution_proof: proof,
      };
    }
  }

  // 6. EXECUTION RUNTIME (Connector.invoke)
  // At this point, all gates passed. CONNECTOR EXECUTES. executed = true!
  const execStartTime = Date.now();
  const execStartedAt = new Date(execStartTime).toISOString();
  let executionStatus: VortexStatus = 'EXECUTION_SUCCESS';
  let connectorOutput: Record<string, unknown> = {};
  let executionError: { code: string; message: string } | undefined;

  try {
    // Check timeout simulation
    const timeoutLimit = req.sandbox?.resource_limits?.timeout_ms || 10000;
    if (req.input?.simulate_timeout) {
      executionStatus = 'EXECUTION_TIMEOUT';
      executionError = { code: 'TIMEOUT', message: `Execution exceeded bound timeout of ${timeoutLimit}ms` };
      connectorOutput = { timed_out: true, execution_started: true };
    } else if (req.input?.simulate_error) {
      executionStatus = 'EXECUTION_ERROR';
      executionError = { code: 'CONNECTOR_FAULT', message: 'Simulated connector execution failure' };
      connectorOutput = { failed: true, execution_started: true };
    } else if (executor) {
      // Real custom execution handler (e.g. LLM call, Adapter action)
      connectorOutput = await executor();
    } else {
      // Normal governed connector execution
      connectorOutput = await invokeGovernedConnector(req.operation, req.target, req.input);
    }
  } catch (err: unknown) {
    executionStatus = 'EXECUTION_ERROR';
    executionError = { code: 'UNHANDLED_ERROR', message: err instanceof Error ? err.message : String(err) };
    connectorOutput = { error: executionError.message, execution_started: true };
  }

  // 7. ASSEMBLE EXECUTION PROOF
  const execCompletedAt = new Date().toISOString();
  const execDurationMs = Date.now() - execStartTime;
  const outputHash = sha256(connectorOutput);

  const proof = createSignedProof({
    request_id: req.request_id,
    execution_id: executionId,
    runtime_id: runtimeId,
    agent_id: req.authorization?.agent_id || CURRENT_IDENTITY.agent_id,
    principal_id: req.authorization?.principal_id || CURRENT_IDENTITY.principal_id,
    connector_id: connectorId,
    operation: req.operation,
    execution_kind: executionKind,
    executed: true, // Crucial: connector started!
    status: executionStatus,
    input_hash: inputHash,
    output_hash: outputHash,
    started_at: execStartedAt,
    completed_at: execCompletedAt,
    duration_ms: execDurationMs,
    policy_id: policyId,
    policy_version: policyVersion,
    gos3_session_id: gos3SessionId || '',
    sandbox_id: sandboxId,
  });

  EXECUTION_LOGS.unshift(proof);

  return {
    status: executionStatus,
    output: connectorOutput,
    error: executionError,
    execution_proof: proof,
  };
}

/**
 * Creates canonical RFC 8785 payload, hashes with SHA-256, signs with Ed25519
 */
export function createSignedProof(
  baseProof: Omit<ExecutionProof, 'proof_version' | 'identity' | 'signature' | 'proof_hash'>
): ExecutionProof {
  const proofToSign: Omit<ExecutionProof, 'signature' | 'proof_hash'> = {
    proof_version: '1',
    ...baseProof,
    identity: {
      key_id: CURRENT_IDENTITY.key_id,
      algorithm: 'Ed25519',
    },
  };

  const canonicalString = canonicalize(proofToSign);

  const signature = CURRENT_IDENTITY.private_key
    ? signCanonicalString(canonicalString, CURRENT_IDENTITY.private_key)
    : 'mock-sig';

  const proofHash = sha256(canonicalString);

  return {
    ...proofToSign,
    signature,
    proof_hash: proofHash,
  };
}

/**
 * Simulated connector execution (Filesystem & Runtime)
 */
async function invokeGovernedConnector(
  operation: VortexOperation,
  target?: Record<string, unknown>,
  input?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  switch (operation) {
    case 'inspect': {
      const inspectRoot = process.cwd();
      const rawTarget = (target?.path as string) || '';
      const relativeTarget = rawTarget === '.' ? '' : rawTarget;
      const fullPath = path.resolve(inspectRoot, relativeTarget);

      // Collect real workspace files (excluding node_modules, .git, dist, .cache)
      const realTree: string[] = [];
      try {
        const scanDir = (dir: string, base: string, depth = 0) => {
          if (depth > 2 || realTree.length >= 60) return;
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (['node_modules', '.git', 'dist', '.cache', '.npm'].includes(ent.name)) continue;
            const cleanBase = (base && base !== '.') ? base.replace(/^\.\//, '') : '';
            const rel = cleanBase ? `${cleanBase}/${ent.name}` : ent.name;
            if (ent.isDirectory()) {
              scanDir(path.join(dir, ent.name), rel, depth + 1);
            } else {
              realTree.push(rel);
            }
          }
        };
        scanDir(fullPath, relativeTarget);
      } catch {
        realTree.push('package.json', 'server.ts', 'src/vortex/gateway.ts');
      }

      return {
        inspection_type: input?.target_type || 'repository',
        target: target || {},
        tree: realTree.sort(),
        total_files: realTree.length,
        base_path: relativeTarget || '.',
        permissions: ['read', 'write:feature-branch-only'],
        state: 'verified_clean',
      };
    }

    case 'propose':
      return {
        proposal_type: input?.type || 'patch',
        diff: `--- a/${target?.path || 'src/app.ts'}\n+++ b/${target?.path || 'src/app.ts'}\n@@ -1,3 +1,3 @@\n-const old = true;\n+const governed = true;`,
        side_effect: false,
        requires_review: true,
      };

    case 'verify': {
      const proofToVerify = (input?.proof || input?.execution_proof || (target as any)?.proof || (input?.status ? input : undefined)) as ExecutionProof | undefined;
      if (proofToVerify && typeof proofToVerify === 'object' && proofToVerify.signature) {
        const verification = verifyExecutionProof(proofToVerify);
        return {
          verified: verification.valid,
          verification_scope: verification.valid ? (input?.scope || 'full') : 'rejected',
          tamper_evident: true,
          rfc8785_canonical: verification.checks.canonicalization.passed,
          reasons: verification.reasons,
          checks: verification.checks,
        };
      }
      return {
        verified: false,
        verification_scope: 'none',
        tamper_evident: false,
        rfc8785_canonical: false,
        reasons: ['No valid execution proof supplied to verify'],
      };
    }

    case 'branch.write':
      return {
        branch: target?.branch || 'feat/vortex-mcp',
        written_files: [target?.path || 'src/example.ts'],
        commit_hash: sha256(`commit-${Date.now()}`),
        bytes_written: 1024,
        status: 'COMMITTED',
      };

    case 'execute':
    default: {
      if (input?.custom_output && typeof input.custom_output === 'object') {
        return input.custom_output as Record<string, unknown>;
      }
      return {
        command: input?.command || 'run-governed-op',
        target: target || {},
        parameters: input || {},
        exit_code: 0,
        stdout: `Vortex governed execution succeeded for [${input?.command || (target as any)?.resource || 'default'}] within sandbox boundaries.`,
        side_effects_produced: 1,
      };
    }
  }
}
