#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const sha = flag('--sha') || process.env.SHA || process.env.GITHUB_SHA;
const repo = flag('--repo') || process.env.REPO || process.env.GITHUB_REPOSITORY;
const DEFAULT = [
  'Lint, tests, build and attested performance gate',
  'Conformance, 100% Quality Gates & GOS3 Audit',
  'Tests + execution evidence + mock gate',
];
const names = (process.env.REQUIRED_CHECK_NAMES || '').split('|').map(s => s.trim()).filter(Boolean);
const required = names.length ? names : DEFAULT;
if (!sha || !repo) { console.error('CI_SUBJECTED: missing sha/repo'); process.exit(1); }
let payload;
try {
  payload = JSON.parse(execFileSync('gh', ['api', `repos/\( {repo}/commits/ \){sha}/check-runs`, '--paginate'], { encoding: 'utf8' }));
} catch (e) {
  console.error('CI_SUBJECTED: fetch failed', e.message || e);
  process.exit(1);
}
const runs = Array.isArray(payload) ? payload : (payload.check_runs || []);
const byName = new Map();
for (const r of runs) {
  const prev = byName.get(r.name);
  if (!prev || new Date(r.completed_at || 0) > new Date(prev.completed_at || 0)) byName.set(r.name, r);
}
let blocked = false;
for (const name of required) {
  const r = byName.get(name);
  const conclusion = r?.conclusion ?? 'MISSING';
  const status = r?.status ?? 'missing';
  console.log(`check: ${name} → \( {status}/ \){conclusion}`);
  if (status === 'in_progress' || status === 'queued' || conclusion !== 'success') blocked = true;
}
if (blocked) { console.error('CI_SUBJECTED: blocked'); process.exit(1); }
console.log('CI_SUBJECTED: ok');
process.exit(0);
