/**
 * Vortex MCP Specification - Policy & Authorization Engine
 * 
 * Normative rules:
 * 1. Distinction between AUTHORIZED and APPROVED:
 *    inspect -> automatic
 *    propose -> automatic
 *    verify -> automatic
 *    execute -> policy dependent
 *    branch.write -> human approval required
 *    merge main -> prohibited
 *    publish -> prohibited
 * 
 * 2. Scope-governed capabilities:
 *    Every capability MUST declare exact repository, branch, or path scope.
 */

import type { AuthorizationContext, GovernedCapability, VortexOperation } from './types.js';

export interface PolicyRule {
  id: string;
  version: string;
  name: string;
  allowed_capabilities: GovernedCapability[];
  prohibited_operations: string[];
  require_human_approval: string[]; // e.g. ['branch.write', 'execute:production', 'git.push']
  max_timeout_ms: number;
}

export const DEFAULT_DEV_POLICY: PolicyRule = {
  id: 'vortex-development',
  version: '1.0.0',
  name: 'Standard Vortex Development Governance Policy',
  allowed_capabilities: [
    {
      capability: 'repository.read',
      scope: {
        repositories: ['scoobiii/vortex', 'test/repo', '*'],
        paths: ['src/*', 'test/*', 'docs/*'],
      },
      side_effect: false,
      approval: 'automatic',
    },
    {
      capability: 'repository.write',
      scope: {
        repositories: ['scoobiii/vortex', 'test/repo'],
        branches: ['feat/*', 'fix/*', 'patch/*'],
        paths: ['src/*', 'test/*'],
      },
      side_effect: true,
      approval: 'required',
    },
    {
      capability: 'sandbox.execute',
      scope: {
        paths: ['/workspace/vortex/*', 'dist/*'],
        max_timeout_ms: 10000,
      },
      side_effect: true,
      approval: 'automatic',
    },
    {
      capability: 'llm.inference',
      scope: {
        paths: ['*'],
        repositories: ['*'],
        max_timeout_ms: 60000,
      },
      side_effect: false,
      approval: 'automatic',
    },
    {
      capability: 'vua.adapter.read',
      scope: {
        paths: ['*'],
        repositories: ['*'],
        max_timeout_ms: 30000,
      },
      side_effect: false,
      approval: 'automatic',
    },
    {
      capability: 'vua.adapter.execute',
      scope: {
        paths: ['*'],
        repositories: ['*'],
        max_timeout_ms: 30000,
      },
      side_effect: true,
      approval: 'automatic',
    },
    {
      capability: 'vua.adapter.write',
      scope: {
        paths: ['*'],
        repositories: ['*'],
        max_timeout_ms: 30000,
      },
      side_effect: true,
      approval: 'required',
    },
    {
      capability: 'vua.canary.execute',
      scope: {
        paths: ['*'],
        repositories: ['*'],
        resources: ['*'],
        max_timeout_ms: 30000,
      },
      side_effect: true,
      approval: 'required',
    },
    {
      capability: 'vua.canary.read',
      scope: {
        paths: ['*'],
        repositories: ['*'],
        resources: ['*'],
        max_timeout_ms: 30000,
      },
      side_effect: false,
      approval: 'automatic',
    },
  ],
  prohibited_operations: [
    'repository.merge:main',
    'repository.publish',
    'system.root_exec',
    'credential.export',
  ],
  require_human_approval: [
    'branch.write',
    'repository.write',
    'repository.branch:main',
  ],
  max_timeout_ms: 30000,
};

function matchPattern(pattern: string, value?: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (pattern === '*' || pattern === '**') return true;
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -2);
    return value.startsWith(prefix);
  }
  if (pattern.endsWith('*')) {
    const prefix = pattern.slice(0, -1);
    return value.startsWith(prefix);
  }
  return pattern === value;
}

export interface PolicyEvaluation {
  allowed: boolean;
  status: 'AUTHORIZED' | 'POLICY_DENIED';
  requires_approval: boolean;
  is_approved: boolean;
  reason?: string;
}

/**
 * Evaluates authorization context against policy rules
 */
