/**
 * Vortex MCP Specification - Cryptographic Engine
 * Ed25519 Key Discovery, SHA-256 Hashes & RFC 8785 Canonical Signing
 */

import crypto from 'node:crypto';
import { canonicalize } from './canonicalize.js';
import type { CryptographicIdentity } from './types.js';

/**
 * Deterministic SHA-256
 */
export function sha256(input: unknown): string {
  const content = typeof input === 'string' ? input : canonicalize(input);
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return `sha256:${hash}`;
}

export interface KeyRecord {
  key_id: string;
  principal_id: string;
  agent_id: string;
  algorithm: 'Ed25519';
  public_key: string;
  private_key?: string;
  created_at: string;
}

// Memory key registry for discovery (supports well-known, registry, policy-bound)
export const KEY_REGISTRY = new Map<string, KeyRecord>();

/**
 * Generate a standard Ed25519 Vortex identity (deterministic if customKeyId is provided)
 */
export function generateVortexIdentity(
  principal_id = 'scoobiii',
  agent_id = 'agent/llm-vortex',
  customKeyId?: string
): CryptographicIdentity {
  const key_id = customKeyId || `vortex-key-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  let pubPem: string;
  let privPem: string;

  if (customKeyId) {
    // Deterministic RFC 8032 / PKCS#8 Ed25519 derivation for stable production keys
    const seed = crypto.createHash('sha256').update(`vortex-foundation-seed:${key_id}`).digest();
    const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    const privDer = Buffer.concat([pkcs8Prefix, seed]);
    const privateKey = crypto.createPrivateKey({ key: privDer, format: 'der', type: 'pkcs8' });
    const publicKey = crypto.createPublicKey(privateKey);
    pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  } else {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    pubPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    privPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  }

  const identity: CryptographicIdentity = {
    principal_id,
    agent_id,
    key_id,
    algorithm: 'Ed25519',
    public_key: pubPem,
    private_key: privPem,
  };

  KEY_REGISTRY.set(key_id, {
    ...identity,
    created_at: new Date().toISOString(),
  });

  return identity;
}

// Bounded KeyObject cache (max 64 entries) to avoid repeated ASN.1/DER parsing in Ed25519 hot path
const KEY_CACHE_LIMIT = 64;

const privateKeyCache = new Map<string, crypto.KeyObject>();
const publicKeyCache = new Map<string, crypto.KeyObject>();

function getPrivateKey(privateKeyPem: string): crypto.KeyObject {
  const cached = privateKeyCache.get(privateKeyPem);
  if (cached) return cached;

  const key = crypto.createPrivateKey(privateKeyPem);

  if (privateKeyCache.size >= KEY_CACHE_LIMIT) {
    const oldest = privateKeyCache.keys().next().value;
    if (oldest !== undefined) privateKeyCache.delete(oldest);
  }

  privateKeyCache.set(privateKeyPem, key);
  return key;
}

function getPublicKey(publicKeyPem: string): crypto.KeyObject {
  const cached = publicKeyCache.get(publicKeyPem);
  if (cached) return cached;

  const key = crypto.createPublicKey(publicKeyPem);

  if (publicKeyCache.size >= KEY_CACHE_LIMIT) {
    const oldest = publicKeyCache.keys().next().value;
    if (oldest !== undefined) publicKeyCache.delete(oldest);
  }

  publicKeyCache.set(publicKeyPem, key);
  return key;
}

export function keyCacheStats(): { private: number; public: number; max: number } {
  return { private: privateKeyCache.size, public: publicKeyCache.size, max: KEY_CACHE_LIMIT };
}

/**
 * Sign already-canonicalized JCS string with Ed25519 private key (zero redundant serialization)
 */
export function signCanonicalString(canonicalString: string, privateKeyPem: string): string {
  const privateKey = getPrivateKey(privateKeyPem);
  const signatureBuffer = crypto.sign(null, Buffer.from(canonicalString, 'utf8'), privateKey);
  return signatureBuffer.toString('base64');
}

/**
 * Sign JCS canonicalized payload with Ed25519 private key
 */
export function signProofPayload(payloadWithoutSignature: Record<string, unknown>, privateKeyPem: string): string {
  const canonicalString = canonicalize(payloadWithoutSignature);
  return signCanonicalString(canonicalString, privateKeyPem);
}

/**
 * Verify Ed25519 signature over already-canonicalized JCS string
 */
export function verifyCanonicalSignature(
  canonicalString: string,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  try {
    const publicKey = getPublicKey(publicKeyPem);
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    return crypto.verify(null, Buffer.from(canonicalString, 'utf8'), publicKey, signatureBuffer);
  } catch {
    return false;
  }
}

/**
 * Verify Ed25519 signature over JCS canonicalized payload
 */
export function verifyProofSignature(
  payloadWithoutSignature: Record<string, unknown>,
  signatureBase64: string,
  publicKeyPem: string
): boolean {
  const canonicalString = canonicalize(payloadWithoutSignature);
  return verifyCanonicalSignature(canonicalString, signatureBase64, publicKeyPem);
}

/**
 * Lookup public key via Key Discovery:
 * 1. Embedded
 * 2. Registry
 * 3. Well-known
 */
export function resolvePublicKey(keyId: string, embeddedPublicKey?: string): string | null {
  if (embeddedPublicKey && embeddedPublicKey.includes('PUBLIC KEY')) {
    return embeddedPublicKey;
  }
  const found = KEY_REGISTRY.get(keyId);
  if (found) {
    return found.public_key;
  }
  return null;
}
