/**
 * ==============================================================================
 * VORTEX FOUNDATION: CHANGE INTENT CLASSIFIER & VERDICT ENFORCER
 * ==============================================================================
 * Normative Implementation conforming to VUA-SPEC-v2 Intent-Aware Governance:
 * 
 * Intent Classes:
 * 1. performance: requires >=5% measured throughput gain, latency <=2% regression,
 *    memory <=5% regression, CV <=10%.
 * 2. security / correctness: requires bounded no-regression: throughput >= -2%,
 *    latency <=2%, memory <=5%, CV <=10%.
 * 3. governance: policy/evaluator changes. Requires policy suite pass + bounded no-regression.
 * 4. mixed: security + performance changes fail closed and require explicit review.
 * 
 * Classification is derived from the trusted evaluator's git diff --name-only BASE HEAD;
 * the candidate cannot self-declare its class.
 * ==============================================================================
 */

import { execSync } from 'node:child_process';

export type ChangeIntent = 
  | 'performance'
  | 'security'
  | 'correctness'
  | 'governance'
  | 'mixed'
  | 'documentation';

export type ArenaVerdict = 
  | 'PASS_SUPERIOR'
  | 'PASS_SECURITY'
  | 'PASS_GOVERNANCE'
  | 'PASS_CORRECTNESS'
  | 'PASS_ACCEPTABLE'
  | 'FAIL_REGRESSION'
  | 'DISQUALIFIED'
  | 'NEEDS_MANUAL_REVIEW';

export interface ClassificationResult {
  intent: ChangeIntent;
  reasons: string[];
  filesByIntent: Record<ChangeIntent, string[]>;
  totalFiles: number;
}

export interface IntentBenchmarkInput {
  intent: ChangeIntent;
  canary_passed: boolean;
  delta_throughput_pct: number;
  delta_latency_pct: number; // positive = latency increased (regression)
  delta_memory_pct?: number; // positive = memory increased (regression)
  cv_pct?: number; // coefficient of variation
  policy_tests_passed?: boolean;
}

export interface IntentVerdictResult {
  verdict: ArenaVerdict;
  is_approved: boolean;
  auto_merge_eligible: boolean;
  intent: ChangeIntent;
  reasons: string[];
}

/**
 * Classifies file paths into functional intent categories.
 */
export function classifyFilePath(filePath: string): ChangeIntent {
  const p = filePath.trim().toLowerCase();

  // 1. Governance: Patch Arena, CI workflows, and governance benchmark rules
  if (
    p.startsWith('.github/workflows/agent-patch-arena') ||
    p.includes('scripts/agent-patch-arena') ||
    p.includes('scripts/change-classification') ||
    p.includes('tests/patch-arena-policy') ||
    p.includes('scripts/patch-benchmark')
  ) {
    return 'governance';
  }

  // 2. Security: OAuth, cryptography, policies, sandboxing, verifier, proofs
  if (
    p.includes('src/vortex/oauth') ||
    p.includes('src/vortex/crypto') ||
    p.includes('src/vortex/policy') ||
    p.includes('src/vortex/sandbox') ||
    p.includes('src/vortex/verifier') ||
    p.includes('src/vortex/gos3') ||
    p.includes('src/vortex/evidence') ||
    p.includes('security.md')
  ) {
    return 'security';
  }

  // 3. Performance: optimizations to semantic oracle, canonicalizer, router
  if (
    p.includes('src/vortex/canonicalize') ||
    p.includes('src/vortex/semantic-oracle') ||
    p.includes('scripts/run-semantic-benchmark') ||
    p.includes('perf') ||
    p.includes('optimize')
  ) {
    return 'performance';
  }

  // 4. Documentation
  if (
    p.endsWith('.md') ||
    p.startsWith('docs/')
  ) {
    return 'documentation';
  }

  // 5. Correctness: Adapters, MCP servers, gateway, general bug fixes
  return 'correctness';
}

/**
 * Derives overall ChangeIntent from a list of modified files.
 * Rule: Mixed security + performance changes fail closed ('mixed').
 */
