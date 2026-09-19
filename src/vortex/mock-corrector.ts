/**
 * Vortex Mock Corrector & Sanitizer
 * 
 * Intercepts adapter execution results and automatically enforces
 * the Vortex Governance Contract:
 * 1. Strips forged/hardcoded mocks.
 * 2. Replaces with authentic host substrate values or explicitly labels synthetic fallbacks.
 * 3. Injects audit trail disclosing whether physical hardware was attached or container isolation was used.
 */

import os from 'node:os';
import fs from 'node:fs';
import { auditPayloadForMocks, type MockAuditReport } from './mock-detector.js';

export interface CorrectedPayloadResult {
  original_contained_mocks: boolean;
  sanitized_data: Record<string, unknown>;
  audit_report: MockAuditReport;
  remediation_applied: string[];
}

export function correctAndSanitizeMock(
  data: Record<string, unknown>,
  context: { adapter: string; action: string }
): CorrectedPayloadResult {
  const auditReport = auditPayloadForMocks(data, context);
  const remediationApplied: string[] = [];
  const sanitized = { ...data };

  if (auditReport.mocks_detected > 0) {
    for (const finding of auditReport.findings) {
      if (finding.field === 'hardware_identity') {
        // Strip hardcoded fake name and replace with actual host substrate
        delete sanitized.device_name;
        delete sanitized.build_id;
        delete sanitized.fingerprint;
        sanitized.physical_device = false;
        sanitized.synthetic_mock = false;
        sanitized.real_substrate = {
          host_os: os.type(),
          host_arch: os.arch(),
          host_release: os.release(),
          hostname: os.hostname(),
          container_detected: Boolean(process.env.K_SERVICE || fs.existsSync('/.dockerenv')),
        };
        remediationApplied.push(`Sanitized hardcoded mock signature '${finding.claimed_value}' -> Replaced with real physical host substrate.`);
      }

      if (finding.field === 'android_telemetry') {
        delete sanitized.battery;
        sanitized.android_runtime_available = false;
        sanitized.disclosed_reason = 'Physical ADB/AOSP substrate unavailable in current execution container.';
        remediationApplied.push(`Sanitized fake Android telemetry fields -> Disclosed container execution substrate.`);
      }

      if (finding.field === 'windows_defender') {
        delete sanitized.windows_defender;
        sanitized.windows_runtime_available = false;
        remediationApplied.push(`Sanitized fake Windows Defender metrics on non-Windows host.`);
      }
    }
  }

  return {
    original_contained_mocks: auditReport.mocks_detected > 0,
    sanitized_data: sanitized,
    audit_report: auditReport,
    remediation_applied: remediationApplied,
  };
}
