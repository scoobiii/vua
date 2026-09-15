#!/usr/bin/env node
import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import process from 'node:process';

function usage(message) {
  if (message) console.error(`error: ${message}\n`);
  console.error(`Usage:\n  node vua-baseline-attest.mjs capture --metrics metrics.json --key private.pem --out baseline.json [--profile mobile|cloud-run]\n  node vua-baseline-attest.mjs verify --baseline baseline.json --key public.pem [--profile mobile|cloud-run] [--skip-runner-profile]\n\nmetrics.json must contain measured values, for example:\n{\n  "warmupSize": 20,\n  "sampleSize": 200,\n  "concurrency": 1,\n  "transport": "http",\n  "workload": "foundation-pipeline",\n  "rps": 93.5,\n  "p50_ms": 10.2,\n  "p95_ms": 13.1,\n  "p99_ms": 23.2,\n  "error_rate_pct": 0,\n  "timeout_rate_pct": 0\n}\n`);
  process.exit(2);
}

function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function command(commandName, args) {
  try { return execFileSync(commandName, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}

function gitContext() {
  return {
    commit: command('git', ['rev-parse', 'HEAD']),
    branch: command('git', ['branch', '--show-current']),
    tree: command('git', ['status', '--porcelain']) === '' ? 'clean' : 'dirty',
    repository: command('git', ['rev-parse', '--show-toplevel']),
  };
}

function environment() {
  return {
    captured_at: new Date().toISOString(),
    node: process.version,
    exec_path: process.execPath,
    platform: process.platform,
    architecture: process.arch,
    kernel: os.release(),
    hostname: os.hostname(),
    cpu_model: os.cpus()[0]?.model ?? 'unknown',
    cpu_count: os.cpus().length,
    memory_bytes: os.totalmem(),
    load_average: os.loadavg(),
  };
}

function detectRunnerProfile(explicitProfile = null) {
  const architecture = process.arch === 'x64' ? 'x86_64' : process.arch === 'arm64' ? 'arm64' : process.arch;
  const isCloudRun = Boolean(process.env.K_SERVICE || process.env.K_REVISION || process.env.CLOUD_RUN_JOB);
  const isTermux = Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes('/com.termux/'));
  const requested = explicitProfile ?? (isCloudRun ? 'cloud-run' : isTermux ? 'mobile' : 'unknown');
  const profiles = {
    mobile: { id: 'mobile', deployment: 'mobile', architectures: ['arm64', 'arm'] },
    'github-vm': { id: 'github-vm', deployment: 'github-actions', architectures: ['x86_64'] },
    'cloud-run': { id: 'cloud-run', deployment: 'cloud-run', architectures: ['x86_64', 'arm64'] },
    cloud: { id: 'cloud-run', deployment: 'cloud-run', architectures: ['x86_64', 'arm64'] },
    unknown: { id: 'unknown', deployment: 'unknown', architectures: [architecture] },
  };
  if (!profiles[requested]) throw new Error(`unsupported runner profile: ${requested}`);
  if (explicitProfile && !profiles[requested].architectures.includes(architecture)) {
    throw new Error(`runner profile ${requested} is incompatible with architecture ${architecture}`);
  }
  return { ...profiles[requested], architecture, detected_by: explicitProfile ? 'explicit' : 'environment' };
}

function profileCompatible(baselineProfile, runnerProfile) {
  return Boolean(
    baselineProfile && runnerProfile &&
    baselineProfile.id === runnerProfile.id &&
    Array.isArray(baselineProfile.architectures) &&
    baselineProfile.architectures.includes(runnerProfile.architecture)
  );
}

function validateMetrics(metrics) {
  const workload = metrics.workload ?? 'pipeline-rps';
  const required = workload === 'local-crypto'
    ? ['warmupSize', 'sampleSize', 'throughput_ops_sec', 'latency_avg_us', 'error_rate_pct', 'timeout_rate_pct']
    : ['warmupSize', 'sampleSize', 'rps', 'p50_ms', 'p95_ms', 'p99_ms', 'error_rate_pct', 'timeout_rate_pct'];
  for (const key of required) if (!(key in metrics)) throw new Error(`metrics missing required field: ${key}`);
  for (const key of required) {
    if (typeof metrics[key] !== 'number' || !Number.isFinite(metrics[key]) || metrics[key] < 0) {
      throw new Error(`metrics.${key} must be a finite non-negative number`);
    }
  }
  if (!Number.isInteger(metrics.warmupSize) || !Number.isInteger(metrics.sampleSize) || metrics.sampleSize < 30) {
    throw new Error('warmupSize and sampleSize must be integers; sampleSize must be at least 30');
  }
  if (workload !== 'local-crypto' && (metrics.p50_ms > metrics.p95_ms || metrics.p95_ms > metrics.p99_ms)) {
    throw new Error('latencies must satisfy p50_ms <= p95_ms <= p99_ms');
  }
}

async function capture(args) {
  if (!args.metrics || !args.key || !args.out) usage('capture requires --metrics, --key and --out');
  const metrics = JSON.parse(await readFile(args.metrics, 'utf8'));
  validateMetrics(metrics);
  const runnerProfile = detectRunnerProfile(args.profile ?? metrics.profile ?? null);
  const privateKey = createPrivateKey(await readFile(args.key));
  const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' });
  const unsigned = {
    schema: 'vortex.performance-baseline/v1',
    baseline_id: `baseline-${Date.now()}-${process.pid}`,
    git: gitContext(),
    environment: environment(),
    runner_profile: runnerProfile,
    workload: {
      name: metrics.workload ?? 'unspecified',
      transport: metrics.transport ?? 'unspecified',
      concurrency: metrics.concurrency ?? 1,
      warmupSize: metrics.warmupSize,
      sampleSize: metrics.sampleSize,
    },
    metrics: metrics.workload === 'local-crypto' ? {
      throughput_ops_sec: metrics.throughput_ops_sec,
      latency_avg_us: metrics.latency_avg_us,
      sampleSize: metrics.sampleSize,
      error_rate_pct: metrics.error_rate_pct,
      timeout_rate_pct: metrics.timeout_rate_pct,
      memory_mb: metrics.memory_mb ?? null,
    } : {
      rps: metrics.rps,
      p50_ms: metrics.p50_ms,
      p95_ms: metrics.p95_ms,
      p99_ms: metrics.p99_ms,
      error_rate_pct: metrics.error_rate_pct,
      timeout_rate_pct: metrics.timeout_rate_pct,
      memory_efficiency_pct: metrics.memory_efficiency_pct ?? null,
    },
    policy: {
      min_sample_size: 30,
      max_error_rate_pct: 0,
      max_timeout_rate_pct: 0,
      tree_must_be_clean: true,
      signature_algorithm: 'Ed25519',
    },
    public_key: publicKey,
  };
  const payload = canonical(unsigned);
  const baseline = { ...unsigned, payload_hash: sha256(payload), signature: sign(null, Buffer.from(payload), privateKey).toString('base64') };
  await writeFile(args.out, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ status: 'CAPTURED_AND_SIGNED', out: args.out, profile: runnerProfile, payload_hash: baseline.payload_hash, commit: baseline.git.commit }, null, 2));
}

