/**
 * VUA — Vortex Universal Connector
 * OAuth 2.1 Authorization Code + PKCE S256 / MCP Resource Protection.
 *
 * Authentication is separate from execution authorization, approval_token and
 * ExecutionProof. Storage is process-local; multi-instance production needs
 * shared durable OAuth state before enabling this across replicas.
 */
import crypto from 'node:crypto';
import type { Express, Request, Response } from 'express';

type Client = { client_id: string; redirect_uris: string[]; client_name?: string };
type Code = { client_id: string; redirect_uri: string; code_challenge: string; scope: string; resource: string; expires_at: number; used: boolean };
type Token = { client_id: string; scope: string; resource: string; expires_at: number };

const clients = new Map<string, Client>();
const codes = new Map<string, Code>();
const tokens = new Map<string, Token>();
const attempts = new Map<string, { count: number; resetAt: number }>();
const CODE_TTL = 5 * 60 * 1000;
const TOKEN_TTL = 3600;
const RATE_WINDOW = 15 * 60 * 1000;
const RATE_MAX = 5;

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const challenge = (value: string) => crypto.createHash('sha256').update(value, 'utf8').digest('base64url');
const equal = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const esc = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');

function base(req: Request, configured?: string): string {
  if (configured) return configured.replace(/\/$/, '');
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwarded === 'https' || req.protocol === 'https' ? 'https' : 'http';
  return `${protocol}://${req.get('host') || 'localhost:3000'}`;
}
function resource(baseUrl: string): string { return `${baseUrl.replace(/\/$/, '')}/mcp`; }
function rateLimit(ip: string): boolean {
  const now = Date.now();
  const current = attempts.get(ip);
  if (!current || current.resetAt <= now) { attempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return true; }
  if (current.count >= RATE_MAX) return false;
  current.count += 1;
  return true;
}
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [k, v] of codes) if (v.expires_at <= now) codes.delete(k);
  for (const [k, v] of tokens) if (v.expires_at <= now) tokens.delete(k);
  for (const [k, v] of attempts) if (v.resetAt <= now) attempts.delete(k);
}, 60_000);
cleanup.unref();

