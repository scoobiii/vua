/**
 * Vortex MCP Comprehensive Benchmark Suite
 * 
 * Measures:
 * 1. MCP Latency per operation (p50, p95, p99)
 * 2. Throughput (req/s) across:
 *    - tools/list
 *    - vortex.inspect (Sandbox + GOS3 + Ed25519 issuance)
 *    - vortex.verify (JCS RFC 8785 canonicalization + SHA256 proof_hash + Ed25519 verification)
 *    - End-to-End Sequence (inspect -> proof -> verify)
 * 3. Concurrent load testing (1, 5, 10, 25, 50 concurrency)
 * 4. Micro-benchmarks breakdown:
 *    - Ed25519 signature verification (pure crypto ops/s)
 *    - RFC 8785 JCS canonicalization (ms)
 *    - proof_hash recalculation (ms)
 * 5. Memory footprint & Error rate
 */

import http from 'http';
import { performance } from 'perf_hooks';
import { canonicalize } from '../src/vortex/canonicalize.js';
import { verifyProofSignature, sha256 } from '../src/vortex/crypto.js';
import { verifyExecutionProof } from '../src/vortex/verifier.js';
import type { ExecutionProof } from '../src/vortex/types.js';

const PORT = 3000;
const HOST = '127.0.0.1';

