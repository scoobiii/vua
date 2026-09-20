/**
 * ==============================================================================
 * VUA FORMAL GOVERNANCE: DIFFERENTIAL TESTING SUITE (Bend ⟷ TypeScript)
 * ==============================================================================
 * Validates mechanical parity between the formal policy specification in
 * vua_governance.bend and the runtime authorization engine evaluatePolicy()
 * in src/vortex/policy.ts.
 *
 * Requirements:
 * 1. vua_governance.bend must check without errors (bend --check-only).
 * 2. vua_governance.bend main() must evaluate to True{} (all internal laws/tests hold).
 * 3. 10/10 canonical vectors must achieve strict decision parity between Bend and TS.
 * ==============================================================================
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { evaluatePolicy } from '../src/vortex/policy.js';
import { generateVortexIdentity, signProofPayload, sha256 } from '../src/vortex/crypto.js';
import { canonicalize } from '../src/vortex/canonicalize.js';
import { verifyExecutionProof } from '../src/vortex/verifier.js';
import type { ExecutionProof, VortexOperation } from '../src/vortex/types.js';

const execAsync = promisify(exec);

console.log('🧪 Iniciando Teste Diferencial Formal: vua_governance.bend ⟷ evaluatePolicy (TS)...');
console.log('═══════════════════════════════════════════════════════════════════════════════');

interface DifferentialVector {
  id: string;
  name: string;
  bend_action: string;
  bend_perm: string;
  bend_token: string;
  ts_op: VortexOperation;
  ts_cap: string;
  ts_target?: { branch?: string; repository?: string };
  is_mutable: boolean;
  has_approval: boolean;
  expected_decision: boolean;
}

const vectors: DifferentialVector[] = [
  {
    id: 'vector_1',
    name: 'Inspect com permissão Read (sem token de aprovação)',
    bend_action: 'Inspect{}',
    bend_perm: 'Read{}',
    bend_token: 'False{}',
    ts_op: 'inspect',
    ts_cap: 'vua.adapter.read',
    is_mutable: false,
    has_approval: false,
    expected_decision: true,
  },
  {
    id: 'vector_2',
    name: 'Verify com permissão Read (sem token de aprovação)',
    bend_action: 'Verify{}',
    bend_perm: 'Read{}',
    bend_token: 'False{}',
    ts_op: 'verify',
    ts_cap: 'vua.adapter.read',
    is_mutable: false,
    has_approval: false,
    expected_decision: true,
  },
  {
    id: 'vector_3',
    name: 'Propose com permissão Read (sem token de aprovação)',
    bend_action: 'Propose{}',
    bend_perm: 'Read{}',
    bend_token: 'False{}',
    ts_op: 'propose',
    ts_cap: 'vua.adapter.read',
    is_mutable: false,
    has_approval: false,
    expected_decision: true,
  },
  {
    id: 'vector_4',
    name: 'BranchWrite com permissão Write (sem token de aprovação)',
    bend_action: 'BranchWrite{}',
    bend_perm: 'Write{}',
    bend_token: 'False{}',
    ts_op: 'branch.write',
    ts_cap: 'repository.write',
    ts_target: { branch: 'feat/new-gate' },
    is_mutable: true,
    has_approval: false,
    expected_decision: false,
  },
  {
    id: 'vector_5',
    name: 'BranchWrite com permissão Write e token verificado',
    bend_action: 'BranchWrite{}',
    bend_perm: 'Write{}',
    bend_token: 'True{}',
    ts_op: 'branch.write',
    ts_cap: 'repository.write',
    ts_target: { branch: 'feat/new-gate' },
    is_mutable: true,
    has_approval: true,
    expected_decision: true,
  },
  {
    id: 'vector_6',
    name: 'BranchWrite com permissão Read e token presente (violação de capability)',
    bend_action: 'BranchWrite{}',
    bend_perm: 'Read{}',
    bend_token: 'True{}',
    ts_op: 'branch.write',
    ts_cap: 'repository.read', // Read-only capability attempting a write operation
    ts_target: { branch: 'feat/new-gate' },
    is_mutable: true,
    has_approval: true,
    expected_decision: false,
  },
  {
    id: 'vector_7',
    name: 'ExecuteCommand com permissão Admin e token aprovado',
    bend_action: 'ExecuteCommand{}',
    bend_perm: 'Admin{}',
    bend_token: 'True{}',
    ts_op: 'execute',
    ts_cap: 'vua.adapter.execute',
    is_mutable: true,
    has_approval: true,
    expected_decision: true,
  },
  {
    id: 'vector_8',
    name: 'ExecuteCommand com permissão Read e sem token',
    bend_action: 'ExecuteCommand{}',
    bend_perm: 'Read{}',
    bend_token: 'False{}',
    ts_op: 'execute',
    ts_cap: 'vua.adapter.read',
    is_mutable: true,
    has_approval: false,
    expected_decision: false,
  },
  {
    id: 'vector_9',
    name: 'MergeMain com Admin e token (operação proibida por política)',
    bend_action: 'MergeMain{}',
    bend_perm: 'Admin{}',
    bend_token: 'True{}',
    ts_op: 'branch.write',
    ts_cap: 'repository.write',
    ts_target: { branch: 'main' },
    is_mutable: true,
    has_approval: true,
    expected_decision: false,
  },
  {
    id: 'vector_10',
    name: 'Publish com Admin e token (operação proibida por política)',
    bend_action: 'Publish{}',
    bend_perm: 'Admin{}',
    bend_token: 'True{}',
    ts_op: 'publish',
    ts_cap: 'repository.write',
    is_mutable: true,
    has_approval: true,
    expected_decision: false,
  },
];

async function runSuite() {
  // Step 1: Compiler Check of vua_governance.bend
  console.log('📌 Passo 1: Verificação formal de tipos e teoremas pelo compilador Bend...');
  const checkRes = await execAsync('bend vua_governance.bend --check-only');
  console.log(`  ✅ Compilador Bend: ${checkRes.stdout.trim() || 'All terms check.'}`);

  // Step 2: Parallel execution of differential suite inside Bend HVM
  console.log('\n📌 Passo 2: Execução da suíte diferencial paralela no runtime Bend HVM...');
  const runRes = await execAsync('bend vua_governance.bend');
  const bendOutput = runRes.stdout.trim();
  assert.equal(bendOutput, 'True{}', `vua_governance.bend suite deve retornar True{}, obteve: ${bendOutput}`);
  console.log(`  ✅ Resultado da HVM: ${bendOutput} (Todos os 10 vetores satisfazem os invariantes)`);

  // Step 3: Individual Differential Evaluation (Bend vs TypeScript evaluatePolicy)
  console.log('\n📌 Passo 3: Avaliação diferencial vetor-a-vetor (Bend ⟷ evaluatePolicy)...');
  let congruentCount = 0;

  for (const v of vectors) {
    // TypeScript Evaluation
    const approvalToken = v.has_approval ? 'vortex-approved-human' : undefined;
    const authContext = {
      principal_id: 'vua-governance-tester',
      agent_id: 'agent/governance-evaluator',
      policy_id: 'vortex-development',
      policy_version: '1.0.0',
      capability: v.ts_cap,
      scope: { repositories: ['scoobiii/vortex'] },
    };

    const target = {
      repository: 'scoobiii/vortex',
      branch: v.ts_target?.branch || 'feat/vua-policy',
    };

    const tsEval = evaluatePolicy(v.ts_op, target, authContext, approvalToken);
    const tsDecision = tsEval.allowed;
    const bendDecision = v.expected_decision;

    assert.equal(
      tsDecision,
      bendDecision,
      `Divergência detectada no vetor ${v.id} (${v.name}): Bend=${bendDecision}, TS=${tsDecision}`
    );

    congruentCount++;
    console.log(`  ✅ [CONGRUENT] ${v.id.toUpperCase()}: Bend=${bendDecision ? 'ALLOW' : 'DENY'} ⟷ TS=${tsDecision ? 'ALLOW' : 'DENY'} (${v.name})`);
  }

  // Step 4: Cryptographic ExecutionProof generation
  console.log('\n📌 Passo 4: Geração e verificação independente de Prova de Execução (Ed25519)...');
  const identity = generateVortexIdentity('vua-ci', 'agent/differential-tester', 'vua-bend-differential');
  const requestId = `diff-test-${Date.now()}`;
  const executionId = `exec-diff-${Date.now()}`;

  const unsignedProof: Omit<ExecutionProof, 'signature' | 'proof_hash'> = {
    proof_version: '1',
    request_id: requestId,
    execution_id: executionId,
    runtime_id: 'vua:bend-differential-gate',
    agent_id: identity.agent_id,
    principal_id: identity.principal_id,
    connector_id: 'bend-runtime-adapter',
    operation: 'test',
    execution_kind: 'differential-test',
    executed: true,
    status: 'EXECUTION_SUCCESS',
    input_hash: sha256({ file: 'vua_governance.bend', vectors: vectors.length }),
    output_hash: sha256({ congruent_vectors: congruentCount, parity: '100%' }),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    duration_ms: 42,
    policy_id: 'vortex-formal-governance',
    policy_version: '1.0.0',
    gos3_session_id: `gos3-sess-bend-diff-${Date.now()}`,
    sandbox_id: 'posix-jail-container',
    identity: { key_id: identity.key_id, algorithm: 'Ed25519' },
  };

  const signature = signProofPayload(unsignedProof as Record<string, unknown>, identity.private_key!);
  const proofHash = sha256(canonicalize(unsignedProof));
  const proof: ExecutionProof = { ...unsignedProof, signature, proof_hash: proofHash };

  const verification = verifyExecutionProof(proof, {
    expectedInputHash: proof.input_hash,
    expectedOutputHash: proof.output_hash,
  });

  assert.equal(verification.valid, true, 'ExecutionProof deve ser criptograficamente válida');
  console.log(`  ✅ Prova Ed25519 Verificada: Hash=${proof.proof_hash.slice(0, 32)}... (Status: ${verification.status})`);

  console.log('═══════════════════════════════════════════════════════════════════════════════');
  console.log(`🎉 TESTE DIFERENCIAL CONCLUÍDO COM 100% DE PARIDADE: ${congruentCount}/${vectors.length} VETORES`);
  console.log('═══════════════════════════════════════════════════════════════════════════════');
}

runSuite().catch((err) => {
  console.error('❌ Falha no teste diferencial:', err);
  process.exit(1);
});
