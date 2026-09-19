/**
 * VUA CI execution-integrity gate.
 *
 * The gate separates two different controls:
 * 1. Mock Detection: static inspection of production execution code.
 * 2. Test execution evidence: every required suite must actually run and exit 0.
 *
 * We deliberately do NOT grep test stdout for words such as "mock", "simulate",
 * or "fixture": legitimate security/chaos tests use those terms and that creates
 * false positives. Mock governance belongs in the static detector.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

type CommandResult = {
  test_id: string;
  command: string;
  started_at: string;
  finished_at: string;
  exit_code: number | null;
  signal: string | null;
  executed: boolean;
  stdout_hash: string;
  stderr_hash: string;
  status: 'PASS' | 'FAIL';
};

const commands = [
  ['unit', 'npm run test:unit'],
  ['integration', 'npm run test:integration'],
  ['stress', 'npm run test:stress'],
  ['chaos', 'npm run test:chaos'],
  ['security', 'npm run test:security'],
  ['bench', 'npm run test:bench'],
  ['policy', 'npm run test:policy'],
  ['threads', 'npm run test:threads'],
] as const;

function sha256(text: string): string {
  return 'sha256:' + createHash('sha256').update(text, 'utf8').digest('hex');
}

function run(testId: string, command: string): CommandResult {
  const started = new Date().toISOString();
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
  });
  const finished = new Date().toISOString();

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const executed = result.error === undefined;

  return {
    test_id: testId,
    command,
    started_at: started,
    finished_at: finished,
    exit_code: result.status,
    signal: result.signal ?? null,
    executed,
    stdout_hash: sha256(stdout),
    stderr_hash: sha256(stderr),
    status: executed && result.status === 0 ? 'PASS' : 'FAIL',
  };
}

mkdirSync('reports/execution-evidence', { recursive: true });

const detector = spawnSync('npx tsx scripts/mock-detector.ts', {
  shell: true,
  encoding: 'utf8',
  env: process.env,
  maxBuffer: 20 * 1024 * 1024,
});

const results = commands.map(([id, command]) => run(id, command));
const failed = results.filter((r) => r.status !== 'PASS');
const unexecuted = results.filter((r) => !r.executed);
const mockDetectionPassed = detector.error === undefined && detector.status === 0;

const evidence = {
  schema: 'vua.execution-integrity.v2',
  generated_at: new Date().toISOString(),
  ci: {
    run_id: process.env.GITHUB_RUN_ID ?? 'local',
    run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? 'local',
    sha: process.env.GITHUB_SHA ?? 'local',
  },
  contract: {
    tests_must_execute: true,
    tests_must_pass: true,
    production_mock_detection_must_pass: true,
    stdout_keyword_scan: false,
  },
  mock_detection: {
    executed: detector.error === undefined,
    exit_code: detector.status,
    status: mockDetectionPassed ? 'PASS' : 'FAIL',
    stdout_hash: sha256(detector.stdout ?? ''),
    stderr_hash: sha256(detector.stderr ?? ''),
  },
  summary: {
    discovered: results.length,
    executed: results.filter((r) => r.executed).length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: failed.length,
    unexecuted: unexecuted.length,
    mock_hits: mockDetectionPassed ? 0 : 1,
  },
  results,
};

const canonical = JSON.stringify(evidence);
writeFileSync('reports/execution-evidence/summary.json', JSON.stringify(evidence, null, 2) + '\n');
writeFileSync('reports/execution-evidence/summary.sha256', sha256(canonical) + '\n');

if (!mockDetectionPassed || failed.length > 0 || unexecuted.length > 0) {
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(evidence, null, 2));
