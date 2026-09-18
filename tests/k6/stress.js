import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '3s', target: 20 },
    { duration: '5s', target: 60 },
    { duration: '8s', target: 100 },
    { duration: '2s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.02'], // Menos de 2% de erros
    http_req_duration: ['p(95)<250', 'p(99)<500'],
    checks: ['rate>0.98'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const nonce = `stress-${Date.now()}-${__VU}-${__ITER}-${Math.random().toString(36).substring(2, 6)}`;

  const payload = JSON.stringify({
    request_id: nonce,
    operation: 'inspect',
    input: {
      stress_test: true,
      vu: __VU,
      iter: __ITER,
      batch_token: `${__VU}:${__ITER}`,
    },
  });

  const res = http.post(`${BASE_URL}/api/vortex/execute`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'stress exec status 200': (r) => r.status === 200,
    'stress exec status SUCCESS': (r) => r.json('status') === 'EXECUTION_SUCCESS',
    'stress has proof': (r) => !!r.json('execution_proof'),
    'stress duration < 50ms': (r) => (r.json('execution_proof.duration_ms') || 0) < 50,
  });

  sleep(0.05);
}