async function verifyBaseline(args) {
  if (!args.baseline || !args.key) usage('verify requires --baseline and --key');
  const baseline = JSON.parse(await readFile(args.baseline, 'utf8'));
  const { signature, payload_hash, ...unsigned } = baseline;
  if (!signature || !payload_hash) throw new Error('baseline lacks signature or payload_hash');
  const payload = canonical(unsigned);
  const actualHash = sha256(payload);
  const publicKey = createPublicKey(await readFile(args.key));
  const valid = actualHash === payload_hash && verify(null, Buffer.from(payload), publicKey, Buffer.from(signature, 'base64'));
  const policy = baseline.policy ?? {};
  const skipRunnerProfile = args['skip-runner-profile'] === true;
  const runnerProfile = skipRunnerProfile
    ? detectRunnerProfile(null)
    : detectRunnerProfile(args.profile ?? process.env.VORTEX_RUNNER_PROFILE ?? null);
  const baselineProfile = baseline.runner_profile;
  const checks = {
    schema: baseline.schema === 'vortex.performance-baseline/v1',
    hash: actualHash === payload_hash,
    signature: valid,
    commit: typeof baseline.git?.commit === 'string' && /^[0-9a-f]{7,64}$/.test(baseline.git.commit),
    clean_tree: policy.tree_must_be_clean !== true || baseline.git?.tree === 'clean',
    sample_size: Number.isInteger(baseline.workload?.sampleSize) && baseline.workload.sampleSize >= (policy.min_sample_size ?? 30),
    errors: Number(baseline.metrics?.error_rate_pct) <= Number(policy.max_error_rate_pct ?? 0),
    timeouts: Number(baseline.metrics?.timeout_rate_pct) <= Number(policy.max_timeout_rate_pct ?? 0),
    runner_profile: skipRunnerProfile ? true : profileCompatible(baselineProfile, runnerProfile),
  };
  const accepted = Object.values(checks).every(Boolean);
  console.log(JSON.stringify({ status: accepted ? 'BASELINE_ACCEPTED' : 'BASELINE_REJECTED', accepted, checks, runner_profile: runnerProfile, baseline_profile: baselineProfile ?? null, payload_hash: actualHash, baseline_id: baseline.baseline_id }, null, 2));
  process.exitCode = accepted ? 0 : 1;
}

const [mode, ...rest] = process.argv.slice(2);
const args = Object.fromEntries(rest.reduce((pairs, item, index, all) => {
  if (item.startsWith('--')) {
    const next = all[index + 1];
    pairs.push([item.slice(2), next === undefined || next.startsWith('--') ? true : next]);
  }
  return pairs;
}, []));
try {
  if (mode === 'capture') await capture(args);
  else if (mode === 'verify') await verifyBaseline(args);
  else usage('mode must be capture or verify');
} catch (error) {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
