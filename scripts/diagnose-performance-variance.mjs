#!/usr/bin/env node
import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import os from 'node:os';

function argsOf(values) {
  const out = {};
  for (let i = 0; i < values.length; i += 1) {
    const item = values[i];
    if (!item?.startsWith('--')) continue;
    const next = values[i + 1];
    out[item.slice(2)] = next === undefined || next.startsWith('--') ? true : next;
    if (out[item.slice(2)] !== true) i += 1;
  }
  return out;
}

function integer(value, name, minimum = 1) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return parsed;
}

function parseNumber(value) {
  return Number(String(value).replace(/,/g, ''));
}

function parseBench(output) {
  const duration = output.match(/Dura(?:ç|c)[^:]*:\s*([\d,.]+)\s*ms/i)?.[1];
  const throughput = output.match(/Throughput\s*:\s*([\d,.]+)\s*(?:ops|opera(?:ç|c)[^/]*)\/?seg/i)?.[1];
  const sampleSize = output.match(/Total de Opera(?:ç|c)[^:]*:\s*([\d,]+)/i)?.[1];
  if (!duration || !throughput || !sampleSize) return null;
  return {
    duration_ms: parseNumber(duration),
    throughput_ops_sec: parseNumber(throughput),
    sample_size: parseNumber(sampleSize),
  };
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function summarize(runs) {
  const throughputs = runs.map((run) => run.throughput_ops_sec);
  const durations = runs.map((run) => run.duration_ms);
  const median = quantile(throughputs, 0.5);
  const mean = throughputs.reduce((sum, value) => sum + value, 0) / throughputs.length;
  const variance = throughputs.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / throughputs.length;
  return {
    repetitions: runs.length,
    throughput_ops_sec: {
      min: Math.min(...throughputs),
      p10: quantile(throughputs, 0.1),
      median,
      p90: quantile(throughputs, 0.9),
      max: Math.max(...throughputs),
      mean: Number(mean.toFixed(3)),
      standard_deviation: Number(Math.sqrt(variance).toFixed(3)),
    },
    duration_ms: {
      min: Math.min(...durations),
      median: quantile(durations, 0.5),
      max: Math.max(...durations),
    },
  };
}

async function main() {
  const args = argsOf(process.argv.slice(2));
  const repetitions = integer(args.repetitions ?? 10, 'repetitions', 2);
  const iterations = integer(args.iterations ?? 200, 'iterations', 30);
  const output = args.output ?? '/tmp/vua-performance-variance.json';
  const logPath = args.log ?? `${output}.log`;
  const command = process.env.VUA_BENCHMARK_COMMAND ?? 'npm';
  const commandArgs = process.env.VUA_BENCHMARK_ARGS
    ? JSON.parse(process.env.VUA_BENCHMARK_ARGS)
    : ['run', 'bench', '--', '--iterations', String(iterations)];
  const runs = [];

  await mkdir(dirname(output), { recursive: true });
  await writeFile(logPath, '');

  for (let index = 1; index <= repetitions; index += 1) {
    const started = new Date().toISOString();
    const result = spawnSync(command, commandArgs, { encoding: 'utf8', env: process.env });
    const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    await appendFile(logPath, `\n===== repetition ${index} (${started}) =====\n${log}`);
    const parsed = parseBench(log);
    if (result.status !== 0) throw new Error(`benchmark failed at repetition ${index} with exit code ${result.status}`);
    if (!parsed) throw new Error(`benchmark output could not be parsed at repetition ${index}`);
    runs.push({ repetition: index, started_at: started, ...parsed });
  }

  const report = {
    schema: 'vua.performance-variance/v1',
    diagnostic_only: true,
    baseline_modified: false,
    workload: 'local-crypto',
    command: [command, ...commandArgs].join(' '),
    environment: {
      node: process.version,
      platform: process.platform,
      architecture: process.arch === 'x64' ? 'x86_64' : process.arch,
      cpu_model: os.cpus()[0]?.model ?? 'unknown',
      cpu_count: os.cpus().length,
      runner_name: process.env.GITHUB_RUNNER ?? null,
      run_id: process.env.GITHUB_RUN_ID ?? null,
      sha: process.env.GITHUB_SHA ?? null,
    },
    requested: { repetitions, iterations },
    runs,
    summary: summarize(runs),
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
});
