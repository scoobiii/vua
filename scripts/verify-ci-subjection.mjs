#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const args = process.argv.slice(2);
function flag(n) {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : undefined;
}

const sha = flag('--sha') || process.env.SHA || process.env.GITHUB_SHA;
const repo = flag('--repo') || process.env.REPO || process.env.GITHUB_REPOSITORY;

const DEFAULT = [
  'Lint, tests, build and attested performance gate',
  'Conformance, 100% Quality Gates & GOS3 Audit',
  'Tests + execution evidence + mock gate',
];

const names = (process.env.REQUIRED_CHECK_NAMES || '')
  .split('|')
  .map(function (s) { return s.trim(); })
  .filter(Boolean);
const required = names.length ? names : DEFAULT;

if (!sha || !repo) {
  console.error('CI_SUBJECTED: missing sha/repo');
  process.exit(1);
}

var payload;
try {
  var out = execFileSync(
    'gh',
    ['api', 'repos/' + repo + '/commits/' + sha + '/check-runs', '--paginate'],
    { encoding: 'utf8' }
  );
  payload = JSON.parse(out);
} catch (e) {
  console.error('CI_SUBJECTED: fetch failed', e && e.message ? e.message : e);
  process.exit(1);
}

var runs = Array.isArray(payload) ? payload : (payload.check_runs || []);
var byName = new Map();
for (var i = 0; i < runs.length; i++) {
  var r = runs[i];
  var prev = byName.get(r.name);
  if (!prev || new Date(r.completed_at || 0) > new Date(prev.completed_at || 0)) {
    byName.set(r.name, r);
  }
}

var blocked = false;
for (var j = 0; j < required.length; j++) {
  var name = required[j];
  var run = byName.get(name);
  var conclusion = run && run.conclusion != null ? run.conclusion : 'MISSING';
  var status = run && run.status != null ? run.status : 'missing';
  console.log('check: ' + name + ' -> ' + status + '/' + conclusion);
  if (status === 'in_progress' || status === 'queued' || conclusion !== 'success') {
    blocked = true;
  }
}

if (blocked) {
  console.error('CI_SUBJECTED: blocked');
  process.exit(1);
}
console.log('CI_SUBJECTED: ok');
process.exit(0);
