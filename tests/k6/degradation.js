import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ============================================================================
// MÉTRICAS DISCRETAS POR TARGET (ISOLADAS ENTRE SUCESSO vs ERRO)
// ============================================================================

// 1. Latência E2E Útil (SOMENTE para requisições que retornaram HTTP 2xx)
const localUsefulDuration = new Trend('local_useful_duration_ms', true);
const cloudUsefulDuration = new Trend('cloud_useful_duration_ms', true);

// 2. Latência Bruta (todas as requisições, incluindo 3xx, 4xx, 5xx)
const localRawDuration = new Trend('local_raw_duration_ms', true);
const cloudRawDuration = new Trend('cloud_raw_duration_ms', true);

// 3. TTFB (Time To First Byte / Waiting)
const localTTFB = new Trend('local_waiting_ttfb_ms', true);
const cloudTTFB = new Trend('cloud_waiting_ttfb_ms', true);

// 4. Tempo de Computação Criptográfica (extraído do body execution_proof SOMENTE em 2xx)
const localCryptoDuration = new Trend('local_crypto_proof_ms', true);
const cloudCryptoDuration = new Trend('cloud_crypto_proof_ms', true);

// 5. Taxa de Falhas e Contadores
const localFailureRate = new Rate('local_failure_rate');
const cloudFailureRate = new Rate('cloud_failure_rate');

const localUsefulOps = new Counter('local_successful_2xx_ops');
const cloudUsefulOps = new Counter('cloud_successful_2xx_ops');

const localErrorOps = new Counter('local_failed_ops');
const cloudErrorOps = new Counter('cloud_failed_ops');

// Variáveis de ambiente e alvos
const LOCAL_URL = __ENV.LOCAL_URL || __ENV.BASE_URL || 'http://localhost:3000';
const CLOUDRUN_URL = __ENV.CLOUDRUN_URL || 'https://ais-dev-apgga6bc4qb3ko4kofub3t-30357252941.us-west1.run.app';
const CLOUDRUN_COOKIE = __ENV.CLOUDRUN_COOKIE || '';
const CLOUDRUN_TOKEN = __ENV.CLOUDRUN_TOKEN || '';