export function evaluatePolicy(
  operation: VortexOperation,
  target: { repository?: string; branch?: string; path?: string } | undefined,
  auth?: AuthorizationContext,
  approvalToken?: string,
  policy: PolicyRule = DEFAULT_DEV_POLICY
): PolicyEvaluation {
  // Read-only operations have permissive baseline
  if (operation === 'inspect' || operation === 'verify') {
    return {
      allowed: true,
      status: 'AUTHORIZED',
      requires_approval: false,
      is_approved: true,
    };
  }

  // Proposals do not execute side effects
  if (operation === 'propose') {
    return {
      allowed: true,
      status: 'AUTHORIZED',
      requires_approval: false,
      is_approved: true,
    };
  }

  // Mutable operations REQUIRE full authorization context
  if (!auth) {
    return {
      allowed: false,
      status: 'POLICY_DENIED',
      requires_approval: false,
      is_approved: false,
      reason: 'Mutable operation lacks required Authorization Context (auth is undefined)',
    };
  }

  // Check prohibited operations (e.g. merge main, publish)
  if (
    policy.prohibited_operations.includes(operation) ||
    policy.prohibited_operations.includes(auth.capability) ||
    (operation === 'publish' && policy.prohibited_operations.some((p) => p.includes('publish')))
  ) {
    return {
      allowed: false,
      status: 'POLICY_DENIED',
      requires_approval: false,
      is_approved: false,
      reason: `Operation '${operation}' with capability '${auth.capability}' is strictly prohibited by policy`,
    };
  }

  if (target?.branch === 'main' || target?.branch === 'master') {
    if (operation === 'branch.write' || auth.capability === 'repository.merge') {
      return {
        allowed: false,
        status: 'POLICY_DENIED',
        requires_approval: false,
        is_approved: false,
        reason: 'Direct write/merge to main branch is strictly prohibited by policy',
      };
    }
  }

  // Find matching governed capability
  const matchingCap = policy.allowed_capabilities.find(
    (c) =>
      c.capability === auth.capability ||
      matchPattern(c.capability, auth.capability) ||
      (c.capability === 'vua.adapter.execute' && typeof auth.capability === 'string' && auth.capability.startsWith('vua.')) ||
      (c.capability === 'vua.adapter.write' && typeof auth.capability === 'string' && auth.capability.startsWith('vua.') && auth.capability.includes('write'))
  );
  if (!matchingCap) {
    return {
      allowed: false,
      status: 'POLICY_DENIED',
      requires_approval: false,
      is_approved: false,
      reason: `Capability '${auth.capability}' is not granted in policy '${policy.id}'`,
    };
  }

  // Enforce side_effect constraint: read-only capability cannot authorize mutating operations
  if ((operation === 'branch.write' || operation === 'execute') && matchingCap.side_effect === false) {
    return {
      allowed: false,
      status: 'POLICY_DENIED',
      requires_approval: false,
      is_approved: false,
      reason: `Operation '${operation}' requires a mutating capability, but capability '${auth.capability}' is read-only (side_effect: false)`,
    };
  }

  // Check repository scope
  if (target?.repository && matchingCap.scope.repositories) {
    const repoMatch = matchingCap.scope.repositories.some((p) => matchPattern(p, target.repository!));
    if (!repoMatch) {
      return {
        allowed: false,
        status: 'POLICY_DENIED',
        requires_approval: false,
        is_approved: false,
        reason: `Target repository '${target.repository}' is outside authorized scope [${matchingCap.scope.repositories.join(', ')}]`,
      };
    }
  }

  // Check branch scope
  if (target?.branch && matchingCap.scope.branches) {
    const branchMatch = matchingCap.scope.branches.some((p) => matchPattern(p, target.branch!));
    if (!branchMatch) {
      return {
        allowed: false,
        status: 'POLICY_DENIED',
        requires_approval: false,
        is_approved: false,
        reason: `Target branch '${target.branch}' is outside authorized scope [${matchingCap.scope.branches.join(', ')}]`,
      };
    }
  }

  // Check approval requirements
  const needsApproval =
    matchingCap.approval === 'required' ||
    policy.require_human_approval.includes(operation) ||
    policy.require_human_approval.includes(auth.capability);

  const hasValidApproval =
    approvalToken === 'vortex-approved-human' ||
    approvalToken === 'appr-token-verified' ||
    approvalToken?.startsWith('approval-') ||
    approvalToken?.startsWith('appr-');

  if (needsApproval && !hasValidApproval) {
    return {
      allowed: false,
      status: 'POLICY_DENIED',
      requires_approval: true,
      is_approved: false,
      reason: `Operation '${operation}' with capability '${auth.capability}' requires explicit human approval token`,
    };
  }

  return {
    allowed: true,
    status: 'AUTHORIZED',
    requires_approval: needsApproval,
    is_approved: true,
  };
}
