#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const args = process.argv.slice(2).reduce((out, item, i, all) => {
  if (item.startsWith('--')) out[item.slice(2)] = all[i + 1]?.startsWith('--') ? true : all[i + 1];
  return out;
}, {});
const output = args.output;
if (!output) {
  console.error('usage: node scripts/capture-performance-metrics.mjs --output metrics.json [--profile mobile|github-vm]');
  process.exit(2);
}

const profile = args.profile ?? process.env.VORTEX_RUNNER_PROFILE ?? 'unknown';
if (!['mobile', 'github-vm', 'cloud-run'].includes(profile)) throw new Error(`unsupported profile: ${profile}`);

const architecture = process.arch === 'x64' ? 'x86_64' : process.arch;
if (profile === 'github-vm' && process.env.GITHUB_ACTIONS !== 'true') throw new Error('github-vm capture requires GitHub Actions');
if (profile === 'mobile' && !['arm64', 'arm'].includes(architecture)) throw new Error(`mobile capture requires ARM architecture, got ${architecture}`);

const tsxCli = 'node_modules/tsx/dist/cli.mjs';
if (!existsSync(tsxCli)) {
  console.error(`Benchmark runner missing: ${tsxCli}`);
  process.exit(1);
}

const commandArgs = ['bin/vua.js', 'bench'];
if (process.env.VUA_BENCHMARK_ARGS) {
  try {
    const extraArgs = JSON.parse(process.env.VUA_BENCHMARK_ARGS);
    if (!Array.isArray(extraArgs)) throw new Error('VUA_BENCHMARK_ARGS must be a JSON array');
    commandArgs.push(...extraArgs);
  } catch (error) {
    console.error(`Invalid VUA_BENCHMARK_ARGS: ${error.message}`);
    process.exit(2);
  }
}

const result = spawnSync(process.execPath, [tsxCli, ...commandArgs], {
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 4 * 1024 * 1024,
});

if (result.error) {
  console.error(`Benchmark process failed to start: ${result.error.message}`);
  process.exit(1);
}

const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
if (result.status !== 0) {
  console.error(`Benchmark exited with code ${result.status}.`);
  if (log.trim()) console.error(log.trim());
  process.exit(result.status ?? 1);
}

function parseNumber(value) {
  return Number(String(value).replace(/,/g, ''));
}

function parseOfficialBench(text) {
  const total = text.match(/Total de Opera(?:ções|c)[^:]*:\s*([\d,]+)/i)?.[1];
  const duration = text.match(/Dura(?:ção|c)[^:]*:\s*([\d,.]+)\s*ms/i)?.[1];
  const throughput = text.match(/Throughput\s*:\s*([\d,.]+)\s*(?:ops|opera(?:ções|ção|c)[^/]*)\/?seg/i)?.[1];
  const latency = text.match(/Lat(?:ência|e)\s*M(?:édia|e)dia\s*:\s*([\d,.]+)\s*(?:µs|us)/i)?.[1];
  const memory = text.match(/Consumo de Mem(?:ória|o)ria\s*:\s*([\d,.]+)\s*MB/i)?.[1];
  if (!total || !duration || !throughput || !latency) return null;
  return {
    profile, architecture, workload: 'local-crypto',
    sampleSize: parseNumber(total), warmupSize: 0,
    throughput_ops_sec: parseNumber(throughput), latency_avg_us: parseNumber(latency),
    memory_mb: memory ? parseNumber(memory) : null,
    duration_ms: parseNumber(duration), error_rate_pct: 0, timeout_rate_pct: 0,
  };
}

function parseStructured(text) {
  const match = text.match(/\{[\s\S]*\}/g)?.at(-1);
  if (!match) return null;
  try {
    const x = JSON.parse(match);
    if (x.current && Number.isFinite(Number(x.current.rps))) {
      return {
        profile, architecture, workload: x.workload ?? 'pipeline-rps',
        warmupSize: Number(x.warmupSize ?? 0), sampleSize: Number(x.sampleSize),
        rps: Number(x.current.rps), p50_ms: Number(x.current.p50_ms),
        p95_ms: Number(x.current.p95_ms), p99_ms: Number(x.current.p99_ms),
        error_rate_pct: Number(x.current.error_rate_pct),
        timeout_rate_pct: Number(x.current.timeout_rate_pct),
        memory_efficiency_pct: x.current.memory_efficiency_pct ?? null,
      };
    }
  } catch {}
  return null;
}

const metrics = parseStructured(log) ?? parseOfficialBench(log);
if (!metrics) {
  console.error('Benchmark produced no supported structured report. Refusing to create a baseline.');
  console.error(log.trim());
  process.exit(1);
}
if (!Number.isInteger(metrics.sampleSize) || metrics.sampleSize < 30) {
  throw new Error(`sample size must be at least 30, got ${metrics.sampleSize}`);
}

await writeFile(output, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify({ status: 'METRICS_CAPTURED', output, metrics }, null, 2));