export function classifyChangeIntent(changedFiles: string[]): ClassificationResult {
  const filesByIntent: Record<ChangeIntent, string[]> = {
    performance: [],
    security: [],
    correctness: [],
    governance: [],
    mixed: [],
    documentation: [],
  };

  for (const file of changedFiles) {
    const intent = classifyFilePath(file);
    filesByIntent[intent].push(file);
  }

  const hasSecurity = filesByIntent.security.length > 0;
  const hasPerformance = filesByIntent.performance.length > 0;
  const hasGovernance = filesByIntent.governance.length > 0;
  const hasCorrectness = filesByIntent.correctness.length > 0;
  const hasDocsOnly = 
    filesByIntent.documentation.length > 0 &&
    !hasSecurity && !hasPerformance && !hasGovernance && !hasCorrectness;

  const reasons: string[] = [];

  // Mixed security + performance: fails closed
  if (hasSecurity && hasPerformance) {
    reasons.push(
      `Detected both security (${filesByIntent.security.length} files) and performance (${filesByIntent.performance.length} files) changes. Fails closed.`
    );
    return {
      intent: 'mixed',
      reasons,
      filesByIntent,
      totalFiles: changedFiles.length,
    };
  }

  if (hasGovernance) {
    reasons.push(`Contains governance / policy changes (${filesByIntent.governance.length} files).`);
    return {
      intent: 'governance',
      reasons,
      filesByIntent,
      totalFiles: changedFiles.length,
    };
  }

  if (hasSecurity) {
    reasons.push(`Contains security-critical changes (${filesByIntent.security.length} files).`);
    return {
      intent: 'security',
      reasons,
      filesByIntent,
      totalFiles: changedFiles.length,
    };
  }

  if (hasPerformance) {
    reasons.push(`Contains performance optimization changes (${filesByIntent.performance.length} files).`);
    return {
      intent: 'performance',
      reasons,
      filesByIntent,
      totalFiles: changedFiles.length,
    };
  }

  if (hasCorrectness) {
    reasons.push(`Contains correctness / functional changes (${filesByIntent.correctness.length} files).`);
    return {
      intent: 'correctness',
      reasons,
      filesByIntent,
      totalFiles: changedFiles.length,
    };
  }

  if (hasDocsOnly) {
    reasons.push(`Documentation-only changes (${filesByIntent.documentation.length} files).`);
    return {
      intent: 'documentation',
      reasons,
      filesByIntent,
      totalFiles: changedFiles.length,
    };
  }

  return {
    intent: 'governance',
    reasons: ['No files specified; defaulting to governance evaluation.'],
    filesByIntent,
    totalFiles: 0,
  };
}

/**
 * Extracts changed files using git diff against BASE revision or environment.
 */
