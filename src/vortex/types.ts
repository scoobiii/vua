/**
 * Vortex MCP Specification v1 - Normative Types
 * Foundation Execution Governance Profile over Model Context Protocol (MCP)
 * 
 * Fundamental Rule:
 * "Proof of execution is not proof of safety.
 *  SAFETY = AUTHORIZATION + BOUNDED EXECUTION + ACCOUNTABILITY + INDEPENDENT VERIFICATION + IDENTITY"
 */

export type VortexOperation =
  | 'inspect'
  | 'propose'
  | 'verify'
  | 'execute'
  | 'branch.write';

export type VortexStatus =
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'ONBOARD_REQUIRED'
  | 'POLICY_DENIED'
  | 'SANDBOX_DENIED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_SUCCESS'
  | 'EXECUTION_ERROR'
  | 'EXECUTION_TIMEOUT'
  | 'VERIFICATION_FAILED'
  | 'IDENTITY_INVALID'
  | 'REPLAY_REJECTED';

export interface CryptographicIdentity {
  agent_id: string;
  principal_id: string;
  key_id: string;
  algorithm: 'Ed25519';
  public_key: string;
  private_key?: string; // Kept server-side only
}

export interface CapabilityScope {
  repositories?: string[];
  branches?: string[];
  paths?: string[];
  credentials?: string[];
  max_timeout_ms?: number;
  [key: string]: unknown;
}

export interface GovernedCapability {
  capability: string;
  scope: CapabilityScope;
  side_effect: boolean;
  approval: 'required' | 'automatic' | 'prohibited';
}

export interface AuthorizationContext {
  principal_id: string;
  agent_id: string;
  policy_id: string;
  policy_version: string;
  capability: string;
  scope: CapabilityScope;
  gos3_session_id?: string;
  sandbox_id?: string;
}

export interface SandboxLimits {
  filesystem_scope: string[]; // Allowed directory roots
  network_scope: string[];    // Allowed hosts or 'none'
  credential_scope: string[]; // Allowed credential IDs
  process_scope?: string[];
  resource_limits: {
    timeout_ms: number;
    memory_mb: number;
    cpu_limit?: number;
  };
}

export interface GOS3HeaderContract {
  contract_version: string;
  resource_path: string;
  checksum: string;
  onboarded_at: string;
  required_capability: string;
}

export interface GOS3Session {
  session_id: string;
  principal_id: string;
  agent_id: string;
  resource: string;
  created_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  header_contract: GOS3HeaderContract;
}

export interface ExecutionProof {
  proof_version: '1';
  request_id: string;
  execution_id: string;
  runtime_id: string;
  agent_id: string;
  principal_id: string;
  connector_id: string;
  operation: VortexOperation | string;
  execution_kind?: 'llm' | 'capability' | string;
  executed: boolean; // True ONLY if connector.invoke was initiated!
  status: VortexStatus | string;
  input_hash: string;  // sha256:...
  output_hash: string; // sha256:...
  started_at: string;
  completed_at: string;
  duration_ms: number;
  policy_id: string;
  policy_version: string;
  gos3_session_id: string;
  sandbox_id: string;
  identity: {
    key_id: string;
    algorithm: 'Ed25519';
  };
  signature: string; // Base64 signature of JCS(Proof without signature)
  proof_hash?: string; // Tamper-evident hash of proof
}

export interface VortexRequestTarget {
  repository?: string;
  branch?: string;
  path?: string;
  [key: string]: unknown;
}

export interface VortexRequest {
  request_id: string;
  operation: VortexOperation;
  target?: VortexRequestTarget;
  input: Record<string, unknown>;
  authorization?: AuthorizationContext;
  sandbox?: Partial<SandboxLimits>;
  approval_token?: string;
}

export interface VortexResponse {
  status: VortexStatus;
  output?: Record<string, unknown> | unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  execution_proof?: ExecutionProof;
}

export interface VerificationCheck {
  passed: boolean;
  message: string;
  details?: unknown;
}

export interface VerificationResult {
  valid: boolean;
  status: 'VERIFIED' | 'VERIFICATION_FAILED';
  reasons: string[];
  checks: {
    schema: VerificationCheck;
    canonicalization: VerificationCheck;
    input_hash: VerificationCheck;
    output_hash: VerificationCheck;
    signature: VerificationCheck;
    identity: VerificationCheck;
    policy: VerificationCheck;
    session: VerificationCheck;
    anti_replay: VerificationCheck;
    scope: VerificationCheck;
    proof_hash?: VerificationCheck;
  };
  verified_at: string;
  canonical_jcs?: string;
}

export interface AdversarialResult {
  scenario: 'FORGE' | 'REPLAY' | 'ESCALATE' | 'ESCAPE' | 'TAMPER';
  name: string;
  description: string;
  expected_status: VortexStatus | 'SIGNATURE_INVALID' | 'HASH_MISMATCH';
  actual_status: string;
  passed: boolean;
  executed: boolean;
  proof?: ExecutionProof;
  evidence: string;
}

export interface FoundationE2EResult {
  id: string; // E2E-001 to E2E-010
  name: string;
  description: string;
  status: 'PASS' | 'FAIL';
  duration_ms: number;
  execution_proof?: ExecutionProof;
  verification?: VerificationResult;
  details?: Record<string, unknown>;
}

export interface ExecutionEvidence {
  schema: 'vortex-execution-evidence/v1';
  module: 'mcp' | 'gateway' | 'foundation-integration';
  commit_sha: string;
  ci: {
    provider: string;
    run_id: string;
    run_attempt: string;
    workflow: string;
  };
  suite: {
    name: string;
    version: string;
    source_hash: string;
  };
  result: {
    build: 'PASS' | 'FAIL';
    tests: 'PASS' | 'FAIL';
    coverage: string;
    integration: 'PASS' | 'FAIL';
    security: 'PASS' | 'FAIL';
    stress: 'PASS' | 'FAIL';
    performance: 'PASS' | 'FAIL';
    degradation: 'PASS' | 'FAIL';
  };
  execution_proofs: string[];
  canonical_hash?: string;
}

/**
 * Vortex Normative External Truth Contract
 */
export type ExternalEffect =
  | 'none'
  | 'local_only'
  | 'remote_confirmed'
  | 'remote_failed';

export interface VortexExecutionResult<T = unknown> {
  success: boolean;
  external_effect: ExternalEffect;
  authenticated: boolean;
  execution_kind: 'llm' | 'capability';
  provider: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  execution_proof?: ExecutionProof;
}

export interface ApprovalClaims {
  approval_id: string;
  approved_by: string;
  action: string;
  adapter_id: string;
  owner: string;
  repo: string;
  base: string;
  head: string;
  head_sha: string;
  diff_hash: string;
  payload_hash: string;
  issued_at: string;
  expires_at: string;
  nonce: string;
}
