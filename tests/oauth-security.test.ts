import express from 'express';
import assert from 'node:assert/strict';
import { mountOAuth, requireBearer } from '../src/vortex/oauth.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
mountOAuth(app, { publicBaseUrl: 'https://vua.example.test' });
app.post('/protected', requireBearer(() => 'https://vua.example.test/mcp'), (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(0, '127.0.0.1');
try {
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;

  const metadata = await fetch(`${base}/.well-known/oauth-protected-resource`);
  assert.equal(metadata.status, 200);
  const metadataBody = await metadata.json() as { resource: string; scopes_supported: string[] };
  assert.equal(metadataBody.resource, 'https://vua.example.test/mcp');
  assert.deepEqual(metadataBody.scopes_supported, ['mcp']);

  const unauthenticated = await fetch(`${base}/protected`, { method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  assert.match(unauthenticated.headers.get('www-authenticate') || '', /Bearer/);

  const unsupportedScope = await fetch(`${base}/oauth/authorize?response_type=code&client_id=missing&redirect_uri=https%3A%2F%2Fclient.example%2Fcallback&code_challenge=abc&code_challenge_method=S256&scope=admin`);
  assert.equal(unsupportedScope.status, 400);

  console.log('OAuth security regression tests passed.');
} finally {
  server.close();
}
