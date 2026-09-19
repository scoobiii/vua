/**
 * @gos3-contract
 * @version 1.0.0
 * @resource scripts/verify-gos3-headers.ts
 * @checksum sha256:f709b010f4f3c90e3f3ca4ea3fe3cfc7ab81c9026b6f00d97c56c111f2183064
 * @capability repository.verify
 * @governed true
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export interface GOS3HeaderInspection {
  file: string;
  hasHeader: boolean;
  version?: string;
  resource?: string;
  declaredChecksum?: string;
  actualChecksum?: string;
  validChecksum?: boolean;
  capability?: string;
  status: 'VALID' | 'TAMPERED' | 'MISSING_HEADER' | 'MALFORMED' | 'UNSUPPORTED';
}

type HeaderStyle = 'block' | 'hash' | 'html';

const STYLE_BY_EXTENSION: Record<string, HeaderStyle> = {
  '.ts': 'block', '.tsx': 'block', '.js': 'block', '.jsx': 'block',
  '.mjs': 'block', '.cjs': 'block', '.css': 'block',
  '.md': 'html', '.yml': 'hash', '.yaml': 'hash', '.sh': 'hash',
  '.bash': 'hash',
};

function styleFor(filePath: string): HeaderStyle | null {
  return STYLE_BY_EXTENSION[path.extname(filePath).toLowerCase()] ?? null;
}

function headerPattern(style: HeaderStyle): RegExp {
  if (style === 'block') return /\/\*\*[\s\S]*?@gos3-contract[\s\S]*?\*\/\n?/;
  if (style === 'html') return /<!--[\s\S]*?@gos3-contract[\s\S]*?-->\n?/;
  return /(?:^|\n)# @gos3-contract[\s\S]*?(?:\n# @governed[^\n]*\n?)/;
}

function parseHeader(content: string, style: HeaderStyle) {
  const match = content.match(headerPattern(style));
  if (!match) return null;
  const body = match[0];
  return {
    version: body.match(/@version\s+([^\r\n*<]+)/)?.[1]?.trim(),
    resource: body.match(/@resource\s+([^\r\n*<]+)/)?.[1]?.trim(),
    declaredChecksum: body.match(/@checksum\s+([^\r\n*<]+)/)?.[1]?.trim(),
    capability: body.match(/@capability\s+([^\r\n*<]+)/)?.[1]?.trim(),
  };
}

export function calculateGOS3ContentHash(content: string, style: HeaderStyle = 'block'): string {
  const header = content.match(headerPattern(style))?.[0] ?? '';
  const stripped = content.replace(header, '').trim();
  const hash = crypto.createHash('sha256').update(stripped, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

export function inspectFileGOS3Header(filePath: string): GOS3HeaderInspection {
  if (!fs.existsSync(filePath)) return { file: filePath, hasHeader: false, status: 'MISSING_HEADER' };

  const style = styleFor(filePath);
  if (!style) return { file: filePath, hasHeader: false, status: 'UNSUPPORTED' };

  const content = fs.readFileSync(filePath, 'utf8');
  const header = parseHeader(content, style);
  if (!header) return { file: filePath, hasHeader: false, status: 'MISSING_HEADER' };

  const { version, resource, declaredChecksum, capability } = header;
  if (!version || !resource || !declaredChecksum || !capability) {
    return { file: filePath, hasHeader: true, version, resource, declaredChecksum, capability, status: 'MALFORMED' };
  }

  const actualChecksum = calculateGOS3ContentHash(content, style);
  const validChecksum = declaredChecksum === actualChecksum;
  return {
    file: filePath, hasHeader: true, version, resource, declaredChecksum,
    actualChecksum, validChecksum, capability,
    status: validChecksum ? 'VALID' : 'TAMPERED',
  };
}

export function generateGOS3Header(
  resourcePath: string,
  contentWithoutHeader: string,
  capability = 'repository.write',
  style: HeaderStyle = 'block',
): string {
  const checksum = crypto.createHash('sha256').update(contentWithoutHeader.trim(), 'utf8').digest('hex');
  const fields = [
    '@gos3-contract',
    '@version 1.0.0',
    `@resource ${resourcePath}`,
    `@checksum sha256:${checksum}`,
    `@capability ${capability}`,
    '@governed true',
  ];
  if (style === 'hash') return `${fields.map(x => `# ${x}`).join('\\n')}\\n`;
  if (style === 'html') return `<!--\\n${fields.map(x => `  ${x}`).join('\\n')}\\n-->\\n`;
  return `/**\\n${fields.map(x => ` * ${x}`).join('\\n')}\\n */\\n`;
}

function immediateGovernedFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(f => path.join(dir, f))
    .filter(fullPath => fs.statSync(fullPath).isFile())
    .filter(fullPath => fullPath !== path.resolve('scripts/verify-gos3-headers.ts'))
    .filter(fullPath => Boolean(styleFor(fullPath)));
}

export function runGOS3HeaderAudit(directories: string[]) {
  const files = [...new Set(directories.flatMap(immediateGovernedFiles))].sort();
  const inspected = files.map(inspectFileGOS3Header);
  return summarize(inspected);
}

function summarize(inspected: GOS3HeaderInspection[]) {
  const valid = inspected.filter(r => r.status === 'VALID').length;
  const missing = inspected.filter(r => r.status === 'MISSING_HEADER').length;
  const malformed = inspected.filter(r => r.status === 'MALFORMED').length;
  const tampered = inspected.filter(r => r.status === 'TAMPERED').length;
  const unsupported = inspected.filter(r => r.status === 'UNSUPPORTED').length;
  const failed = inspected.length - valid;
  return {
    inspected, total: inspected.length, valid, failed,
    missing, malformed, tampered, unsupported,
    allValid: inspected.length > 0 && failed === 0,
  };
}

function printAudit(audit: ReturnType<typeof summarize>) {
  console.log(`Coverage: ${audit.valid}/${audit.total} valid; missing=${audit.missing}; malformed=${audit.malformed}; tampered=${audit.tampered}; unsupported=${audit.unsupported}`);
  for (const item of audit.inspected) {
    if (item.status === 'VALID') {
      console.log(` ✅ [VALID] ${item.file} (v${item.version}, ${item.declaredChecksum?.substring(0, 18)}...)`);
    } else {
      console.error(` ❌ [${item.status}] ${item.file}`);
      if (item.declaredChecksum && item.actualChecksum) {
        console.error(`    Declared: ${item.declaredChecksum}`);
        console.error(`    Actual:   ${item.actualChecksum}`);
      }
    }
  }
}

if (process.argv[1]?.includes('verify-gos3-headers')) {
  console.log('🛡️  VORTEX GOS3 CONTRACT HEADER VERIFIER (spec §8)');
  console.log('----------------------------------------------------');

  const filesFlag = process.argv.indexOf('--files');
  const files = filesFlag >= 0
    ? process.argv.slice(filesFlag + 1).filter(x => !x.startsWith('--'))
    : [];

  const audit = files.length
    ? summarize(files.map(inspectFileGOS3Header))
    : runGOS3HeaderAudit(['./src/governed', './src/vortex', './scripts']);

  printAudit(audit);

  if (!audit.allValid && process.argv.includes('--strict')) {
    console.error('\n❌ GOS3 Gate Failed: every inspected governed file must have a valid contract header.');
    process.exit(1);
  }
  console.log('\n✅ GOS3 Gate Complete: inspected governed files verified.');
}
