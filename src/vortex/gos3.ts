/**
 * Vortex MCP Specification - GOS3 Layer
 * Resource Onboarding & Session Lifecycle Governance
 * 
 * "An agent does not modify a resource simply because it can access it.
 *  Before modification: Resource -> GOS3 Onboard -> Authorized Session -> Modification"
 */

import { sha256 } from './crypto.js';
import type { GOS3HeaderContract, GOS3Session } from './types.js';

// In-memory GOS3 active sessions store
const ACTIVE_SESSIONS = new Map<string, GOS3Session>();

// Onboarded resources contracts store
const RESOURCE_CONTRACTS = new Map<string, GOS3HeaderContract>();

/**
 * Onboard a resource creating a formal GOS3 entry contract
 */
export function onboardResource(
  resourcePath: string,
  initialContent = '',
  requiredCapability = 'repository.write'
): GOS3HeaderContract {
  const checksum = sha256(initialContent);
  const contract: GOS3HeaderContract = {
    contract_version: '1.0.0',
    resource_path: resourcePath,
    checksum,
    onboarded_at: new Date().toISOString(),
    required_capability: requiredCapability,
  };

  RESOURCE_CONTRACTS.set(resourcePath, contract);
  return contract;
}

/**
 * Create an authorized GOS3 session for an onboarded resource
 */
export function createGOS3Session(
  principal_id: string,
  agent_id: string,
  resourcePath: string,
  durationSeconds = 300 // 5 minutes standard
): GOS3Session {
  let contract = RESOURCE_CONTRACTS.get(resourcePath);
  if (!contract) {
    // Auto-onboard default contract if not previously set
    contract = onboardResource(resourcePath, '', 'repository.write');
  }

  const now = Date.now();
  const session_id = `gos3-sess-${now}-${Math.random().toString(36).substring(2, 9)}`;

  const session: GOS3Session = {
    session_id,
    principal_id,
    agent_id,
    resource: resourcePath,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + durationSeconds * 1000).toISOString(),
    status: 'ACTIVE',
    header_contract: contract,
  };

  ACTIVE_SESSIONS.set(session_id, session);
  return session;
}

/**
 * Validate GOS3 session for mutable operations
 */
export function validateGOS3Session(sessionId: string, targetResource?: string): {
  valid: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'NOT_FOUND' | 'RESOURCE_MISMATCH';
  session?: GOS3Session;
  error?: string;
} {
  const session = ACTIVE_SESSIONS.get(sessionId);
  if (!session) {
    return { valid: false, status: 'NOT_FOUND', error: 'GOS3 session not found' };
  }

  if (session.status !== 'ACTIVE') {
    return { valid: false, status: session.status, error: `GOS3 session is ${session.status}` };
  }

  const now = Date.now();
  const expiry = new Date(session.expires_at).getTime();
  if (now > expiry) {
    session.status = 'EXPIRED';
    return { valid: false, status: 'EXPIRED', error: 'GOS3 session has expired' };
  }

  if (targetResource && session.resource !== targetResource) {
    return {
      valid: false,
      status: 'RESOURCE_MISMATCH',
      error: `GOS3 session authorized for ${session.resource}, attempted ${targetResource}`,
    };
  }

  return { valid: true, status: 'ACTIVE', session };
}

/**
 * Revoke or expire session explicitly
 */
export function revokeGOS3Session(sessionId: string): boolean {
  const session = ACTIVE_SESSIONS.get(sessionId);
  if (session) {
    session.status = 'REVOKED';
    return true;
  }
  return false;
}

export function listActiveSessions(): GOS3Session[] {
  return Array.from(ACTIVE_SESSIONS.values());
}

/**
 * Gets an existing active GOS3 session for principal+agent+resource, or creates a new one
 */
export function getOrCreateGOS3Session(
  principal_id = 'scoobiii',
  agent_id = 'agent/vortex',
  resourcePath = 'vua://default-governed-resource',
  durationSeconds = 600
): GOS3Session {
  const now = Date.now();
  for (const session of ACTIVE_SESSIONS.values()) {
    if (
      session.principal_id === principal_id &&
      session.agent_id === agent_id &&
      session.status === 'ACTIVE' &&
      new Date(session.expires_at).getTime() > now &&
      (!resourcePath || session.resource === resourcePath || resourcePath.startsWith(session.resource))
    ) {
      return session;
    }
  }

  return createGOS3Session(principal_id, agent_id, resourcePath, durationSeconds);
}