export function mountOAuth(app: Express, options: { publicBaseUrl?: string } = {}): void {
  const configured = options.publicBaseUrl?.replace(/\/$/, '');

  app.get('/.well-known/oauth-protected-resource', (req, res) => {
    const b = base(req, configured);
    res.json({ resource: resource(b), authorization_servers: [b], scopes_supported: ['mcp'], bearer_methods_supported: ['header'] });
  });

  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const b = base(req, configured);
    res.json({
      issuer: b,
      authorization_endpoint: `${b}/oauth/authorize`,
      token_endpoint: `${b}/oauth/token`,
      registration_endpoint: `${b}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['mcp'],
    });
  });

  app.post('/oauth/register', (req, res) => {
    const redirectUris = req.body?.redirect_uris;
    if (!Array.isArray(redirectUris) || redirectUris.length < 1 || redirectUris.length > 20) return res.status(400).json({ error: 'invalid_client_metadata' });
    const valid = redirectUris.every((uri: unknown) => {
      if (typeof uri !== 'string' || uri.length > 2048) return false;
      try { return new URL(uri).protocol === 'https:'; } catch { return false; }
    });
    if (!valid) return res.status(400).json({ error: 'invalid_client_metadata', error_description: 'HTTPS redirect_uris required' });
    const client_id = `vua-client-${randomToken(18)}`;
    const client_name = typeof req.body?.client_name === 'string' ? req.body.client_name.slice(0, 200) : undefined;
    clients.set(client_id, { client_id, redirect_uris: redirectUris, client_name });
    return res.status(201).json({ client_id, client_name: client_name || 'VUA MCP Client', redirect_uris: redirectUris, grant_types: ['authorization_code'], response_types: ['code'], token_endpoint_auth_method: 'none' });
  });

  app.get('/oauth/authorize', (req, res) => {
    const { response_type, client_id, redirect_uri, code_challenge, code_challenge_method } = req.query;
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const scope = typeof req.query.scope === 'string' ? req.query.scope : 'mcp';
    const requestedResource = typeof req.query.resource === 'string' ? req.query.resource : '';
    if (response_type !== 'code' || typeof client_id !== 'string' || typeof redirect_uri !== 'string' || typeof code_challenge !== 'string' || code_challenge_method !== 'S256') return res.status(400).send('Invalid OAuth authorization request');
    const client = clients.get(client_id);
    if (!client || !client.redirect_uris.includes(redirect_uri)) return res.status(400).send('Invalid client or redirect_uri');
    const b = base(req, configured);
    const expectedResource = resource(b);
    if (requestedResource && requestedResource !== expectedResource) return res.status(400).send('Invalid resource');
    const hidden = (name: string, value: string) => `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;
    return res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authorize VUA</title></head><body><main style="font-family:system-ui;max-width:480px;margin:4rem auto;padding:1rem"><h1>Authorize VUA</h1><p>Client <b>${esc(client.client_name || client_id)}</b> requests MCP access.</p><p>Scope: <code>${esc(scope)}</code></p><form method="post" action="/oauth/approve">${hidden('client_id', client_id)}${hidden('redirect_uri', redirect_uri)}${hidden('code_challenge', code_challenge)}${hidden('scope', scope)}${hidden('resource', expectedResource)}${hidden('state', state)}<label>Authorization secret</label><input name="secret" type="password" required style="display:block;width:100%;padding:.8rem"><button type="submit" style="margin-top:1rem;padding:.8rem;width:100%">Authorize</button></form></main></body></html>`);
  });

  app.post('/oauth/approve', (req, res) => {
    if (!rateLimit(req.ip || 'unknown')) return res.status(429).send('Too many authorization attempts');
    const expected = process.env.OAUTH_APPROVE_SECRET;
    if (!expected) return res.status(503).send('OAuth approval is not configured');
    const { client_id, redirect_uri, code_challenge, scope = 'mcp', resource: resourceValue, state, secret } = req.body || {};
    if ([client_id, redirect_uri, code_challenge, resourceValue, secret].some((v) => typeof v !== 'string')) return res.status(400).send('Invalid approval request');
    if (!equal(secret, expected)) return res.status(403).send('Authorization denied');
    const client = clients.get(client_id);
    if (!client || !client.redirect_uris.includes(redirect_uri)) return res.status(400).send('Invalid client');
    const code = randomToken(32);
    codes.set(code, { client_id, redirect_uri, code_challenge, scope: String(scope), resource: resourceValue, expires_at: Date.now() + CODE_TTL, used: false });
    const target = new URL(redirect_uri);
    target.searchParams.set('code', code);
    if (typeof state === 'string' && state) target.searchParams.set('state', state);
    return res.redirect(302, target.toString());
  });

  app.post('/oauth/token', (req, res) => {
    const { grant_type, code, redirect_uri, client_id, code_verifier, resource: requestedResource } = req.body || {};
    if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });
    if ([code, redirect_uri, client_id, code_verifier].some((v) => typeof v !== 'string')) return res.status(400).json({ error: 'invalid_request' });
    const record = codes.get(code);
    if (!record || record.used || record.expires_at <= Date.now()) { codes.delete(code); return res.status(400).json({ error: 'invalid_grant' }); }
    if (record.client_id !== client_id || record.redirect_uri !== redirect_uri || (typeof requestedResource === 'string' && requestedResource !== record.resource)) return res.status(400).json({ error: 'invalid_grant' });
    if (!equal(challenge(code_verifier), record.code_challenge)) return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    record.used = true;
    codes.delete(code);
    const access_token = randomToken(32);
    tokens.set(access_token, { client_id, scope: record.scope, resource: record.resource, expires_at: Date.now() + TOKEN_TTL * 1000 });
    return res.json({ access_token, token_type: 'Bearer', expires_in: TOKEN_TTL, scope: record.scope });
  });
}

export function validateAccessToken(token: string, expectedResource: string): { client_id: string; scope: string } | null {
  const record = tokens.get(token);
  if (!record || record.expires_at <= Date.now() || record.resource !== expectedResource) { tokens.delete(token); return null; }
  return { client_id: record.client_id, scope: record.scope };
}

export function oauthRequired(): boolean { return process.env.VUA_OAUTH_REQUIRED === 'true'; }

export function requireBearer(expectedResource: (req: Request) => string) {
  return (req: Request, res: Response, next: () => void): void => {
    if (!oauthRequired()) return next();
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) {
      const b = base(req);
      const metadata = `${b}/.well-known/oauth-protected-resource`;
      res.setHeader('WWW-Authenticate', `Bearer realm="vua", resource_metadata="${metadata}"`);
      res.status(401).json({ error: 'unauthorized', error_description: 'Bearer token required' });
      return;
    }
    const token = header.slice(7).trim();
    if (!validateAccessToken(token, expectedResource(req))) { res.status(401).json({ error: 'invalid_token' }); return; }
    next();
  };
}