export const options = {
  stages: [
    { duration: '3s', target: 5 },   // Estágio 1: Calibração / Baseline
    { duration: '6s', target: 20 },  // Estágio 2: Carga Média
    { duration: '8s', target: 40 },  // Estágio 3: Saturação / Degradação
    { duration: '3s', target: 0 },   // Estágio 4: Cooldown
  ],
  thresholds: {
    // Falha o teste se o nó local tiver falha > 5%
    'local_failure_rate': ['rate<0.05'],
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

  // Headers do Local
  const localHeaders = {
    'Content-Type': 'application/json',
    'X-Vortex-Client': 'k6-degradation-harness',
  };

  // Headers da Cloud (inclui suporte a cookie IAP/Auth e token Bearer)
  const cloudHeaders = {
    'Content-Type': 'application/json',
    'X-Vortex-Client': 'k6-degradation-harness',
  };
  if (CLOUDRUN_TOKEN) {
    cloudHeaders['Authorization'] = `Bearer ${CLOUDRUN_TOKEN}`;
  }
  if (CLOUDRUN_COOKIE) {
    cloudHeaders['Cookie'] = CLOUDRUN_COOKIE;
  }

  // --------------------------------------------------------------------------
  // TARGET 1: LOCAL (Termux Alpine ARM64)
  // --------------------------------------------------------------------------
  try {
    const resLocal = http.post(`${LOCAL_URL}/api/vortex/execute`, payload, {
      headers: localHeaders,
      timeout: '10s',
      tags: { target: 'local' },
    });

    localRawDuration.add(resLocal.timings.duration);
    localTTFB.add(resLocal.timings.waiting);

    const is2xx = resLocal.status >= 200 && resLocal.status < 300;
    let hasValidProof = false;
    let proofDuration = null;

    if (is2xx) {
      try {
        const body = resLocal.json();
        if (body && body.status === 'EXECUTION_SUCCESS' && body.execution_proof) {
          hasValidProof = true;
          if (typeof body.execution_proof.duration_ms === 'number') {
            proofDuration = body.execution_proof.duration_ms;
          }
        }
      } catch (_) {}
    }

    const localPassed = check(resLocal, {
      'local HTTP 2xx': () => is2xx,
      'local proof valid': () => hasValidProof,
    });

    if (localPassed) {
      localFailureRate.add(0);
      localUsefulOps.add(1);
      localUsefulDuration.add(resLocal.timings.duration);
      if (proofDuration !== null) {
        localCryptoDuration.add(proofDuration);
      }
    } else {
      localFailureRate.add(1);
      localErrorOps.add(1);
    }
  } catch (err) {
    localFailureRate.add(1);
    localErrorOps.add(1);
  }

  // --------------------------------------------------------------------------
  // TARGET 2: CLOUD RUN (Google Cloud Platform)
  // --------------------------------------------------------------------------
  try {
    const resCloud = http.post(`${CLOUDRUN_URL}/api/vortex/execute`, payload, {
      headers: cloudHeaders,
      timeout: '10s',
      tags: { target: 'cloud' },
      redirects: 0, // Não seguir cegamente redirect 302 de login para não camuflar métrica
    });

    cloudRawDuration.add(resCloud.timings.duration);
    cloudTTFB.add(resCloud.timings.waiting);

    const is2xx = resCloud.status >= 200 && resCloud.status < 300;
    let hasValidProof = false;
    let proofDuration = null;

    if (is2xx) {
      try {
        const body = resCloud.json();
        if (body && body.status === 'EXECUTION_SUCCESS' && body.execution_proof) {
          hasValidProof = true;
          if (typeof body.execution_proof.duration_ms === 'number') {
            proofDuration = body.execution_proof.duration_ms;
          }
        }
      } catch (_) {}
    }

    const cloudPassed = check(resCloud, {
      'cloud HTTP 2xx': () => is2xx,
      'cloud proof valid': () => hasValidProof,
    });

    if (cloudPassed) {
      cloudFailureRate.add(0);
      cloudUsefulOps.add(1);
      cloudUsefulDuration.add(resCloud.timings.duration);
      if (proofDuration !== null) {
        cloudCryptoDuration.add(proofDuration);
      }
    } else {
      cloudFailureRate.add(1);
      cloudErrorOps.add(1);
    }
  } catch (err) {
    cloudFailureRate.add(1);
    cloudErrorOps.add(1);
  }

  sleep(0.05);
}

// ============================================================================
// GERAÇÃO DE RELATÓRIO 100% DINÂMICO BASEADO EM EVIDÊNCIA
// ============================================================================
export function handleSummary(data) {
  const getMetric = (name, field, defaultVal = 0) => {
    try {
      const metric = data.metrics[name];
      if (!metric) return defaultVal;
      // Em k6, metric.values[field] pode estar em metric.values ou direto em metric
      const val = metric.values ? metric.values[field] : metric[field];
      return typeof val === 'number' ? val : defaultVal;
    } catch (_) {
      return defaultVal;
    }
  };

  // Extração Local
  const lRawAvg = getMetric('local_raw_duration_ms', 'avg').toFixed(2);
  const lRawP95 = getMetric('local_raw_duration_ms', 'p(95)').toFixed(2);
  const lUsefulCount = getMetric('local_successful_2xx_ops', 'count', 0);
  const lErrorCount = getMetric('local_failed_ops', 'count', 0);
  const lFailPct = (getMetric('local_failure_rate', 'rate') * 100).toFixed(1);
  const lUsefulAvg = lUsefulCount > 0 ? getMetric('local_useful_duration_ms', 'avg').toFixed(2) + ' ms' : 'N/A (0 ok)';
  const lUsefulP95 = lUsefulCount > 0 ? getMetric('local_useful_duration_ms', 'p(95)').toFixed(2) + ' ms' : 'N/A (0 ok)';
  const lCrypto = lUsefulCount > 0 && typeof getMetric('local_crypto_proof_ms', 'avg', null) === 'number'
    ? getMetric('local_crypto_proof_ms', 'avg').toFixed(2) + ' ms'
    : 'N/A';

  // Extração Cloud
  const cRawAvg = getMetric('cloud_raw_duration_ms', 'avg').toFixed(2);
  const cRawP95 = getMetric('cloud_raw_duration_ms', 'p(95)').toFixed(2);
  const cUsefulCount = getMetric('cloud_successful_2xx_ops', 'count', 0);
  const cErrorCount = getMetric('cloud_failed_ops', 'count', 0);
  const cFailPct = (getMetric('cloud_failure_rate', 'rate') * 100).toFixed(1);
  const cUsefulAvg = cUsefulCount > 0 ? getMetric('cloud_useful_duration_ms', 'avg').toFixed(2) + ' ms' : 'N/A (0 ok)';
  const cUsefulP95 = cUsefulCount > 0 ? getMetric('cloud_useful_duration_ms', 'p(95)').toFixed(2) + ' ms' : 'N/A (0 ok)';
  const cCrypto = cUsefulCount > 0 && typeof getMetric('cloud_crypto_proof_ms', 'avg', null) === 'number'
    ? getMetric('cloud_crypto_proof_ms', 'avg').toFixed(2) + ' ms'
    : 'N/A (não medido)';

  // Diagnóstico Dinâmico baseado exclusivamente em dados
  const dynamicObservations = [];

  // Avaliação do Local
  if (parseFloat(lFailPct) === 0) {
    dynamicObservations.push(`[LOCAL] 100% de sucesso HTTP (0 erros em ${lUsefulCount} ops). Latência de computação pura mensurada com p95=${lUsefulP95}.`);
  } else {
    dynamicObservations.push(`[LOCAL] Apresentou taxa de falhas de ${lFailPct}% (${lErrorCount} erros).`);
  }

  // Avaliação da Cloud
  if (parseFloat(cFailPct) === 100) {
    dynamicObservations.push(`[CLOUD RUN - ALERTA CRÍTICO] 100% de falha HTTP (${cErrorCount} erros, 0 respostas 2xx). O p95 reportado (${cRawP95} ms) reflete APENAS rejeição de tráfego (ex: HTTP 302 Cookie Check / 401 Unauthorized / IAP), e NÃO execução útil de código ou pipeline criptográfica.`);
    dynamicObservations.push(`[COMPARAÇÃO INVÁLIDA] Crypto duration da Cloud é N/A. Qualquer comparação de p95 entre Local (trabalho real) e Cloud (rejeição HTTP) é inválida (apples-to-oranges).`);
  } else if (parseFloat(cFailPct) > 5) {
    dynamicObservations.push(`[CLOUD RUN] Taxa de erro elevada (${cFailPct}%). Apenas ${cUsefulCount} requisições processaram trabalho útil.`);
  } else {
    dynamicObservations.push(`[CLOUD RUN] Sucesso operacional verificado (${cUsefulCount} ops 2xx). Crypto média: ${cCrypto}, p95 útil: ${cUsefulP95}.`);
  }

  const report = `
═════════════════════════════════════════════════════════════════════════════════════════
         RELATÓRIO DINÂMICO DE DEGRADAÇÃO: TERMUX (ARM) vs CLOUD RUN (GCP)
═════════════════════════════════════════════════════════════════════════════════════════
  Alvos Avaliados:
  • Local (Alpine Termux):    ${LOCAL_URL}
  • Cloud (Google Cloud Run): ${CLOUDRUN_URL}
─────────────────────────────────────────────────────────────────────────────────────────
  MÉTRICA DISCRETA                │ LOCAL (Termux Alpine)       │ CLOUD RUN (GCP)
──────────────────────────────────┼─────────────────────────────┼────────────────────────
  Requisições com Sucesso (2xx)   │ ${String(lUsefulCount).padStart(20)} ops   │ ${String(cUsefulCount).padStart(16)} ops
  Requisições com Falha (3xx/4xx) │ ${String(lErrorCount).padStart(20)} ops   │ ${String(cErrorCount).padStart(16)} ops
  Taxa de Erro HTTP               │ ${(lFailPct + '%').padStart(20)}       │ ${(cFailPct + '%').padStart(16)}
──────────────────────────────────┼─────────────────────────────┼────────────────────────
  Latência Bruta (p95)            │ ${(lRawP95 + ' ms').padStart(20)}       │ ${(cRawP95 + ' ms (rejeição)').padStart(16)}
  Latência ÚTIL 2xx (Média)       │ ${lUsefulAvg.padStart(20)}       │ ${cUsefulAvg.padStart(16)}
  Latência ÚTIL 2xx (p95 Real)    │ ${lUsefulP95.padStart(20)}       │ ${cUsefulP95.padStart(16)}
  Cálculo Cripto Ed25519 (avg)    │ ${lCrypto.padStart(20)}       │ ${cCrypto.padStart(16)}
─────────────────────────────────────────────────────────────────────────────────────────
  DIAGNÓSTICO TÉCNICO (DERIVADO 100% DOS DADOS):
${dynamicObservations.map((obs) => '  • ' + obs).join('\n')}
═════════════════════════════════════════════════════════════════════════════════════════
`;

  return {
    stdout: report,
  };
}
