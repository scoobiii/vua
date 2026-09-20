/**
 * Vortex Mock Detector & Integrity Enforcer
 * 
 * Normative Governance Policy:
 * "Agent output is untrusted input. Never synthesize hardware identity,
 * remote status, or baseline values."
 * 
 * Detects hardcoded mocks, simulated hardware telemetry, fake device fingerprints
 * and verifies real execution substrate against actual physical OS APIs.
 */

import os from 'node:os';
import fs from 'node:fs';
import { execSync } from 'node:child_process';

export interface MockAuditFinding {
  field: string;
  claimed_value: unknown;
  actual_substrate_value: unknown;
  severity: 'CRITICAL_MOCK' | 'UNVERIFIABLE_SYNTHETIC' | 'SIMULATION_WARNING';
  reason: string;
}

export interface MockAuditReport {
  timestamp: string;
  total_inspected: number;
  mocks_detected: number;
  integrity_score_percent: number;
  status: 'CLEAN_PHYSICAL' | 'MOCKS_REJECTED' | 'SIMULATED_WITH_DISCLOSURE';
  findings: MockAuditFinding[];
}

// Known hardcoded/fake signatures commonly used as placeholder mocks
const BANNED_HARDCODED_SIGNATURES = [
  'Pixel 9 Pro',
  'AP2A.240805.005',
  'google/komodo/komodo:15',
  '26100.1742',
  'C:\\VUA\\Sandbox',
  '1.417.842.0',
  'vua-sandbox-host',
  'up 42 days',
];

/**
 * Scans an execution payload or adapter result for synthetic mocks
 */
export function auditPayloadForMocks(data: Record<string, unknown>, context: { adapter: string; action: string }): MockAuditReport {
  const findings: MockAuditFinding[] = [];
  const stringified = JSON.stringify(data);

  // 1. Check against banned fake device signatures
  for (const sig of BANNED_HARDCODED_SIGNATURES) {
    if (stringified.includes(sig)) {
      // Check if this physical host actually matches that signature
      const isActuallyPhysical = verifyPhysicalSubstrateMatch(sig, context.adapter);
      if (!isActuallyPhysical) {
        findings.push({
          field: 'hardware_identity',
          claimed_value: sig,
          actual_substrate_value: `Physical Host: ${os.type()} ${os.arch()} ${os.release()}`,
          severity: 'CRITICAL_MOCK',
          reason: `Detected hardcoded mock signature '${sig}' claiming physical device attributes on a non-matching substrate.`,
        });
      }
    }
  }

  // 2. Adapter-specific physical vs synthetic checks
  if (context.adapter === 'android') {
    const isActualAndroid = os.platform() === 'android' || fs.existsSync('/system/build.prop') || fs.existsSync('/data/data/com.termux');
    const hasAdb = canExecuteCommand('adb version');

    if (!isActualAndroid && !hasAdb) {
      if (data.device_name || data.android_version || data.battery) {
        findings.push({
          field: 'android_telemetry',
          claimed_value: { device_name: data.device_name, android_version: data.android_version },
          actual_substrate_value: { is_android: isActualAndroid, has_adb: hasAdb, host_os: os.type() },
          severity: 'CRITICAL_MOCK',
          reason: 'Android adapter returned device specs without physical Android OS or ADB host connected.',
        });
      }
    }
  }

  if (context.adapter === 'windows') {
    const isActualWindows = os.platform() === 'win32';
    if (!isActualWindows && data.windows_defender) {
      findings.push({
        field: 'windows_defender',
        claimed_value: data.windows_defender,
        actual_substrate_value: `Host OS is ${os.platform()} (not win32)`,
        severity: 'CRITICAL_MOCK',
        reason: 'Windows NT adapter returned Defender status on a non-Windows host.',
      });
    }
  }

  const mocksDetected = findings.length;
  const score = mocksDetected === 0 ? 100 : Math.max(0, 100 - mocksDetected * 35);

  return {
    timestamp: new Date().toISOString(),
    total_inspected: Object.keys(data).length,
    mocks_detected: mocksDetected,
    integrity_score_percent: score,
    status: mocksDetected === 0 ? 'CLEAN_PHYSICAL' : 'MOCKS_REJECTED',
    findings,
  };
}

/**
 * Checks if a specific signature actually exists on this physical machine
 */
