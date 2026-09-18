import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '5s',
  thresholds: {
    http_req_failed: ['rate<0.01'], // Menos de 1% de erros HTTP
    http_req_duration: ['p(95)<100'], // 95% das requisições em menos de 100ms
    checks: ['rate>0.99'], // 99%+ de verificações bem-sucedidas
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // 1. Health Check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health service name': (r) => r.json('service') === 'vortex-mcp-foundation-server',
    'health thesis matches': (r) => typeof r.json('thesis') === 'string',
  });

  // 2. Vortex Status & Identity Check
  const statusRes = http.get(`${BASE_URL}/api/vortex/status`);
  check(statusRes, {
    'status 200': (r) => r.status === 200,
    'status online': (r) => r.json('status') === 'ONLINE',
    'identity present': (r) => !!r.json('identity.agent_id'),
    'key algorithm Ed25519': (r) => r.json('identity.algorithm') === 'Ed25519',
  });

  // 3. Hardware Baseline Diagnostic Check
  const baselineRes = http.get(`${BASE_URL}/api/vua/baseline/hardware`);
  check(baselineRes, {
    'baseline status 200': (r) => r.status === 200,
    'baseline success': (r) => r.json('success') === true,
    'fingerprint present': (r) => !!r.json('certificate.fingerprint.archetype'),
  });

  // 4. Governed Execution Pipeline (inspect)
  const requestId = `smoke-k6-${Date.now()}-${__VU}-${__ITER}`;
  const execPayload = JSON.stringify({
    request_id: requestId,
    operation: 'inspect',
    input: { smoke_test: true, iteration: __ITER },
  });

  const execRes = http.post(`${BASE_URL}/api/vortex/execute`, execPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const execPassed = check(execRes, {
    'exec status 200': (r) => r.status === 200,
    'exec pipeline success': (r) => r.json('status') === 'EXECUTION_SUCCESS',
    'exec has proof': (r) => !!r.json('execution_proof'),
    'exec proof has signature': (r) => !!r.json('execution_proof.signature'),
    'exec proof has proof_hash': (r) => (r.json('execution_proof.proof_hash') || '').startsWith('sha256:'),
  });

  // 5. Independent Verification of Proof
  if (execPassed && execRes.json('execution_proof')) {
    const proof = execRes.json('execution_proof');
    const verifyPayload = JSON.stringify({ proof });

    const verifyRes = http.post(`${BASE_URL}/api/vortex/verify`, verifyPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(verifyRes, {
      'verify status 200': (r) => r.status === 200,
      'verify proof is valid': (r) => r.json('valid') === true,
      'verify status is VERIFIED': (r) => r.json('status') === 'VERIFIED',
      'verify signature check passed': (r) => r.json('checks.signature.passed') === true,
    });
  }

  sleep(0.5);
}
