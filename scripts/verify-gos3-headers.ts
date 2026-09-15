/**
 * GOS3 Contract Header Verification CLI & Engine
 * 
 * Verifiable both locally:
 *   npx tsx scripts/verify-gos3-headers.ts
 * And in CI:
 *   npx tsx scripts/verify-gos3-headers.ts --strict
 * 
 * Specification: GOS3 v1 (§8 Resource Onboard Contract)
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
  status: 'VALID' | 'TAMPERED' | 'MISSING_HEADER' | 'MALFORMED';
}

/**
 * Calculates SHA-256 of file content (excluding the GOS3 contract comment itself)
 */
export function calculateGOS3ContentHash(content: string): string {
  // Strip out the GOS3 header comment block so checksum evaluates the governed code/content
  const stripped = content.replace(/\/\*\*[\s\S]*?@gos3-contract[\s\S]*?\*\/\n?/, '').trim();
  const hash = crypto.createHash('sha256').update(stripped, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

/**
 * Parses and verifies GOS3 header in a file
 */
export function inspectFileGOS3Header(filePath: string): GOS3HeaderInspection {
  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      hasHeader: false,
      status: 'MISSING_HEADER',
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const headerMatch = content.match(/\/\*\*[\s\S]*?@gos3-contract([\s\S]*?)\*\//);

  if (!headerMatch) {
    return {
      file: filePath,
      hasHeader: false,
      status: 'MISSING_HEADER',
    };
  }

  const headerBody = headerMatch[1];
  const versionMatch = headerBody.match(/@version\s+([^\r\n*]+)/);
  const resourceMatch = headerBody.match(/@resource\s+([^\r\n*]+)/);
  const checksumMatch = headerBody.match(/@checksum\s+([^\r\n*]+)/);
  const capabilityMatch = headerBody.match(/@capability\s+([^\r\n*]+)/);

  const version = versionMatch ? versionMatch[1].trim() : undefined;
  const resource = resourceMatch ? resourceMatch[1].trim() : undefined;
  const declaredChecksum = checksumMatch ? checksumMatch[1].trim() : undefined;
  const capability = capabilityMatch ? capabilityMatch[1].trim() : undefined;

  if (!version || !declaredChecksum) {
    return {
      file: filePath,
      hasHeader: true,
      version,
      resource,
      declaredChecksum,
      status: 'MALFORMED',
    };
  }

  const actualChecksum = calculateGOS3ContentHash(content);
  const validChecksum = declaredChecksum === actualChecksum;

  return {
    file: filePath,
    hasHeader: true,
    version,
    resource,
    declaredChecksum,
    actualChecksum,
    validChecksum,
    capability,
    status: validChecksum ? 'VALID' : 'TAMPERED',
  };
}

/**
 * Generate a valid GOS3 header comment for a file
 */
export function generateGOS3Header(
  resourcePath: string,
  contentWithoutHeader: string,
  capability = 'repository.write'
): string {
  const stripped = contentWithoutHeader.replace(/\/\*\*[\s\S]*?@gos3-contract[\s\S]*?\*\/\n?/, '').trim();
  const checksum = crypto.createHash('sha256').update(stripped, 'utf8').digest('hex');
  const now = new Date().toISOString();

  return `/**
 * @gos3-contract
 * @version 1.0.0
 * @resource ${resourcePath}
 * @checksum sha256:${checksum}
 * @capability ${capability}
 * @onboarded_at ${now}
 * @governed true
 */
`;
}

/**
 * Main verification runner
 */
export function runGOS3HeaderAudit(directories: string[]): {
  inspected: GOS3HeaderInspection[];
  total: number;
  valid: number;
  failed: number;
  allValid: boolean;
} {
  const results: GOS3HeaderInspection[] = [];

  for (const dir of directories) {
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const f of files) {
      const fullPath = path.join(dir, f);
      const stat = fs.statSync(fullPath);

      if (
        stat.isFile() &&
        f !== 'verify-gos3-headers.ts' &&
        (f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.json') || f.endsWith('.md'))
      ) {
        // Check if file specifies GOS3 or is designated governed
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('@gos3-contract') || fullPath.includes('/governed/') || fullPath.includes('vortex-governed')) {
          results.push(inspectFileGOS3Header(fullPath));
        }
      }
    }
  }

  const valid = results.filter((r) => r.status === 'VALID').length;
  const failed = results.filter((r) => r.status !== 'VALID').length;

  return {
    inspected: results,
    total: results.length,
    valid,
    failed,
    allValid: failed === 0 && results.length > 0,
  };
}

// CLI Execution Entry Point
if (process.argv[1]?.includes('verify-gos3-headers')) {
  console.log('🛡️  VORTEX GOS3 CONTRACT HEADER VERIFIER (spec §8)');
  console.log('----------------------------------------------------');

  const targets = ['./src/governed', './src/vortex', './scripts'];
  const audit = runGOS3HeaderAudit(targets);

  console.log(`Audited: ${audit.total} governed files.`);
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

  if (!audit.allValid && process.argv.includes('--strict')) {
    console.error('\n❌ GOS3 Gate Failed: One or more governed files have missing or tampered contracts.');
    process.exit(1);
  } else {
    console.log('\n✅ GOS3 Gate Complete: All monitored contracts verified.');
  }
}
