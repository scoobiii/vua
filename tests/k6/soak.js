import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2s', target: 20 },  // Aquecimento
    { duration: '12s', target: 20 }, // Carga constante e sustentada (soak)
    { duration: '2s', target: 0 },   // Resfriamento
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<150'],
    checks: ['rate>0.99'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const nonce = `soak-${Date.now()}-${__VU}-${__ITER}`;

  const res = http.post(
    `${BASE_URL}/api/vortex/execute`,
    JSON.stringify({
      request_id: nonce,
      operation: 'inspect',
      input: { soak_test: true, iteration: __ITER },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'soak status 200': (r) => r.status === 200,
    'soak status SUCCESS': (r) => r.json('status') === 'EXECUTION_SUCCESS',
    'soak proof valid': (r) => (r.json('execution_proof.proof_hash') || '').startsWith('sha256:'),
  });

  sleep(0.08);
}
