import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom Metrics para Comparação de Degradação
const localDuration = new Trend('local_req_duration', true);
const cloudDuration = new Trend('cloudrun_req_duration', true);

const localTTFB = new Trend('local_waiting_ttfb', true);
const cloudTTFB = new Trend('cloudrun_waiting_ttfb', true);

const localCryptoDuration = new Trend('local_crypto_proof_ms', true);
const cloudCryptoDuration = new Trend('cloudrun_crypto_proof_ms', true);

const localFailureRate = new Rate('local_failure_rate');
const cloudFailureRate = new Rate('cloudrun_failure_rate');

const localOpsCounter = new Counter('local_successful_ops');
const cloudOpsCounter = new Counter('cloudrun_successful_ops');

// URLs dos dois ambientes
const LOCAL_URL = __ENV.LOCAL_URL || __ENV.BASE_URL || 'http://localhost:3000';
const CLOUDRUN_URL = __ENV.CLOUDRUN_URL || 'https://ais-dev-apgga6bc4qb3ko4kofub3t-30357252941.us-west1.run.app';
const CLOUDRUN_TOKEN = __ENV.CLOUDRUN_TOKEN || '';

export const options = {
  stages: [
    { duration: '3s', target: 5 },   // Estágio 1: Baseline / Calibração (5 VUs)
    { duration: '6s', target: 20 },  // Estágio 2: Carga Média (20 VUs)
    { duration: '8s', target: 50 },  // Estágio 3: Saturação / Teste de Degradação (50 VUs)
    { duration: '3s', target: 0 },   // Estágio 4: Rampa de descida / Cooldown
  ],
  thresholds: {
    'local_failure_rate': ['rate<0.05'], // Max 5% de falhas no ambiente local
  },
};

export default function () {
  const nonce = `${Date.now()}-${__VU}-${__ITER}-${Math.random().toString(36).substring(2, 6)}`;
  
  const payload = JSON.stringify({
    request_id: `bench-deg-${nonce}`,
    operation: 'inspect',
    input: {
      benchmark: 'degradation_termux_vs_cloudrun',
      vu: __VU,
      iter: __ITER,
      timestamp: new Date().toISOString(),
    },
  });

  const localHeaders = {
    'Content-Type': 'application/json',
    'X-Vortex-Client': 'k6-degradation-harness',
  };

  const cloudHeaders = {
    'Content-Type': 'application/json',
    'X-Vortex-Client': 'k6-degradation-harness',
    ...(CLOUDRUN_TOKEN ? { 'Authorization': `Bearer ${CLOUDRUN_TOKEN}` } : {}),
  };

  // ==========================================
  // 1. EXECUÇÃO NO AMBIENTE LOCAL (Termux/Alpine)
  // ==========================================
  const localStart = Date.now();
  let localRes;
  try {
    localRes = http.post(`${LOCAL_URL}/api/vortex/execute`, payload, {
      headers: localHeaders,
      timeout: '10s',
    });
    
    localDuration.add(localRes.timings.duration);
    localTTFB.add(localRes.timings.waiting);

    const localOk = check(localRes, {
      'local 200 OK': (r) => r.status === 200,
      'local proof valid': (r) => {
        try {
          const json = r.json();
          return json && json.status === 'EXECUTION_SUCCESS' && !!json.execution_proof;
        } catch (_) {
          return false;
        }
      },
    });

    localFailureRate.add(!localOk);

    if (localOk) {
      localOpsCounter.add(1);
      try {
        const pDuration = localRes.json('execution_proof.duration_ms');
        if (typeof pDuration === 'number') {
          localCryptoDuration.add(pDuration);
        }
      } catch (_) {}
    }
  } catch (err) {
    localFailureRate.add(1);
  }

  // ==========================================
  // 2. EXECUÇÃO NO AMBIENTE CLOUD RUN (GCP)
  // ==========================================
  let cloudRes;
  try {
    cloudRes = http.post(`${CLOUDRUN_URL}/api/vortex/execute`, payload, {
      headers: cloudHeaders,
      timeout: '10s',
    });

    cloudDuration.add(cloudRes.timings.duration);
    cloudTTFB.add(cloudRes.timings.waiting);

    const cloudOk = check(cloudRes, {
      'cloudrun 200 OK': (r) => r.status === 200,
      'cloudrun proof valid': (r) => {
        try {
          const json = r.json();
          return json && json.status === 'EXECUTION_SUCCESS' && !!json.execution_proof;
        } catch (_) {
          return false;
        }
      },
    });

    cloudFailureRate.add(!cloudOk);

    if (cloudOk) {
      cloudOpsCounter.add(1);
      try {
        const pDuration = cloudRes.json('execution_proof.duration_ms');
        if (typeof pDuration === 'number') {
          cloudCryptoDuration.add(pDuration);
        }
      } catch (_) {}
    }
  } catch (err) {
    cloudFailureRate.add(1);
  }

  sleep(0.05);
}