export function getChangedFilesFromGit(baseRef?: string, headRef?: string): string[] {
  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  }

  const baseCandidates = [
    baseRef,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : undefined,
    process.env.GITHUB_BASE_REF,
    'origin/main',
    'main',
    'HEAD~1',
  ].filter(Boolean);

  for (const candidate of baseCandidates) {
    try {
      const stdout = execSync(`git diff --name-only ${candidate} ${headRef || 'HEAD'}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const files = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
      if (files.length > 0) return files;
    } catch {
      // Try next candidate
    }
  }

  return [];
}

/**
 * Enforces normative intent-aware verdicts based on measured metrics.
 */
export function enforceIntentAwareVerdict(input: IntentBenchmarkInput): IntentVerdictResult {
  const {
    intent,
    canary_passed,
    delta_throughput_pct,
    delta_latency_pct,
    delta_memory_pct = 0,
    cv_pct = 5.0,
    policy_tests_passed = true,
  } = input;

  // 1. Canary failure is always an absolute binary disqualification
  if (!canary_passed) {
    return {
      verdict: 'DISQUALIFIED',
      is_approved: false,
      auto_merge_eligible: false,
      intent,
      reasons: ['Violated critical Canary invariant (side-effects, sandbox escape or policy bypass)'],
    };
  }

  // 2. Mixed changes fail closed
  if (intent === 'mixed') {
    return {
      verdict: 'NEEDS_MANUAL_REVIEW',
      is_approved: false,
      auto_merge_eligible: false,
      intent,
      reasons: ['Mixed security and performance modifications fail closed and require explicit review.'],
    };
  }

  // 3. Documentation only
  if (intent === 'documentation') {
    return {
      verdict: 'PASS_ACCEPTABLE',
      is_approved: true,
      auto_merge_eligible: true,
      intent,
      reasons: ['Documentation changes approved without benchmark requirements.'],
    };
  }

  // 4. Governance Intent: requires policy suite pass and bounded no-regression
  if (intent === 'governance') {
    const reasons: string[] = [];
    if (!policy_tests_passed) {
      reasons.push('Policy test suite failed.');
      return {
        verdict: 'FAIL_REGRESSION',
        is_approved: false,
        auto_merge_eligible: false,
        intent,
        reasons,
      };
    }

    const throughputOk = delta_throughput_pct >= -2.0;
    const latencyOk = delta_latency_pct <= 2.0;
    const memoryOk = delta_memory_pct <= 5.0;
    const cvOk = cv_pct <= 10.0;

    if (throughputOk && latencyOk && memoryOk && cvOk) {
      reasons.push('Governance policy change passed verification with bounded throughput/latency metrics.');
      return {
        verdict: 'PASS_GOVERNANCE',
        is_approved: true,
        auto_merge_eligible: true,
        intent,
        reasons,
      };
    }

    reasons.push(
      `Governance change exceeded tolerance limits: throughput=${delta_throughput_pct}% (min -2%), latency=${delta_latency_pct}% (max 2%)`
    );
    return {
      verdict: 'FAIL_REGRESSION',
      is_approved: false,
      auto_merge_eligible: false,
      intent,
      reasons,
    };
  }

  // 5. Security / Correctness Intent: requires bounded no-regression
  // (throughput >= -2%, latency <= 2%, memory <= 5%, CV <= 10%)
  if (intent === 'security' || intent === 'correctness') {
    const throughputOk = delta_throughput_pct >= -2.0;
    const latencyOk = delta_latency_pct <= 2.0;
    const memoryOk = delta_memory_pct <= 5.0;
    const cvOk = cv_pct <= 10.0;
    const reasons: string[] = [];

    if (throughputOk && latencyOk && memoryOk && cvOk) {
      const verdict: ArenaVerdict = intent === 'security' ? 'PASS_SECURITY' : 'PASS_CORRECTNESS';
      reasons.push(
        `${intent.toUpperCase()} change meets bounded no-regression criteria: throughput=${delta_throughput_pct}% (>= -2%), latency=${delta_latency_pct}% (<= 2%).`
      );
      return {
        verdict,
        is_approved: true,
        auto_merge_eligible: true,
        intent,
        reasons,
      };
    }

    reasons.push(
      `${intent.toUpperCase()} change violated bounded regression: throughput=${delta_throughput_pct}% (min -2%), latency=${delta_latency_pct}% (max 2%)`
    );
    return {
      verdict: 'FAIL_REGRESSION',
      is_approved: false,
      auto_merge_eligible: false,
      intent,
      reasons,
    };
  }

  // 6. Performance Intent: requires >= 5% measured throughput gain
  // (throughput >= +5%, latency <= 2% regression, memory <= 5%, CV <= 10%)
  if (intent === 'performance') {
    const throughputOk = delta_throughput_pct >= 5.0;
    const latencyOk = delta_latency_pct <= 2.0;
    const memoryOk = delta_memory_pct <= 5.0;
    const cvOk = cv_pct <= 10.0;
    const reasons: string[] = [];

    if (throughputOk && latencyOk && memoryOk && cvOk) {
      reasons.push(
        `Performance change demonstrated significant baseline gain: throughput +${delta_throughput_pct}% (>= 5%), latency regression ${delta_latency_pct}% (<= 2%).`
      );
      return {
        verdict: 'PASS_SUPERIOR',
        is_approved: true,
        auto_merge_eligible: true,
        intent,
        reasons,
      };
    }

    reasons.push(
      `Performance change failed required gain threshold: throughput=${delta_throughput_pct}% (needed >= 5%) or latency=${delta_latency_pct}% (max 2%)`
    );
    return {
      verdict: 'FAIL_REGRESSION',
      is_approved: false,
      auto_merge_eligible: false,
      intent,
      reasons,
    };
  }

  return {
    verdict: 'PASS_ACCEPTABLE',
    is_approved: true,
    auto_merge_eligible: false,
    intent,
    reasons: ['Default acceptable fallback.'],
  };
}
