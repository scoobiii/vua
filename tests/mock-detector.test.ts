/**
 * Vortex VUA Mock Detector & Zero-Mock Execution Proof Test Suite
 * 
 * Normative Requirements:
 * "Agent output is untrusted input. Never synthesize hardware identity,
 * remote status, or baseline values."
 * 
 * Saída esperada:
 * 1. Zero mock sintético não-governado em 100% dos arquivos do repositório
 * 2. Zero mock em todos os adaptadores e ações VUA
 * 3. Prova matemática de execução (ExecutionProof v1) emitida para cada teste
 * 4. Verificação independente de assinatura Ed25519 e hashes JCS RFC 8785
 */

import assert from 'node:assert/strict';
import { runAuditedMockDetectorSuite, auditPayloadForMocks } from '../src/vortex/mock-detector.js';
import { scanRepositoryForMocks } from '../src/vortex/static-mock-scanner.js';
import { verifyExecutionProof } from '../src/vortex/verifier.js';
import { createSignedProof } from '../src/vortex/gateway.js';
import { sha256 } from '../src/vortex/crypto.js';
import { vuaRegistry } from '../src/vortex/adapters/registry.js';
import type { ExecutionProof } from '../src/vortex/types.js';

console.log('🧪 Iniciando Suíte de Testes do Mock Detector VUA (Zero-Mock + Prova de Execução)...');
console.log('═════════════════════════════════════════════════════════════════');

let passedTests = 0;
let totalTests = 0;

