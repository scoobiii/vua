/**
 * VUA - Vortex Universal Connector
 * Normative Adapter Types.
 */

import type { ExecutionProof, ExternalEffect, VerificationResult } from '../types.js';

export type VUAAdapterId = 'github' | 'linux' | 'android' | 'windows' | 'bluesky' | 'canary' | 'gcloud' | 'bend' | 'web-scraper';
export type VUAAdapterStatus = 'online' | 'ready' | 'simulated' | 'degraded';
export type VUAActionRisk = 'read' | 'write' | 'destructive';
export interface VUAActionMetadata { action: string; description: string; risk?: VUAActionRisk; requiresApproval?: boolean; defaultParams?: Record<string, unknown>; }
export interface VUAAdapterMetadata {
  id: VUAAdapterId;
  name: string;
  environment: 'Cloud VCS' | 'POSIX Linux' | 'AOSP Android' | 'Android AOSP' | 'Win32/NT Windows' | 'Windows NT' | 'AT Protocol / Bluesky' | 'GCP Cloud Run / Cloud APIs' | 'test' | 'POSIX Linux / Bend HVM';
  version: string;
  status: VUAAdapterStatus;
  description: string;
  capabilities: string[];
  supportedActions: VUAActionMetadata[];
  actions?: Record<string, VUAActionMetadata>;
  systemMetrics?: Record<string, string | number>;
}
export interface VUAActionRequest { adapterId: VUAAdapterId; action: string; target?: Record<string, unknown>; payload?: Record<string, unknown>; approvalToken?: string; requestId?: string; authorization?: { principal_id: string; agent_id: string; policy_id: string; policy_version: string; capability: string; scope?: { paths?: string[]; repositories?: string[]; resources?: string[]; }; }; }
export interface VUAActionResult { success: boolean; external_effect: ExternalEffect; authenticated: boolean; adapter: VUAAdapterId; action: string; environment: string; timestamp: string; durationMs: number; data: Record<string, unknown>; auditLog: string[]; execution_kind: 'capability'; capability_executed: boolean; execution_proof?: ExecutionProof; verification?: VerificationResult; error?: string | { code: string; message: string }; }
export interface IVUAAdapter { metadata: VUAAdapterMetadata; executeAction(action: string, target?: Record<string, unknown>, payload?: Record<string, unknown>): Promise<{ data: Record<string, unknown>; auditLog: string[] }>; probeStatus(): Promise<{ status: VUAAdapterStatus; metrics?: Record<string, string | number> }>; }
