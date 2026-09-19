/**
 * VUA Mock Detector
 *
 * Static governance gate for production execution code.
 * Test code may contain controlled test doubles, but production Vortex
 * execution paths must not depend on mock/stub frameworks or fake adapters.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['src/vortex'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs']);

const RULES: Array<[string, RegExp]> = [
  ['jest.mock', /\bjest\.mock\s*\(/],
  ['vi.mock', /\bvi\.mock\s*\(/],
  ['vitest.mock', /\bvitest\.mock\s*\(/],
  ['sinon.stub', /\bsinon\.stub\s*\(/],
  ['sinon.mock', /\bsinon\.mock\s*\(/],
  ['mockImplementation', /\bmockImplementation\s*\(/],
  ['mockResolvedValue', /\bmockResolvedValue\s*\(/],
  ['mockReturnValue', /\bmockReturnValue\s*\(/],
  ['fake adapter marker', /\b(?:mock|fake|stub)[_-](?:adapter|executor|gateway|provider)\b/i],
  ['test double import in production', /(?:from|require\()\s*['\"][^'\"]*(?:__mocks__|test-doubles|test_doubles|fixtures)[^'\"]*['\"]/i],
];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTENSIONS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

const files = [...new Set(ROOTS.flatMap((root) => walk(root)))];
const findings: Array<{ file: string; line: number; rule: string; text: string }> = [];

for (const file of files) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const [rule, pattern] of RULES) {
      if (pattern.test(line)) {
        findings.push({ file, line: index + 1, rule, text: line.trim() });
      }
    }
  });
}

const result = {
  schema: 'vua.mock-detection.v1',
  scanned_files: files.length,
  findings,
  mock_count: findings.length,
  status: findings.length === 0 ? 'PASS' : 'FAIL',
};

fs.mkdirSync('reports/execution-evidence', { recursive: true });
fs.writeFileSync(
  'reports/execution-evidence/mock-detection.json',
  JSON.stringify(result, null, 2) + '\n',
);

console.log(JSON.stringify(result, null, 2));
if (findings.length > 0) process.exit(1);
