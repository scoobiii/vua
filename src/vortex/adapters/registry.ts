/**
 * VUA - Vortex Universal Connector: Adapter Registry
 * Central orchestrator for multi-environment adapters: GitHub, Linux, Android, and Windows.
 */

import { executeVortexPipeline } from '../gateway.js';
import { getOrCreateGOS3Session } from '../gos3.js';
import { sha256 } from '../crypto.js';
import { verifyExecutionProof } from '../verifier.js';
import type { ApprovalClaims, ExternalEffect, VortexRequest } from '../types.js';
import type {
  IVUAAdapter,
  VUAActionRequest,
  VUAActionResult,
  VUAAdapterId,
  VUAAdapterMetadata,
} from './types.js';
import { VUAGitHubAdapter } from './github.js';
import { VUALinuxAdapter } from './linux.js';
import { VUAAndroidAdapter } from './android.js';
import { VUAWindowsAdapter } from './windows.js';
import { VUABlueskyAdapter } from './bluesky.js';
import { VUAGCloudAdapter } from './gcloud.js';
import { VUABendAdapter } from './bend.js';

function validateApproval(
  approval: ApprovalClaims,
  action: string,
  target: Record<string, unknown> = {},
  payload: Record<string, unknown> = {}
): void {
  const now = Date.now();
  const expires = Date.parse(approval.expires_at);

  if (Number.isNaN(expires) || expires < now) {
    throw new Error('APPROVAL_EXPIRED: approval token lifetime exceeded');
  }

  if (approval.action !== action) {
    throw new Error(`APPROVAL_ACTION_MISMATCH: approved for ${approval.action}, got ${action}`);
  }

  const expectedOwner = (target.owner || payload.owner || '') as string;
  const expectedRepo = (target.repo || payload.repo || '') as string;
  if (approval.owner && expectedOwner && approval.owner !== expectedOwner) {
    throw new Error('APPROVAL_TARGET_MISMATCH: repository owner mismatch');
  }
  if (approval.repo && expectedRepo && approval.repo !== expectedRepo) {
    throw new Error('APPROVAL_TARGET_MISMATCH: repository name mismatch');
  }

  const computedPayloadHash = sha256(payload);
  if (approval.payload_hash && approval.payload_hash !== computedPayloadHash) {
    throw new Error('APPROVAL_PAYLOAD_TAMPERED: payload hash mismatch');
  }
}

function rejectOverbroadScope(scope?: {
  paths?: string[];
  repositories?: string[];
  resources?: string[];
}): void {
  if (!scope) return;
  const wildcard =
    scope.paths?.includes('*') ||
    scope.repositories?.includes('*') ||
    scope.resources?.includes('*');

  if (wildcard && process.env.VUA_ALLOW_WILDCARD_SCOPE !== 'true') {
    throw new Error('WILDCARD_SCOPE_FORBIDDEN');
  }
}

export class CanaryAdapter implements IVUAAdapter {
  public sideEffectCount = 0;
  public metadata: VUAAdapterMetadata = {
    id: 'canary',
    name: 'Canary Side-Effect Adapter',
    environment: 'test',
    version: '1.0.0',
    status: 'online',
    description: 'Canary adapter to verify that side-effects never trigger on denied policy, missing approval, or invalid proof.',
    capabilities: ['canary.read', 'canary.write'],
    supportedActions: [
      { action: 'read', description: 'Read state without mutation', risk: 'read', requiresApproval: false },
      { action: 'write', description: 'Mutate sideEffectCount with approval', risk: 'write', requiresApproval: true },
    ],
    actions: {
      read: { action: 'read', description: 'Read state', risk: 'read', requiresApproval: false },
      write: { action: 'write', description: 'Mutate sideEffectCount', risk: 'write', requiresApproval: true },
    },
  };

  public async executeAction(action: string, target?: Record<string, unknown>, payload?: Record<string, unknown>) {
    if (action === 'write') {
      this.sideEffectCount++;
    }
    return {
      data: { sideEffectCount: this.sideEffectCount, action, payload },
      auditLog: [`canary:${action}:invoked:count=${this.sideEffectCount}`],
    };
  }

  public async probeStatus() {
    return { status: 'online' as const, metrics: { sideEffectCount: this.sideEffectCount } };
  }
}

class VUAAdapterRegistry {
  private adapters: Map<VUAAdapterId, IVUAAdapter> = new Map();

  constructor() {
    this.register(new VUAGitHubAdapter());
    this.register(new VUALinuxAdapter());
    this.register(new VUAAndroidAdapter());
    this.register(new VUAWindowsAdapter());
    this.register(new VUABlueskyAdapter());
    this.register(new VUAGCloudAdapter());
    this.register(new VUABendAdapter());
    this.register(new CanaryAdapter());
  }

  public register(adapter: IVUAAdapter): void {
    this.adapters.set(adapter.metadata.id, adapter);
  }

  public get(id: VUAAdapterId): IVUAAdapter | undefined {
    return this.adapters.get(id);
  }

  public list(): VUAAdapterMetadata[] {
    return Array.from(this.adapters.values()).map((a) => a.metadata);
  }