function rpcCall(method: string, params: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id: Math.floor(Math.random() * 1000000),
      method,
      params,
    });

    const req = http.request(
      {
        host: HOST,
        port: PORT,
        path: '/mcp',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Invalid JSON: ${data}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

async function runThroughputTest(
  name: string,
  fn: () => Promise<boolean>,
  totalRequests: number,
  concurrency: number
): Promise<{
  name: string;
  total: number;
  concurrency: number;
  durationMs: number;
  rps: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
}> {
  const latencies: number[] = [];
  let errors = 0;
  let completed = 0;
  const startTime = performance.now();

  async function worker() {
    while (completed < totalRequests) {
      completed++;
      const t0 = performance.now();
      try {
        const ok = await fn();
        if (!ok) errors++;
      } catch {
        errors++;
      }
      latencies.push(performance.now() - t0);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const durationMs = performance.now() - startTime;
  latencies.sort((a, b) => a - b);

  return {
    name,
    total: latencies.length,
    concurrency,
    durationMs,
    rps: (latencies.length / durationMs) * 1000,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    errorRate: (errors / latencies.length) * 100,
  };
}

async function main() {
  console.log(`\n======================================================================`);
  console.log(`⚡ VORTEX UNIVERSAL ADAPTER (VUA) - COMPREHENSIVE BENCHMARK SUITE`);
  console.log(`   Host: ${HOST}:${PORT} | Architecture: ${process.arch} | Platform: ${process.platform}`);
  console.log(`======================================================================\n`);

  // Verify server is listening
  try {
    const listCheck = await rpcCall('tools/list');
    if (!listCheck.result?.tools) {
      console.error('❌ Server returned unexpected tools/list format');
      process.exit(1);
    }
  } catch (e: any) {
    console.error(`❌ Cannot connect to ${HOST}:${PORT}/mcp: ${e.message}`);
    process.exit(1);
  }

  // Pre-generate a real proof for verify benchmarks
  const preInspect = await rpcCall('tools/call', {
    name: 'vortex.inspect',
    arguments: { request_id: 'pre-bench-' + Date.now(), target: { repository: 'scoobiii/vua' } },
  });
  const sampleProof: ExecutionProof = preInspect.result.execution_proof;
  const tamperedProof = JSON.parse(JSON.stringify(sampleProof));
  tamperedProof.status = 'EXECUTION_FAILED';

  // 1. MICRO-BENCHMARKS (Internal subsystems)
  console.log(`🔬 [FASE 1] Micro-Benchmarks dos Motores de Isolamento & Cripto`);
  console.log(`----------------------------------------------------------------------`);
  const cryptoIterations = 1000;
  
  // RFC 8785 Canonicalization
  const unsigned = { ...sampleProof };
  delete (unsigned as any).signature;
  delete (unsigned as any).proof_hash;

  const tJcs0 = performance.now();
  for (let i = 0; i < cryptoIterations; i++) {
    canonicalize(unsigned);
  }
  const jcsDuration = performance.now() - tJcs0;
  const jcsAvg = (jcsDuration / cryptoIterations) * 1000; // µs
  console.log(`  • JCS RFC 8785 Canonicalization : ${(cryptoIterations / jcsDuration * 1000).toFixed(0)} ops/s | média: ${jcsAvg.toFixed(1)} µs`);

  // SHA256 proof_hash calculation
  const canonStr = canonicalize(unsigned);
  const tHash0 = performance.now();
  for (let i = 0; i < cryptoIterations; i++) {
    sha256(canonStr);
  }
  const hashDuration = performance.now() - tHash0;
  const hashAvg = (hashDuration / cryptoIterations) * 1000;
  console.log(`  • SHA256 proof_hash Hash Calc   : ${(cryptoIterations / hashDuration * 1000).toFixed(0)} ops/s | média: ${hashAvg.toFixed(1)} µs`);

  // Ed25519 signature verify
  const pubKey = sampleProof.identity.key_id;
  const tSig0 = performance.now();
  for (let i = 0; i < cryptoIterations; i++) {
    verifyProofSignature(unsigned as any, sampleProof.signature, pubKey);
  }
  const sigDuration = performance.now() - tSig0;
  const sigAvg = (sigDuration / cryptoIterations) * 1000;
  console.log(`  • Ed25519 Pure Verify (RFC8785) : ${(cryptoIterations / sigDuration * 1000).toFixed(0)} ops/s | média: ${sigAvg.toFixed(1)} µs`);

  // In-process full verifyExecutionProof
  const tFull0 = performance.now();
  for (let i = 0; i < cryptoIterations; i++) {
    verifyExecutionProof(sampleProof);
  }
  const fullDuration = performance.now() - tFull0;
  const fullAvg = (fullDuration / cryptoIterations) * 1000;
  console.log(`  • Full verifyExecutionProof()   : ${(cryptoIterations / fullDuration * 1000).toFixed(0)} ops/s | média: ${fullAvg.toFixed(1)} µs\n`);

  // 2. MCP ENDPOINT LATENCY & THROUGHPUT (Single Concurrency)
  console.log(`📊 [FASE 2] Latência & Throughput dos Métodos MCP (Concorrência = 1)`);
  console.log(`----------------------------------------------------------------------`);

  const benchList = await runThroughputTest('1. tools/list', async () => {
    const res = await rpcCall('tools/list');
    return Array.isArray(res.result?.tools);
  }, 100, 1);

  const benchInspect = await runThroughputTest('2. vortex.inspect', async () => {
    const res = await rpcCall('tools/call', {
      name: 'vortex.inspect',
      arguments: { request_id: `b-insp-${Date.now()}-${Math.random()}`, target: { repository: 'scoobiii/vua' } },
    });
    return Boolean(res.result?.execution_proof?.signature);
  }, 100, 1);

  const benchVerifyOk = await runThroughputTest('3. vortex.verify (válido)', async () => {
    const res = await rpcCall('tools/call', {
      name: 'vortex.verify',
      arguments: { proof: sampleProof },
    });
    return res.result?.verified === true || res.result?.output?.verified === true;
  }, 100, 1);

  const benchVerifyTamper = await runThroughputTest('4. vortex.verify (tampered)', async () => {
    const res = await rpcCall('tools/call', {
      name: 'vortex.verify',
      arguments: { proof: tamperedProof },
    });
    return res.result?.verified === false || res.result?.output?.verified === false;
  }, 100, 1);

  const benchE2E = await runThroughputTest('5. E2E (inspect -> verify)', async () => {
    const insp = await rpcCall('tools/call', {
      name: 'vortex.inspect',
      arguments: { request_id: `b-e2e-${Date.now()}-${Math.random()}`, target: { repository: 'scoobiii/vua' } },
    });
    const p = insp.result?.execution_proof;
    if (!p) return false;
    const ver = await rpcCall('tools/call', { name: 'vortex.verify', arguments: { proof: p } });
    return ver.result?.verified === true || ver.result?.output?.verified === true;
  }, 50, 1);

  const resultsC1 = [benchList, benchInspect, benchVerifyOk, benchVerifyTamper, benchE2E];
  console.log(
    `| Operação                  | Throughput   | Latência p50 | p95     | p99     | Erro % |`
  );
  console.log(
    `|:--------------------------|:-------------|:-------------|:--------|:--------|:-------|`
  );
  for (const r of resultsC1) {
    console.log(
      `| ${r.name.padEnd(25)} | ${r.rps.toFixed(1).padStart(7)} req/s | ${r.p50.toFixed(2).padStart(8)} ms | ${r.p95.toFixed(2).padStart(6)} ms | ${r.p99.toFixed(2).padStart(6)} ms | ${r.errorRate.toFixed(1).padStart(5)}% |`
    );
  }

  // 3. CONCURRENCY LOAD TEST (E2E Pipeline: inspect -> proof -> verify)
  console.log(`\n🔥 [FASE 3] Teste de Carga e Escalonamento Concorrente (Pipeline E2E)`);
  console.log(`----------------------------------------------------------------------`);
  const concurrencyLevels = [1, 5, 10, 25, 50];
  const concurrencyResults = [];

  for (const c of concurrencyLevels) {
    const totalOps = c >= 25 ? 100 : 50;
    const r = await runThroughputTest(`E2E (conc=${c})`, async () => {
      const insp = await rpcCall('tools/call', {
        name: 'vortex.inspect',
        arguments: { request_id: `c-${c}-${Date.now()}-${Math.random()}`, target: { repository: 'scoobiii/vua' } },
      });
      const p = insp.result?.execution_proof;
      if (!p) return false;
      const ver = await rpcCall('tools/call', { name: 'vortex.verify', arguments: { proof: p } });
      return ver.result?.verified === true || ver.result?.output?.verified === true;
    }, totalOps, c);
    concurrencyResults.push(r);
  }

  console.log(
    `| Concorrência | Requisições | Throughput   | Latência p50 | p95     | p99     | Erro % |`
  );
  console.log(
    `|:-------------|:------------|:-------------|:-------------|:--------|:--------|:-------|`
  );
  for (const r of concurrencyResults) {
    console.log(
      `| ${String(r.concurrency).padEnd(12)} | ${String(r.total).padEnd(11)} | ${r.rps.toFixed(1).padStart(7)} req/s | ${r.p50.toFixed(2).padStart(8)} ms | ${r.p95.toFixed(2).padStart(6)} ms | ${r.p99.toFixed(2).padStart(6)} ms | ${r.errorRate.toFixed(1).padStart(5)}% |`
    );
  }

  // 4. MEMORY AND HEALTH METRICS
  const mem = process.memoryUsage();
  console.log(`\n💾 [FASE 4] Pegada de Memória do Processo de Teste:`);
  console.log(`  • Heap Used  : ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • Heap Total : ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  • RSS        : ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);

  console.log(`\n======================================================================`);
  console.log(`✅ BENCHMARK CONCLUÍDO COM SUCESSO!`);
  console.log(`======================================================================\n`);
}

main().catch(console.error);
