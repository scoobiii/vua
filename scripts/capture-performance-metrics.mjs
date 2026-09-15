#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const args = process.argv.slice(2).reduce((out, item, i, all) => {
  if (item.startsWith('--')) out[item.slice(2)] = all[i + 1]?.startsWith('--') ? true : all[i + 1];
  return out;
}, {});
const output = args.output;
if (!output) {
  console.error('usage: node scripts/capture-performance-metrics.mjs --output metrics.json [--profile mobile|github-vm] [--sample-size N]');
  process.exit(2);
}

const command = process.env.VUA_BENCHMARK_COMMAND ?? 'npm';
const commandArgs = process.env.VUA_BENCHMARK_ARGS ? JSON.parse(process.env.VUA_BENCHMARK_ARGS) : ['run', 'bench'];
const result = spawnSync(command, commandArgs, { encoding: 'utf8', env: process.env });
const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
const architecture = process.arch === 'x64' ? 'x86_64' : process.arch;
const profile = args.profile ?? process.env.VORTEX_RUNNER_PROFILE ?? 'unknown';
if (!['mobile', 'github-vm', 'cloud-run'].includes(profile)) throw new Error(`unsupported profile: ${profile}`);
if (profile === 'github-vm' && process.env.GITHUB_ACTIONS !== 'true') throw new Error('github-vm capture requires GitHub Actions');
if (profile === 'mobile' && !['arm64', 'arm'].includes(architecture)) throw new Error(`mobile capture requires ARM architecture, got ${architecture}`);

function parseNumber(value) { return Number(String(value).replace(/,/g, '')); }
function parseOfficialBench(text) {
  const total = text.match(/Total de Opera(?:ç|c)[^:]*:\s*([\d,]+)/i)?.[1];
  const duration = text.match(/Dura(?:ç|c)[^:]*:\s*([\d,.]+)\s*ms/i)?.[1];
  const throughput = text.match(/Throughput\s*:\s*([\d,.]+)\s*(?:ops|opera(?:ç|c)[^/]*)\/?seg/i)?.[1];
  const latency = text.match(/Lat(?:ê|e)ncia M(?:é|e)dia\s*:\s*([\d,.]+)\s*(?:µs|us)/i)?.[1];
  const memory = text.match(/Consumo de Mem(?:ó|o)ria\s*:\s*([\d,.]+)\s*MB/i)?.[1];
  if (!total || !duration || !throughput || !latency) return null;
  return {
    profile,
    architecture,
    workload: 'local-crypto',
    sampleSize: parseNumber(total),
    warmupSize: 0,
    throughput_ops_sec: parseNumber(throughput),
    latency_avg_us: parseNumber(latency),
    memory_mb: memory ? parseNumber(memory) : null,
    duration_ms: parseNumber(duration),
    error_rate_pct: 0,
    timeout_rate_pct: 0,
  };
}
function parseStructured(text) {
  const match = text.match(/\{[\s\S]*\}/g)?.at(-1);
  if (!match) return null;
  try {
    const x = JSON.parse(match);
    if (x.current && Number.isFinite(Number(x.current.rps))) return {
      profile, architecture, workload: x.workload ?? 'pipeline-rps', warmupSize: Number(x.warmupSize ?? 0), sampleSize: Number(x.sampleSize),
      rps: Number(x.current.rps), p50_ms: Number(x.current.p50_ms), p95_ms: Number(x.current.p95_ms), p99_ms: Number(x.current.p99_ms),
      error_rate_pct: Number(x.current.error_rate_pct), timeout_rate_pct: Number(x.current.timeout_rate_pct), memory_efficiency_pct: x.current.memory_efficiency_pct ?? null,
    };
  } catch { return null; }
}
const metrics = parseStructured(log) ?? parseOfficialBench(log);
if (!metrics) {
  console.error('Benchmark produced no supported structured report. Refusing to create a baseline.');
  process.exit(result.status || 1);
}
if (!Number.isInteger(metrics.sampleSize) || metrics.sampleSize < 30) throw new Error(`sample size must be at least 30, got ${metrics.sampleSize}`);
if (result.status !== 0) {
  console.error(`Benchmark exited with code ${result.status}; refusing to create a baseline.`);
  process.exit(result.status || 1);
}
await writeFile(output, `${JSON.stringify(metrics, null, 2)}\n`);
console.log(JSON.stringify({ status: 'METRICS_CAPTURED', output, metrics }, null, 2));
