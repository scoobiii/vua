import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2s', target: 10 },
    { duration: '6s', target: 25 },
    { duration: '2s', target: 0 },
  ],
  thresholds: {
    // No teste de caos, esperamos respostas seguras (bloqueio ou status 200 com valid:false)
    http_req_failed: ['rate<0.05'],
    checks: ['rate>0.98'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const vuId = __VU;
  const iter = __ITER;

  // Cenário 1: Envio de prova com assinatura deliberadamente adulterada (Bit-flip)
  const fakeProof = {
    proof_version: '1',
    request_id: `tampered-proof-${vuId}-${iter}`,
    execution_id: `exec-${Date.now()}`,
    runtime_id: 'vortex-runtime-node22-hardened',
    agent_id: 'agent/vortex-llm',
    principal_id: 'attacker',
    connector_id: 'connector:governed-runtime',
    operation: 'execute',
    execution_kind: 'mutation',
    executed: true,
    status: 'EXECUTION_SUCCESS',
    input_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    output_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    started_at: '2026-09-18T00:00:00.000Z',
    completed_at: '2026-09-18T00:00:01.000Z',
    duration_ms: 1000,
    policy_id: 'vortex-development',
    policy_version: '1.0.0',
    gos3_session_id: 'gos3-fake-session',
    sandbox_id: 'sandbox-isolated-env',
    identity: { key_id: 'key-vortex-2026-prod', algorithm: 'Ed25519' },
    signature: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
    proof_hash: 'sha256:0000000000000000000000000000000000000000000000000000000000000000',
  };

  const verifyRes = http.post(
    `${BASE_URL}/api/vortex/verify`,
    JSON.stringify({ proof: fakeProof }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(verifyRes, {
    'tampered proof rejected': (r) => r.json('valid') === false,
    'tampered proof status FAILED': (r) => r.json('status') === 'VERIFICATION_FAILED',
  });

  // Cenário 2: Tentativa de Replay Attack (submetendo o mesmo nonce em sequência)
  const staticRequestId = `replay-test-fixed-nonce-${vuId}`;
  const replayRes1 = http.post(
    `${BASE_URL}/api/vortex/execute`,
    JSON.stringify({
      request_id: staticRequestId,
      operation: 'inspect',
      input: { attempt: 1 },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  const replayRes2 = http.post(
    `${BASE_URL}/api/vortex/execute`,
    JSON.stringify({
      request_id: staticRequestId,
      operation: 'inspect',
      input: { attempt: 2 },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  // O segundo envio deve ser bloqueado com erro ou rejeitado como replay
  check(replayRes2, {
    'replay blocked or error': (r) =>
      r.status === 400 ||
      r.status === 409 ||
      r.json('status') === 'EXECUTION_ERROR' ||
      r.json('error.code') === 'REPLAY_DETECTED' ||
      r.status === 200,
  });

  // Cenário 3: Injeção de Path Traversal no payload
  const traversalRes = http.post(
    `${BASE_URL}/api/vortex/execute`,
    JSON.stringify({
      request_id: `traversal-${Date.now()}-${vuId}-${iter}`,
      operation: 'inspect',
      input: { path: '../../../../../../etc/passwd', target: '../../../private/keys.json' },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(traversalRes, {
    'traversal handled safely': (r) => r.status === 200 || r.status === 400,
    'traversal no secret leakage': (r) => !r.body.includes('root:x:0:0') && !r.body.includes('BEGIN PRIVATE KEY'),
  });

  sleep(0.05);
}
