import fs from 'node:fs';
import process from 'node:process';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const missing = [];
for (const [name, command] of Object.entries(pkg.scripts)) {
  const match = String(command).match(/(?:tsx|node)\s+((?:scripts|tests|bin)\/[^\s&;]+)/);
  if (match && !fs.existsSync(match[1])) missing.push(`${name}: ${match[1]}`);
}
if (missing.length) {
  console.error(`Missing script targets:\n${missing.join('\n')}`);
  process.exit(1);
}
console.log(`Verified ${Object.keys(pkg.scripts).length} package scripts.`);
