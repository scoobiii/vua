export type CheckConclusion = 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
export function isCiBlocked(
  requiredNames: string[],
  runs: Array<{ name: string; conclusion: CheckConclusion; status?: string }>,
): { blocked: boolean; reasons: string[] } {
  const byName = new Map(runs.map((r) => [r.name, r]));
  const reasons: string[] = [];
  for (const name of requiredNames) {
    const r = byName.get(name);
    if (!r) { reasons.push(`${name}: MISSING`); continue; }
    if (r.status === 'in_progress' || r.status === 'queued') { reasons.push(`${name}: ${r.status}`); continue; }
    if (r.conclusion !== 'success') reasons.push(`${name}: ${r.conclusion ?? 'null'}`);
  }
  return { blocked: reasons.length > 0, reasons };
}
function assert(c: boolean, m: string) { if (!c) throw new Error(m); }
const R = [
  'Lint, tests, build and attested performance gate',
  'Conformance, 100% Quality Gates & GOS3 Audit',
  'Tests + execution evidence + mock gate',
];
assert(isCiBlocked(R, R.map(name => ({ name, conclusion: 'success' as const, status: 'completed' }))).blocked === false, 'all ok');
assert(isCiBlocked(R, R.map((name, i) => ({ name, conclusion: (i === 0 ? 'failure' : 'success') as CheckConclusion, status: 'completed' }))).blocked === true, 'fail');
assert(isCiBlocked(R, [{ name: R[0], conclusion: 'success', status: 'completed' }]).blocked === true, 'missing');
assert(isCiBlocked(R, [
  { name: R[0], conclusion: null, status: 'in_progress' },
  { name: R[1], conclusion: 'success', status: 'completed' },
  { name: R[2], conclusion: 'success', status: 'completed' },
]).blocked === true, 'in_progress');
console.log('✅ ci-subjection-gate.test.ts PASS');
