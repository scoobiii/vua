#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(2);
}

function argsOf(values) {
  return values.reduce((out, item, i, all) => {
    if (item.startsWith('--')) out[item.slice(2)] = all[i + 1]?.startsWith('--') ? true : all[i + 1];
    return out;
  }, {});
}

function number(value, name) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) fail(`${name} must be a finite non-negative number`);
  return n;
}

function profileOf(value) {
  if (value === 'cloud' || value === 'cloud-run') return 'cloud-run';
  if (value === 'mobile') return 'mobile';
  return value ?? 'unknown';
}

function verifyAttestation({ baseline, key, profile, attestationScript }) {
  if (!key || !attestationScript) return { status: 'NOT_REQUESTED' };
  const result = spawnSync(process.execPath, [attestationScript, 'verify', '--baseline', baseline, '--key', key, '--profile', profile, '--skip-runner-profile'], { encoding: 'utf8' });
  let output = null;
  try { output = JSON.parse(result.stdout); } catch { output = { raw: result.stdout, error: result.stderr }; }
  return { status: result.status === 0 ? 'VALID' : 'INVALID', output };
}

function compare(current, baseline, tolerancePct) {
  const workload = baseline.workload?.name ?? 'pipeline-rps';
  if ((current.workload ?? 'pipeline-rps') !== workload) fail(`workload mismatch: current=${current.workload ?? 'pipeline-rps'} baseline=${workload}`);
  if (workload === 'local-crypto') {
    const baseOps = number(baseline.metrics?.throughput_ops_sec, 'baseline.metrics.throughput_ops_sec');
    const currentOps = number(current.throughput_ops_sec, 'current.throughput_ops_sec');
    if (baseOps === 0) fail('baseline throughput cannot be zero');
    const relativeChangePct = ((currentOps - baseOps) / baseOps) * 100;
    const verdict = relativeChangePct < -tolerancePct ? 'FAIL_REGRESSION' : relativeChangePct > tolerancePct ? 'PASS_SUPERIOR' : 'PASS_ACCEPTABLE';
    return { workload, baseline_ops_sec: baseOps, current_ops_sec: currentOps, relative_change_pct: Number(relativeChangePct.toFixed(3)), tolerance_pct: tolerancePct, status: verdict === 'FAIL_REGRESSION' ? 'REGRESSION' : 'WITHIN_OR_ABOVE_TOLERANCE', verdict };
  }
  const baseRps = number(baseline.metrics?.rps, 'baseline.metrics.rps');
  const currentRps = number(current.rps, 'current.rps');
  if (baseRps === 0) fail('baseline RPS cannot be zero');
  const relativeChangePct = ((currentRps - baseRps) / baseRps) * 100;
  let verdict = 'PASS_ACCEPTABLE';
  if (relativeChangePct < -tolerancePct) verdict = 'FAIL_REGRESSION';
  else if (relativeChangePct > tolerancePct) verdict = 'PASS_SUPERIOR';
  return {
    baseline_rps: baseRps,
    current_rps: currentRps,
    relative_change_pct: Number(relativeChangePct.toFixed(3)),
    tolerance_pct: tolerancePct,
    status: verdict === 'FAIL_REGRESSION' ? 'REGRESSION' : 'WITHIN_OR_ABOVE_TOLERANCE',
    verdict,
  };
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  if (!args.baseline || !args.metrics || !args.result) fail('required: --baseline, --metrics and --result');
  const baseline = JSON.parse(await readFile(args.baseline, 'utf8'));
  const current = JSON.parse(await readFile(args.metrics, 'utf8'));
  const requestedProfile = profileOf(args.profile);
  const baselineProfile = profileOf(baseline.runner_profile?.id);
  const tolerancePct = number(args.tolerance ?? process.env.VORTEX_PERF_TOLERANCE_PCT ?? 5, 'tolerance');
  const result = {
    schema: 'vortex.performance-verdict/v1',
    runner_profile: requestedProfile,
    baseline_id: baseline.baseline_id ?? null,
    cloud_comparison: null,
    mobile_evidence: { status: 'NOT_PROVIDED' },
    verdict: 'BASELINE_INCONCLUSIVE',
  };

  if (requestedProfile !== baselineProfile) {
    result.reason = `baseline profile ${baselineProfile} is incompatible with runner profile ${requestedProfile}`;
  } else if (!baseline.workload?.name || !Number.isFinite(Number(current.rps ?? current.throughput_ops_sec))) {
    result.reason = 'missing workload or finite performance metric in baseline/current metrics';
  } else {
    result.cloud_comparison = compare(current, baseline, tolerancePct);
    result.verdict = result.cloud_comparison.verdict;
  }

  if (args['mobile-evidence']) {
    const evidence = JSON.parse(await readFile(args['mobile-evidence'], 'utf8'));
    const attestation = verifyAttestation({
      baseline: args['mobile-evidence'],
      key: args['public-key'],
      profile: 'mobile',
      attestationScript: args['attestation-script'],
    });
    const mobileRps = evidence.metrics?.rps;
    result.mobile_evidence = {
      status: attestation.status === 'INVALID' ? 'INVALID' : 'VERIFIED_CONTEXT_ONLY',
      attestation,
      profile: evidence.runner_profile?.id ?? null,
      rps: Number.isFinite(Number(mobileRps)) ? Number(mobileRps) : null,
      rule: 'Mobile evidence informs context; it never replaces or rescales the Cloud baseline.',
    };
    if (evidence.runner_profile?.id !== 'mobile') result.mobile_evidence.status = 'INVALID_PROFILE';
    if (attestation.status === 'INVALID') result.mobile_evidence.status = 'INVALID_ATTESTATION';
  }

  await writeFile(args.result, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.verdict === 'BASELINE_INCONCLUSIVE' || result.verdict === 'FAIL_REGRESSION' ? 1 : 0;
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