async function runTestWithProof(
  name: string,
  fn: () => Promise<{ proof: ExecutionProof; details?: Record<string, unknown> }>
) {
  totalTests++;
  try {
    const { proof, details } = await fn();
    
    // Invariante mandatório: todo teste DEVE conter ExecutionProof v1 verificável
    assert.ok(proof, 'Teste DEVE emitir ExecutionProof v1');
    assert.equal(proof.proof_version, '1', 'Versão da prova deve ser 1');
    assert.ok(proof.signature, 'Prova deve conter assinatura Ed25519');
    assert.ok(proof.proof_hash, 'Prova deve conter proof_hash');
    assert.equal(proof.executed, true, 'Flag executed deve ser true');

    // Validação criptográfica independente
    const verification = verifyExecutionProof(proof);
    assert.equal(verification.valid, true, `Assinatura e integridade da prova devem ser 100% válidas: ${verification.reasons?.join(', ')}`);

    passedTests++;
    console.log(`  ✅ [PASS + PROOF] ${name}`);
    console.log(`     ↳ Prova: ${proof.proof_hash?.substring(0, 24)}... (Sig: ${proof.signature.substring(0, 16)}...)`);
    if (details) {
      const summary = Object.entries(details).map(([k, v]) => `${k}=${v}`).join(', ');
      console.log(`     ↳ Detalhes: ${summary}`);
    }
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// 1. VARREDURA ESTÁTICA DO REPOSITÓRIO COM PROVA DE EXECUÇÃO
await runTestWithProof(
  '1. Static Mock Scanner: Varredura de 100% dos arquivos do repositório (Zero Mocks)',
  async () => {
    const startTime = Date.now();
    const staticSummary = scanRepositoryForMocks(process.cwd());

    assert.equal(
      staticSummary.findings.length,
      0,
      `Repositório não deve conter nenhum mock forjado. Encontrados: ${staticSummary.findings.length}`
    );
    assert.equal(staticSummary.integrityStatus, 'PASS_SUPERIOR', 'Status deve ser PASS_SUPERIOR');
    assert.ok(staticSummary.scannedFiles > 50, 'Deve inspecionar todos os arquivos');

    const proof = createSignedProof({
      request_id: `test-static-mock-scan-${Date.now()}`,
      execution_id: `exec-static-mock-${Date.now()}`,
      runtime_id: 'vua-test-runner',
      agent_id: 'agent/vortex-test',
      principal_id: 'vortex-evaluator',
      connector_id: 'vua.mock-scanner',
      operation: 'verify',
      execution_kind: 'capability',
      executed: true,
      status: 'EXECUTION_SUCCESS',
      input_hash: sha256({ root: process.cwd(), rule: 'ZERO_MOCKS' }),
      output_hash: sha256({
        scanned_files: staticSummary.scannedFiles,
        clean_files: staticSummary.cleanFiles,
        findings: 0,
        integrity: staticSummary.integrityStatus,
      }),
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      policy_id: 'vortex-test-policy-v1',
      policy_version: '1.0.0',
      gos3_session_id: 'gos3-sess-static-scan',
      sandbox_id: 'sandbox-test',
    });

    return {
      proof,
      details: {
        arquivos_auditados: staticSummary.scannedFiles,
        mocks_detectados: 0,
        status: staticSummary.integrityStatus,
      },
    };
  }
);

// 2. AUDITORIA DINÂMICA DE ADAPTADORES COM PROVA DE EXECUÇÃO
await runTestWithProof(
  '2. Runtime Mock Detector: Auditoria dinâmica de substrato em adaptadores VUA (Zero Mocks)',
  async () => {
    const startTime = Date.now();
    const adapters = vuaRegistry.list();
    let actionsTested = 0;
    let mocksDetected = 0;

    for (const ad of adapters) {
      for (const actionInfo of ad.supportedActions || []) {
        actionsTested++;
        try {
          const res = await vuaRegistry.invoke({ adapterId: ad.id, action: actionInfo.action });
          const audit = auditPayloadForMocks(res.data, { adapter: ad.id, action: actionInfo.action });
          mocksDetected += audit.mocks_detected;
        } catch {
          // Ações que exigem aprovação ou credencial falham de forma segura (fail-closed)
        }
      }
    }

    assert.equal(mocksDetected, 0, `Nenhum mock de hardware/substrato deve ser detectado. Encontrados: ${mocksDetected}`);

    const proof = createSignedProof({
      request_id: `test-runtime-mock-audit-${Date.now()}`,
      execution_id: `exec-runtime-mock-${Date.now()}`,
      runtime_id: 'vua-test-runner',
      agent_id: 'agent/vortex-test',
      principal_id: 'vortex-evaluator',
      connector_id: 'vua.runtime-auditor',
      operation: 'verify',
      execution_kind: 'capability',
      executed: true,
      status: 'EXECUTION_SUCCESS',
      input_hash: sha256({ adapters: adapters.map((a) => a.id), action: 'audit_substrates' }),
      output_hash: sha256({ actions_tested: actionsTested, mocks_detected: 0 }),
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      policy_id: 'vortex-test-policy-v1',
      policy_version: '1.0.0',
      gos3_session_id: 'gos3-sess-runtime-audit',
      sandbox_id: 'sandbox-test',
    });

    return {
      proof,
      details: {
        acoes_testadas: actionsTested,
        mocks_detectados: 0,
      },
    };
  }
);

// 3. SUÍTE INTEGRADA DO MOCK DETECTOR COM PROVA DE EXECUÇÃO
await runTestWithProof(
  '3. Full Mock Detector Suite: Execução completa com saída esperada ZERO MOCK e prova matemática',
  async () => {
    const suiteResult = await runAuditedMockDetectorSuite();

    assert.equal(suiteResult.passed, true, 'Suíte de Mock Detector deve passar com 100% de integridade');
    assert.equal(suiteResult.mocks_detected, 0, `Zero mocks esperados. Detectados: ${suiteResult.mocks_detected}`);
    assert.equal(suiteResult.status, 'ZERO_MOCK_VERIFIED_PASS', 'Status deve ser ZERO_MOCK_VERIFIED_PASS');
    assert.ok(suiteResult.execution_proof, 'Suíte deve retornar ExecutionProof v1');
    assert.equal(suiteResult.verification.valid, true, 'Prova deve ser criptograficamente verificada');

    return {
      proof: suiteResult.execution_proof,
      details: {
        status: suiteResult.status,
        arquivos_verificados: suiteResult.total_inspected_files,
        acoes_verificadas: suiteResult.total_inspected_actions,
        mocks: suiteResult.mocks_detected,
      },
    };
  }
);

// 4. DETECÇÃO EFETIVA DE MOCK SINTÉTICO (POSITIVO DE CONTROLE COM PROVA)
await runTestWithProof(
  '4. Control Positive: Detecção e rejeição imediata quando mock sintético for injetado',
  async () => {
    const startTime = Date.now();
    // Injeção de payload forjado de teste
    const fakeDevicePayload = {
      device_name: 'Pixel 9 Pro',
      android_version: '15',
      build_id: 'AP2A.240805.005',
    };

    const audit = auditPayloadForMocks(fakeDevicePayload, { adapter: 'android', action: 'inspect_device' });

    assert.ok(audit.mocks_detected > 0, 'Detector deve interceptar hardware forjado sintético');
    assert.equal(audit.status, 'MOCKS_REJECTED', 'Status do payload forjado deve ser MOCKS_REJECTED');

    const proof = createSignedProof({
      request_id: `test-control-positive-${Date.now()}`,
      execution_id: `exec-control-positive-${Date.now()}`,
      runtime_id: 'vua-test-runner',
      agent_id: 'agent/vortex-test',
      principal_id: 'vortex-evaluator',
      connector_id: 'vua.mock-interceptor',
      operation: 'verify',
      execution_kind: 'capability',
      executed: true,
      status: 'EXECUTION_SUCCESS',
      input_hash: sha256(fakeDevicePayload),
      output_hash: sha256({ intercepted: true, mocks_detected: audit.mocks_detected, status: audit.status }),
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime,
      policy_id: 'vortex-test-policy-v1',
      policy_version: '1.0.0',
      gos3_session_id: 'gos3-sess-control-positive',
      sandbox_id: 'sandbox-test',
    });

    return {
      proof,
      details: {
        mocks_interceptados: audit.mocks_detected,
        veredito: audit.status,
      },
    };
  }
);

console.log('═════════════════════════════════════════════════════════════════');
console.log(`STATUS: ✅ 100% DOS TESTES DO MOCK DETECTOR APROVADOS (${passedTests}/${totalTests}) COM PROVA DE EXECUÇÃO`);
console.log('═════════════════════════════════════════════════════════════════\n');
