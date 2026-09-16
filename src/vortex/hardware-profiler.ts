/**
 * Vortex Hardware Profiler & Dynamic Baseline Bootstrapper
 * 
 * Automatically detects device characteristics (Termux Android, Edge IoT,
 * Desktop Workstation, Cloud Server) and computes dynamic latency SLAs,
 * concurrency bounds, jitter tolerance, and LLM execution profiles.
 */

import os from 'node:os';
import process from 'node:process';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { canonicalizeRFC8785 } from './canonicalize.js';
import { generateVortexIdentity, signCanonicalString } from './crypto.js';

export type DeviceArchetype =
  | 'MOBILE_TERMUX'
  | 'EMBEDDED_EDGE'
  | 'DESKTOP_DEV'
  | 'HIGH_PERF_CLOUD';

export interface HardwareFingerprint {
  platform: NodeJS.Platform;
  architecture: string;
  isTermux: boolean;
  isAlpine: boolean;
  isWSL: boolean;
  cpuModel: string;
  cpuCores: number;
  totalMemoryMB: number;
  freeMemoryMB: number;
  nodeVersion: string;
  archetype: DeviceArchetype;
}

export interface DynamicBaselineConfig {
  archetype: DeviceArchetype;
  cryptoSignTargetMs: number;
  cryptoVerifyTargetMs: number;
  canonicalizeTargetMs: number;
  llmLocalTargetTokensPerSec: number;
  maxConcurrentOperations: number;
  jitterTolerancePercent: number;
  recommendedModelQuantization: string;
  recommendedLocalModel: string;
  memoryBufferThresholdMB: number;
  sandboxMemoryLimitMB: number;
  fingerprintHash: string;
  generatedAt: string;
}

export interface GovernedBaselineCertificate {
  fingerprint: HardwareFingerprint;
  baseline: DynamicBaselineConfig;
  canonical_hash: string;
  signed_by: string;
  signature: string;
  status: 'ESTABLISHED' | 'DEGRADED';
}

/**
 * Detects the runtime gadget / device specifications
 */
export function detectHardwareFingerprint(): HardwareFingerprint {
  const platform = os.platform();
  const architecture = os.arch();
  const cpus = os.cpus() || [];
  const cpuCores = Math.max(1, cpus.length);
  const cpuModel = cpus[0]?.model || 'Generic Processor';
  const totalMemoryMB = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemoryMB = Math.round(os.freemem() / (1024 * 1024));
  const nodeVersion = process.version;

  const isTermux = Boolean(
    process.env.TERMUX_VERSION ||
    (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) ||
    fs.existsSync('/data/data/com.termux')
  );

  const isAlpine = fs.existsSync('/etc/alpine-release');
  const isWSL = Boolean(
    process.env.WSL_DISTRO_NAME ||
    (platform === 'linux' && os.release().toLowerCase().includes('microsoft'))
  );

  let archetype: DeviceArchetype = 'DESKTOP_DEV';

  if (isTermux || (platform === 'android')) {
    archetype = 'MOBILE_TERMUX';
  } else if (totalMemoryMB < 2048 || (cpuCores <= 2 && architecture.startsWith('arm'))) {
    archetype = 'EMBEDDED_EDGE';
  } else if (process.env.K_SERVICE || process.env.RENDER || process.env.CI || (cpuCores >= 8 && totalMemoryMB >= 16384)) {
    archetype = 'HIGH_PERF_CLOUD';
  } else {
    archetype = 'DESKTOP_DEV';
  }

  return {
    platform,
    architecture,
    isTermux,
    isAlpine,
    isWSL,
    cpuModel,
    cpuCores,
    totalMemoryMB,
    freeMemoryMB,
    nodeVersion,
    archetype,
  };
}

/**
 * Computes dynamic baseline thresholds based on hardware archetype
 */
