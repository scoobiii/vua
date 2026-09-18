import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2s', target: 5 },   // Carga basal leve
    { duration: '3s', target: 120 }, // Salto explosivo instantâneo
    { duration: '6s', target: 120 }, // Sustenta o spike
    { duration: '3s', target: 5 },   // Retorno rápido ao basal
    { duration: '2s', target: 0 },   // Término
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'], // Tolerância a pico máximo de 5%
    http_req_duration: ['p(95)<350'],
    checks: ['rate>0.95'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const nonce = `spike-${Date.now()}-${__VU}-${__ITER}-${Math.random().toString(36).substring(2, 6)}`;

  const res = http.post(
    `${BASE_URL}/api/vortex/execute`,
    JSON.stringify({
      request_id: nonce,
      operation: 'inspect',
      input: { spike: true, vu: __VU },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'spike status 200': (r) => r.status === 200,
    'spike execution ok': (r) => r.json('status') === 'EXECUTION_SUCCESS',
  });

  sleep(0.05);
}
