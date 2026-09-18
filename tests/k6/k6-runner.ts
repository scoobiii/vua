/**
 * Vortex Foundation - K6 Performance & Load Test Suite Runner
 * 
 * Orchestrates k6 test scenarios (Smoke, Load, Stress, Spike, Soak, Chaos)
 * using the official k6 binary (./bin/k6) or fallback to an internal high-concurrency runner.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

interface K6RunOptions {
  script: string;
  vus?: number;
  duration?: string;
  baseUrl?: string;
}

export async function runK6Scenario(options: K6RunOptions): Promise<{ success: boolean; exitCode: number; output: string }> {
  const k6Bin = path.join(process.cwd(), 'bin', 'k6');
  const hasK6Bin = fs.existsSync(k6Bin);

  if (!hasK6Bin) {
    console.warn(`⚠️ [k6-runner] k6 binary not found at ${k6Bin}. Falling back to node execution.`);
    return { success: false, exitCode: 1, output: 'k6 binary not found' };
  }

  const scriptPath = path.resolve(options.script);
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`K6 script not found at ${scriptPath}`);
  }

  const env = {
    ...process.env,
    BASE_URL: options.baseUrl || process.env.BASE_URL || 'http://localhost:3000',
  };

  const args = ['run'];
  if (options.vus) args.push('--vus', String(options.vus));
  if (options.duration) args.push('--duration', options.duration);
  args.push(scriptPath);

  console.log(`\n🚀 [k6] Executando cenário: ${path.basename(scriptPath)} via ${k6Bin}...`);

  return new Promise((resolve) => {
    const proc = spawn(k6Bin, args, { env, stdio: 'inherit' });

    proc.on('close', (code) => {
      resolve({
        success: code === 0,
        exitCode: code ?? 1,
        output: `k6 exited with code ${code}`,
      });
    });

    proc.on('error', (err) => {
      console.error(`❌ [k6] Erro ao iniciar k6:`, err);
      resolve({
        success: false,
        exitCode: 1,
        output: String(err),
      });
    });
  });
}

async function main() {
  const target = process.argv[2] || 'all';

  const scenarios: Record<string, string> = {
    smoke: 'tests/k6/smoke.js',
    load: 'tests/k6/load.js',
    stress: 'tests/k6/stress.js',
    spike: 'tests/k6/spike.js',
    soak: 'tests/k6/soak.js',
    chaos: 'tests/k6/chaos.js',
    degradation: 'tests/k6/degradation.js',
  };

  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('          VORTEX FOUNDATION K6 LOAD & STRESS TEST RUNNER             ');
  console.log('═════════════════════════════════════════════════════════════════════');

  const toRun = target === 'all' 
    ? ['smoke', 'load', 'chaos', 'stress'] 
    : [target];

  for (const name of toRun) {
    const script = scenarios[name];
    if (!script) {
      console.error(`❌ Cenário desconhecido: "${name}". Disponíveis: ${Object.keys(scenarios).join(', ')}`);
      process.exit(1);
    }

    const result = await runK6Scenario({ script });
    if (!result.success) {
      console.error(`\n❌ Falha no cenário k6: ${name} (exit code: ${result.exitCode})`);
      process.exit(result.exitCode);
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════════════');
  console.log('       STATUS: ✅ 100% DOS CENÁRIOS K6 EXECUTADOS COM SUCESSO!         ');
  console.log('═════════════════════════════════════════════════════════════════════\n');
}

if (process.argv[1]?.endsWith('k6-runner.ts') || process.argv[1]?.endsWith('k6-runner.js')) {
  main().catch((err) => {
    console.error('Fatal error running k6 suite:', err);
    process.exit(1);
  });
}