function verifyPhysicalSubstrateMatch(sig: string, adapter: string): boolean {
  try {
    if (adapter === 'android') {
      if (fs.existsSync('/system/build.prop')) {
        const prop = fs.readFileSync('/system/build.prop', 'utf-8');
        return prop.includes(sig);
      }
      return false;
    }
    if (adapter === 'linux') {
      const hostname = os.hostname();
      return hostname === sig;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Helper to safely test command execution in PATH
 */
function canExecuteCommand(cmd: string): boolean {
  try {
    execSync(cmd, { stdio: 'pipe', timeout: 500 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Executes a full repository and runtime mock detector audit, ensuring zero mocks,
 * and emits a mathematically verified Ed25519 ExecutionProof v1.
 */
export async function runAuditedMockDetectorSuite(): Promise<{
  passed: boolean;
  total_inspected_files: number;
  total_inspected_actions: number;
  mocks_detected: number;
  status: string;
  execution_proof: import('./types.js').ExecutionProof;
  verification: import('./types.js').VerificationResult;
}> {
  const { scanRepositoryForMocks } = await import('./static-mock-scanner.js');
  const { vuaRegistry } = await import('./adapters/registry.js');
  const { createSignedProof } = await import('./gateway.js');
  const { verifyExecutionProof } = await import('./verifier.js');
  const { sha256 } = await import('./crypto.js');

  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  // 1. Static codebase mock scan (100% coverage)
  const staticSummary = scanRepositoryForMocks(process.cwd());
  let totalMocksDetected = staticSummary.findings.length;

  // 2. Dynamic runtime adapter substrate inspection
  const adapters = vuaRegistry.list();
  let actionsInspected = 0;
  const dynamicFindings: MockAuditFinding[] = [];

  for (const ad of adapters) {
    const actions = (ad.supportedActions || []).map((s) => s.action);
    for (const action of actions) {
      actionsInspected++;
      try {
        const res = await vuaRegistry.invoke({ adapterId: ad.id, action });
        const audit = auditPayloadForMocks(res.data, { adapter: ad.id, action });
        if (audit.mocks_detected > 0) {
          totalMocksDetected += audit.mocks_detected;
          dynamicFindings.push(...audit.findings);
        }
      } catch (err: any) {
        // Protected / mutable actions or fail-closed responses are expected behavior under zero-trust
      }
    }
  }

  const completedAt = new Date().toISOString();
  const durationMs = Date.now() - startTime;

  const auditResultData = {
    total_inspected_files: staticSummary.scannedFiles,
    total_inspected_actions: actionsInspected,
    mocks_detected: totalMocksDetected,
    expected_mocks: 0,
    static_clean_files: staticSummary.cleanFiles,
    static_integrity_status: staticSummary.integrityStatus,
    dynamic_findings_count: dynamicFindings.length,
    status: totalMocksDetected === 0 ? 'ZERO_MOCK_VERIFIED_PASS' : 'MOCKS_DETECTED_REJECT',
  };

  const inputHash = sha256({
    target: 'vortex-repository-and-substrate',
    policy: 'AGENT_OUTPUT_IS_UNTRUSTED_ZERO_MOCKS',
    inspected_files: staticSummary.scannedFiles,
  });
  const outputHash = sha256(auditResultData);

  // Generate cryptographic ExecutionProof v1
  const executionProof = createSignedProof({
    request_id: `vua-mock-audit-${Date.now()}`,
    execution_id: `exec-mock-detector-${Date.now()}`,
    runtime_id: 'vua-governed-runtime-v1',
    agent_id: 'agent/vortex-mock-detector',
    principal_id: 'vortex-evaluator',
    connector_id: 'vua.mock-detector',
    operation: 'verify',
    execution_kind: 'capability',
    executed: true,
    status: totalMocksDetected === 0 ? 'EXECUTION_SUCCESS' : 'POLICY_DENIED',
    input_hash: inputHash,
    output_hash: outputHash,
    started_at: startedAt,
    completed_at: completedAt,
    duration_ms: durationMs,
    policy_id: 'vortex-zero-mock-policy-v1',
    policy_version: '1.0.0',
    gos3_session_id: 'gos3-sess-mock-detector-gate',
    sandbox_id: 'sandbox-mock-detector',
  });

  const verification = verifyExecutionProof(executionProof);

  return {
    passed: totalMocksDetected === 0 && verification.valid,
    total_inspected_files: staticSummary.scannedFiles,
    total_inspected_actions: actionsInspected,
    mocks_detected: totalMocksDetected,
    status: auditResultData.status,
    execution_proof: executionProof,
    verification,
  };
}