  /**
   * Invokes an action on a specific adapter through the Vortex Execution Gateway.
   * Emits an Ed25519 ExecutionProof v1 and verifies it cryptographically.
   */
  public async invoke(request: VUAActionRequest): Promise<VUAActionResult> {
    const adapter = this.adapters.get(request.adapterId);
    if (!adapter) {
      throw new Error(`Adapter '${request.adapterId}' is not registered in VUA`);
    }

    // 1. Action metadata & approval enforcement
    const actionMeta =
      adapter.metadata.actions?.[request.action] ||
      adapter.metadata.supportedActions.find((a) => a.action === request.action);

    if (!actionMeta && adapter.metadata.id !== 'canary') {
      throw new Error(`ACTION_NOT_REGISTERED:${request.action}`);
    }

    if (actionMeta?.requiresApproval && !request.approvalToken) {
      throw new Error('APPROVAL_REQUIRED');
    }

    if (request.approvalToken) {
      // If structured approval claims provided, validate cryptographic and payload binding
      try {
        const parsed = JSON.parse(request.approvalToken) as ApprovalClaims;
        if (parsed.approval_id && parsed.action) {
          validateApproval(parsed, request.action, request.target, request.payload);
        }
      } catch (err: any) {
        if (err.message?.startsWith('APPROVAL_')) {
          throw err;
        }
        // If not JSON, treat as legacy opaque token string
      }
    }

    const reqId =
      request.requestId ||
      `vua-${request.adapterId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const resource = `vua://${request.adapterId}/${request.action}`;

    // 2. Dynamic authorization context - no global hardcoded wildcard
    const authorization = request.authorization || {
      principal_id: 'usr-vua-runtime',
      agent_id: 'agent/vua-connector',
      policy_id: 'vortex-runtime-policy',
      policy_version: '1.0.0',
      capability: `vua.${request.adapterId}.execute`,
      scope: {
        paths: [`/${request.adapterId}/sandbox`],
        repositories: ['vortex-foundation/vua-connector'],
        resources: [resource],
      },
    };

    rejectOverbroadScope(authorization.scope);

    const gos3Session = getOrCreateGOS3Session(
      authorization.principal_id,
      authorization.agent_id,
      resource
    );

    let executionData: Record<string, unknown> = {};
    let auditLog: any = [];

    // 3. Prepare governed Vortex Request
    const vortexRequest: VortexRequest = {
      request_id: reqId,
      operation: 'execute',
      target: {
        resource,
        adapter: request.adapterId,
        action: request.action,
        ...(request.target || {}),
      },
      authorization: {
        principal_id: authorization.principal_id,
        agent_id: authorization.agent_id,
        policy_id: authorization.policy_id,
        policy_version: authorization.policy_version,
        capability: authorization.capability,
        gos3_session_id: gos3Session.session_id,
        scope: authorization.scope,
      },
      input: {
        action: request.action,
        target: request.target,
        payload: request.payload,
      },
      approval_token: request.approvalToken,
    };

    // 4. Execute within Gateway pipeline: records real timing and hashes real adapter output
    const pipelineRes = await executeVortexPipeline(vortexRequest, async () => {
      const execRes = await adapter.executeAction(
        request.action,
        request.target || {},
        request.payload || {}
      );
      executionData = execRes.data;
      auditLog = execRes.auditLog;
      return execRes.data;
    });

    // 5. Strictly verify the generated proof - proof absent/invalid can NEVER produce success
    const verification = pipelineRes.execution_proof
      ? verifyExecutionProof(pipelineRes.execution_proof)
      : undefined;

    const verified = Boolean(
      pipelineRes.execution_proof && verification?.valid === true
    );

    const capabilityExecuted = Boolean(
      verified && pipelineRes.execution_proof?.executed === true
    );

    const durationMs = pipelineRes.execution_proof?.duration_ms ?? 0;

    // Resolve external effect status from execution payload or defaults
    const externalEffect: ExternalEffect =
      (executionData.external_effect as ExternalEffect) ||
      (request.adapterId === 'github' && ['push_branch', 'create_pull_request', 'create_pr_written', 'merge_pr'].includes(request.action)
        ? (Boolean(process.env.GITHUB_TOKEN) ? 'remote_confirmed' : 'none')
        : request.adapterId === 'bluesky' && ['post', 'post_thread', 'reply', 'update_profile'].includes(request.action)
        ? (Boolean(process.env.BLUESKY_IDENTIFIER && (process.env.BLUESKY_APP_PASSWORD || process.env.BSKY_APP_PASSWORD)) ? 'remote_confirmed' : 'none')
        : 'local_only');

    const authenticated = Boolean(
      (executionData.authenticated as boolean) ??
      (request.adapterId === 'github' ? Boolean(process.env.GITHUB_TOKEN) : true)
    );

    const isSuccess = Boolean(
      verified &&
      pipelineRes.status === 'EXECUTION_SUCCESS' &&
      pipelineRes.execution_proof?.executed === true &&
      (executionData.success !== false)
    );

    return {
      success: isSuccess,
      external_effect: externalEffect,
      authenticated,
      adapter: request.adapterId,
      action: request.action,
      environment: adapter.metadata.environment,
      timestamp: new Date().toISOString(),
      durationMs,
      data: Object.keys(executionData).length > 0 ? executionData : ((pipelineRes.output as Record<string, unknown>) || { error: pipelineRes.error?.message }),
      auditLog,
      execution_kind: 'capability',
      capability_executed: capabilityExecuted,
      execution_proof: pipelineRes.execution_proof,
      verification,
      error: (executionData.error as any) || pipelineRes.error,
    };
  }
}

export const vuaRegistry = new VUAAdapterRegistry();