export function computeDynamicBaseline(fingerprint: HardwareFingerprint): DynamicBaselineConfig {
  let cryptoSignTargetMs = 1.0;
  let cryptoVerifyTargetMs = 1.5;
  let canonicalizeTargetMs = 0.5;
  let llmLocalTargetTokensPerSec = 25;
  let maxConcurrentOperations = 4;
  let jitterTolerancePercent = 10;
  let recommendedModelQuantization = 'q4_k_m';
  let recommendedLocalModel = 'qwen2.5-coder:1.5b';
  let memoryBufferThresholdMB = 256;
  let sandboxMemoryLimitMB = 512;

  switch (fingerprint.archetype) {
    case 'MOBILE_TERMUX':
      // Mobile smartphones running Termux (ARM64, battery constrained, aggressive OOM)
      cryptoSignTargetMs = 4.5;
      cryptoVerifyTargetMs = 6.0;
      canonicalizeTargetMs = 1.5;
      llmLocalTargetTokensPerSec = 8;
      maxConcurrentOperations = 1; // Strict 1 concurrency to prevent Android OOM killer
      jitterTolerancePercent = 25; // Higher thermal/background jitter on mobile
      recommendedModelQuantization = 'q4_0';
      recommendedLocalModel = 'qwen2.5-coder:0.5b';
      memoryBufferThresholdMB = 128;
      sandboxMemoryLimitMB = 256;
      break;

    case 'EMBEDDED_EDGE':
      // Raspberry Pi, low-power edge nodes (<2GB RAM)
      cryptoSignTargetMs = 5.0;
      cryptoVerifyTargetMs = 8.0;
      canonicalizeTargetMs = 2.0;
      llmLocalTargetTokensPerSec = 4;
      maxConcurrentOperations = 1;
      jitterTolerancePercent = 20;
      recommendedModelQuantization = 'q3_k_s';
      recommendedLocalModel = 'qwen2.5-coder:0.5b';
      memoryBufferThresholdMB = 96;
      sandboxMemoryLimitMB = 192;
      break;

    case 'DESKTOP_DEV':
      // Laptops / Workstations (macOS M-series, Windows 11, Linux workstation)
      cryptoSignTargetMs = 1.0;
      cryptoVerifyTargetMs = 1.5;
      canonicalizeTargetMs = 0.4;
      llmLocalTargetTokensPerSec = 35;
      maxConcurrentOperations = Math.min(8, Math.max(2, Math.floor(fingerprint.cpuCores / 2)));
      jitterTolerancePercent = 10;
      recommendedModelQuantization = 'q5_k_m';
      recommendedLocalModel = 'qwen2.5-coder:7b';
      memoryBufferThresholdMB = 512;
      sandboxMemoryLimitMB = 1024;
      break;

    case 'HIGH_PERF_CLOUD':
      // Cloud Run, EC2, Kubernetes, CI runner
      cryptoSignTargetMs = 0.5;
      cryptoVerifyTargetMs = 0.8;
      canonicalizeTargetMs = 0.2;
      llmLocalTargetTokensPerSec = 60;
      maxConcurrentOperations = Math.min(16, fingerprint.cpuCores * 2);
      jitterTolerancePercent = 5;
      recommendedModelQuantization = 'fp16';
      recommendedLocalModel = 'qwen2.5-coder:14b';
      memoryBufferThresholdMB = 1024;
      sandboxMemoryLimitMB = 2048;
      break;
  }

  // Calculate deterministic fingerprint hash
  const canonicalFingerprint = canonicalizeRFC8785(fingerprint);
  const fingerprintHash = crypto
    .createHash('sha256')
    .update(canonicalFingerprint)
    .digest('hex');

  return {
    archetype: fingerprint.archetype,
    cryptoSignTargetMs,
    cryptoVerifyTargetMs,
    canonicalizeTargetMs,
    llmLocalTargetTokensPerSec,
    maxConcurrentOperations,
    jitterTolerancePercent,
    recommendedModelQuantization,
    recommendedLocalModel,
    memoryBufferThresholdMB,
    sandboxMemoryLimitMB,
    fingerprintHash,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Boots the dynamic hardware baseline and signs a governance certificate
 */
export async function bootstrapHardwareBaseline(): Promise<GovernedBaselineCertificate> {
  const fingerprint = detectHardwareFingerprint();
  const baseline = computeDynamicBaseline(fingerprint);

  const payload = {
    fingerprint,
    baseline,
  };

  const canonicalPayload = canonicalizeRFC8785(payload);
  const canonical_hash = crypto
    .createHash('sha256')
    .update(canonicalPayload)
    .digest('hex');

  const identity = generateVortexIdentity();
  const signature = signCanonicalString(canonicalPayload, identity.private_key);

  return {
    fingerprint,
    baseline,
    canonical_hash,
    signed_by: identity.public_key,
    signature,
    status: 'ESTABLISHED',
  };
}
