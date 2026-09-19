/**
 * VUA CI execution-integrity gate.
 *
 * Contract:
 * - every registered test command must actually execute;
 * - command exit status must be zero;
 * - output must not contain explicit mock/stub/bypass markers;
 * - an evidence record is persisted for every executed command.
 *
 * This is deliberately independent from a conventional green test summary:
 * CI is green only when the execution contract is satisfied.
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
  mock_markers: string[];
  status: 'PASS' | 'FAIL';
};

const commands = [
  ['unit', 'npm run test:unit'],
  ['integration', 'npm run test:integration'],
  ['stress', 'npm run test:stress'],
  ['chaos', 'npm run test:chaos'],
  ['security', 'npm run test:security'],
  ['bench', 'npm run test:bench'],
] as const;

// Intentionally conservative: these are governance/test doubles that must never
// silently become the evidence behind a conformance result.
const MOCK_MARKERS = [
  /\\bmock\\b/i,
  /\\bstub\\b/i,
  /\\bfixture\\b/i,
  /\\bfake\\b/i,
  /\\bbypass\\b/i,
  /\\bsimulat(?:e|ed|ion)\\b/i,
];

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
  const combined = stdout + '\n' + stderr;
  const mockMarkers = MOCK_MARKERS
    .filter((pattern) => pattern.test(combined))
    .map((pattern) => pattern.source);

  const executed = result.error === undefined;
  const status =
    executed &&
    result.status === 0 &&
    mockMarkers.length === 0
      ? 'PASS'
      : 'FAIL';

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
    mock_markers: mockMarkers,
    status,
  };
}

mkdirSync('reports/execution-evidence', { recursive: true });

const results = commands.map(([id, command]) => run(id, command));
const failed = results.filter((r) => r.status !== 'PASS');
const unexecuted = results.filter((r) => !r.executed);
const mockHits = results.filter((r) => r.mock_markers.length > 0);

const evidence = {
  schema: 'vua.execution-integrity.v1',
  generated_at: new Date().toISOString(),
  ci: {
    run_id: process.env.GITHUB_RUN_ID ?? 'local',
    run_attempt: process.env.GITHUB_RUN_ATTEMPT ?? 'local',
    sha: process.env.GITHUB_SHA ?? 'local',
  },
  contract: {
    tests_must_execute: true,
    tests_must_pass: true,
    mocks_forbidden_in_execution_output: true,
  },
  summary: {
    discovered: results.length,
    executed: results.filter((r) => r.executed).length,
    passed: results.filter((r) => r.status === 'PASS').length,
    failed: failed.length,
    unexecuted: unexecuted.length,
    mock_hits: mockHits.length,
  },
  results,
};

const canonical = JSON.stringify(evidence);
writeFileSync('reports/execution-evidence/summary.json', JSON.stringify(evidence, null, 2));
writeFileSync('reports/execution-evidence/summary.sha256', sha256(canonical) + '\n');

if (failed.length > 0 || unexecuted.length > 0 || mockHits.length > 0) {
  console.error(JSON.stringify(evidence, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(evidence, null, 2));