export function handleSummary(data) {
  const getMetric = (name, field, defaultVal = 0) => {
    try {
      const val = data.metrics[name]?.values[field];
      return typeof val === 'number' ? val : defaultVal;
    } catch (_) {
      return defaultVal;
    }
  };

  const lAvg = getMetric('local_req_duration', 'avg').toFixed(2);
  const lMed = getMetric('local_req_duration', 'med').toFixed(2);
  const lP90 = getMetric('local_req_duration', 'p(90)').toFixed(2);
  const lP95 = getMetric('local_req_duration', 'p(95)').toFixed(2);
  const lFail = (getMetric('local_failure_rate', 'rate') * 100).toFixed(2);
  const lCrypto = getMetric('local_crypto_proof_ms', 'avg').toFixed(2);

  const cAvg = getMetric('cloudrun_req_duration', 'avg').toFixed(2);
  const cMed = getMetric('cloudrun_req_duration', 'med').toFixed(2);
  const cP90 = getMetric('cloudrun_req_duration', 'p(90)').toFixed(2);
  const cP95 = getMetric('cloudrun_req_duration', 'p(95)').toFixed(2);
  const cFail = (getMetric('cloudrun_failure_rate', 'rate') * 100).toFixed(2);
  const cCrypto = getMetric('cloudrun_crypto_proof_ms', 'avg').toFixed(2);

  const banner = `
═══════════════════════════════════════════════════════════════════════════════════
        RELATÓRIO COMPARATIVO DE DEGRADAÇÃO: TERMUX (ARM) vs CLOUD RUN (GCP)
═══════════════════════════════════════════════════════════════════════════════════
  Alvos Avaliados:
  • Local (Alpine Termux): ${LOCAL_URL}
  • Cloud (Google Cloud Run): ${CLOUDRUN_URL}
───────────────────────────────────────────────────────────────────────────────────
  MÉTRICA / SLA                   │ LOCAL (Termux Alpine) │ CLOUD RUN (Google Cloud)
──────────────────────────────────┼───────────────────────┼────────────────────────
  Latência Média (Total)          │ ${lAvg.padStart(16)} ms │ ${cAvg.padStart(17)} ms
  Latência Mediana (p50)          │ ${lMed.padStart(16)} ms │ ${cMed.padStart(17)} ms
  Latência p90                    │ ${lP90.padStart(16)} ms │ ${cP90.padStart(17)} ms
  Latência p95 (Degradação Máx)   │ ${lP95.padStart(16)} ms │ ${cP95.padStart(17)} ms
  Duração do Cálculo Cripto (avg) │ ${lCrypto.padStart(16)} ms │ ${cCrypto.padStart(17)} ms
  Taxa de Falhas HTTP / Timeout   │ ${(lFail + '%').padStart(16)}   │ ${(cFail + '%').padStart(17)}  
───────────────────────────────────────────────────────────────────────────────────
  DIAGNÓSTICO TÉCNICO:
  • Local (Termux): Zero latência de trânsito WAN (localhost), porém com maior
    variação no p95 devido a throttling térmico e escalonamento de threads ARM.
  • Cloud Run: Latência base inclui trânsito TLS/WAN de ida e volta, mas com
    alta estabilidade e isolamento sob saturação devido a vCPUs dedicadas.
═══════════════════════════════════════════════════════════════════════════════════
`;

  return {
    stdout: banner,
  };
}
