import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '3s', target: 15 }, // Rampa rápida para 15 VUs
    { duration: '10s', target: 40 }, // Sustentação em 40 VUs
    { duration: '3s', target: 0 },  // Desaceleração suave
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // Menos de 1% de falhas
    http_req_duration: ['p(95)<150', 'p(99)<300'], // SLAs estritos de latência
    checks: ['rate>0.99'], // 99%+ de verificações bem-sucedidas
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const nonce = `${Date.now()}-${__VU}-${__ITER}-${Math.random().toString(36).substring(2, 7)}`;
  
  // 1. Execução de pipeline governado com payload dinâmico
  const execPayload = JSON.stringify({
    request_id: `load-k6-${nonce}`,
    operation: 'inspect',
    input: {
      workload: 'load-test',
      vu: __VU,
      iter: __ITER,
      timestamp: Date.now(),
    },
  });

  const execRes = http.post(`${BASE_URL}/api/vortex/execute`, execPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const execOk = check(execRes, {
    'load exec status 200': (r) => r.status === 200,
    'load exec status SUCCESS': (r) => r.json('status') === 'EXECUTION_SUCCESS',
    'load exec proof generated': (r) => !!r.json('execution_proof.signature'),
    'load exec input hash matches': (r) => (r.json('execution_proof.input_hash') || '').startsWith('sha256:'),
  });

  // 2. Auditoria Imediata da Prova no Verifier Independente
  if (execOk && execRes.json('execution_proof')) {
    const proof = execRes.json('execution_proof');
    const verifyPayload = JSON.stringify({ proof });

    const verifyRes = http.post(`${BASE_URL}/api/vortex/verify`, verifyPayload, {
      headers: { 'Content-Type': 'application/json' },
    });

    check(verifyRes, {
      'load verify status 200': (r) => r.status === 200,
      'load verify valid true': (r) => r.json('valid') === true,
      'load verify VERIFIED': (r) => r.json('status') === 'VERIFIED',
    });
  }

  // 3. Checagem de Lista de Adaptadores VUA
  if (__ITER % 5 === 0) {
    const adaptersRes = http.get(`${BASE_URL}/api/vua/adapters`);
    check(adaptersRes, {
      'adapters status 200': (r) => r.status === 200,
      'adapters list count >= 4': (r) => Array.isArray(r.json('adapters')) && r.json('adapters').length >= 4,
    });
  }

  sleep(0.1);
}
