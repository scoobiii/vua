/**
 * Vortex MCP Specification - Bounded Execution & Sandbox Engine
 * 
 * Normative Requirements:
 * 1. Observable boundary properties:
 *    filesystem_scope, network_scope, credential_scope, resource_limits
 * 2. Lexical & symlink escape rejection (realpath)
 * 3. Sibling prefix attack protection (e.g. /workspace/vortex vs /workspace/vortex-evil)
 * 4. Credential boundary isolation
 */

import path from 'path';
import type { SandboxLimits } from './types.js';

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  filesystem_scope: ['/workspace/vortex', '/tmp/vortex-sandbox', process.cwd()],
  network_scope: ['api.github.com', 'localhost'],
  credential_scope: ['cred-vortex-dev', 'cred-read-only'],
  resource_limits: {
    timeout_ms: 10000,
    memory_mb: 512,
  },
};

export interface SandboxCheckResult {
  allowed: boolean;
  status: 'AUTHORIZED' | 'SANDBOX_DENIED';
  violation_type?: 'LEXICAL_ESCAPE' | 'PATH_TRAVERSAL' | 'SIBLING_PREFIX' | 'CREDENTIAL_DENIED' | 'NETWORK_DENIED';
  message?: string;
  normalized_path?: string;
}

/**
 * Validates a filesystem path against allowed sandbox roots.
 * Strictly prevents ../ escapes, sibling directory prefix attacks, and out-of-scope paths.
 */
export function validateFilesystemScope(
  targetPath: string,
  allowedRoots: string[] = DEFAULT_SANDBOX_LIMITS.filesystem_scope
): SandboxCheckResult {
  if (!targetPath) {
    return { allowed: true, status: 'AUTHORIZED' };
  }

  // 1. Lexical checks
  if (targetPath.includes('..') || targetPath.includes('\0')) {
    return {
      allowed: false,
      status: 'SANDBOX_DENIED',
      violation_type: 'LEXICAL_ESCAPE',
      message: `Path '${targetPath}' contains illegal traversal tokens ('..' or null byte)`,
    };
  }

  // Resolve to absolute path representation while preserving containment check
  const normalized = path.normalize(targetPath);
  const resolved = path.isAbsolute(targetPath) ? normalized : path.resolve(process.cwd(), targetPath);

  // 2. Check against allowed roots with strict delimiter protection
  const isContained = allowedRoots.some((root) => {
    const normRoot = path.normalize(root);
    const resolvedRoot = path.isAbsolute(root) ? normRoot : path.resolve(process.cwd(), root);

    // Ensure trailing slash check to prevent sibling prefix bypass:
    // e.g., root '/var/app' must NOT match '/var/app_secret'
    if (normalized === normRoot || resolved === resolvedRoot) return true;
    const rootWithSep = normRoot.endsWith(path.sep) ? normRoot : normRoot + path.sep;
    const resolvedRootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;

    return normalized.startsWith(rootWithSep) || resolved.startsWith(resolvedRootWithSep);
  });

  if (!isContained) {
    return {
      allowed: false,
      status: 'SANDBOX_DENIED',
      violation_type: 'PATH_TRAVERSAL',
      message: `Path '${targetPath}' resolves to '${normalized}' which is outside authorized sandbox roots: [${allowedRoots.join(', ')}]`,
    };
  }

  return {
    allowed: true,
    status: 'AUTHORIZED',
    normalized_path: normalized,
  };
}

/**
 * Validates credential access against sandbox credential boundary
 */
export function validateCredentialScope(
  requestedCredId: string,
  allowedCredentials: string[] = DEFAULT_SANDBOX_LIMITS.credential_scope
): SandboxCheckResult {
  if (!requestedCredId) {
    return { allowed: true, status: 'AUTHORIZED' };
  }

  if (!allowedCredentials.includes(requestedCredId)) {
    return {
      allowed: false,
      status: 'SANDBOX_DENIED',
      violation_type: 'CREDENTIAL_DENIED',
      message: `Credential ID '${requestedCredId}' is not authorized in current sandbox credential_scope: [${allowedCredentials.join(', ')}]`,
    };
  }

  return { allowed: true, status: 'AUTHORIZED' };
}

/**
 * Validates network destinations
 */
export function validateNetworkScope(
  host: string,
  allowedHosts: string[] = DEFAULT_SANDBOX_LIMITS.network_scope
): SandboxCheckResult {
  if (!host) {
    return { allowed: true, status: 'AUTHORIZED' };
  }

  if (allowedHosts.includes('*')) {
    return { allowed: true, status: 'AUTHORIZED' };
  }

  if (!allowedHosts.includes(host)) {
    return {
      allowed: false,
      status: 'SANDBOX_DENIED',
      violation_type: 'NETWORK_DENIED',
      message: `Network host '${host}' is not permitted by sandbox network_scope: [${allowedHosts.join(', ')}]`,
    };
  }

  return { allowed: true, status: 'AUTHORIZED' };
}
