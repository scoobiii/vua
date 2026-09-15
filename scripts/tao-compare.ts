#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════
 * GOS3 CONTRACT HEADER (spec §8)
 * contract: scripts/tao-compare.ts
 * version: 1.0.0
 * description: TAO-REGRESSION + aceitacao de baseline. Valida se um
 *   mapa pode ser aceito como TAO-BASELINE (criterios rigidos, sem
 *   fabricacao) e compara um mapa candidato contra a baseline
 *   congelada: mesma suite, mesmo oraculo, mesmas condicoes, mesmo N.
 *   Condicoes divergentes => UNVERIFIED, nunca um veredito.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Uso:
 *   npx tsx scripts/tao-compare.ts --accept-baseline reports/tao-baseline-1/tao-capability-map.json
 *   npx tsx scripts/tao-compare.ts --baseline <b.json> --candidate <c.json> [--max-degradation 0]
 *
 * Saidas:
 *   --accept-baseline:      0 = BASELINE ACEITA · 1 = UNVERIFIED (motivos listados)
 *   --baseline --candidate: 0 = STABLE/IMPROVED · 1 = REGRESSION · 2 = incomparavel
 *
 * Gates (definicao):
 *   TAO-CAPABILITY = tao:map (capacidade absoluta: pass_rate/flaky/failed)
 *   TAO-REGRESSION = este script (delta vs baseline; limite via --max-degradation)
 *   PERFORMANCE    = >= 5% somente quando o teste for de performance (nao aqui)
 */

import { readFileSync } from 'node:fs';

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[k] = v;
    }
  }
  return out;
}

function loadJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`❌ nao foi possivel ler ${path}: ${(e as Error).message}`);
    process.exit(2);
  }
}

// ─────────────────────────────────────────────────────────────
// Aceitacao de baseline
// ─────────────────────────────────────────────────────────────

interface Check { ok: boolean; reasons: string[]; }

/**
 * Criterios para um mapa ser aceito como TAO-BASELINE:
 *  - N/N execucoes por tarefa (completude)
 *  - oraculo executado de forma independente em 100% das runs
 *    (nenhum ADAPTER_NO_CODE — o oraculo nao pode ter sido pulado)
 *  - evidenceSha valido em todas as runs
 *  - condicoes completas: seed fixo, suiteVersion, suiteHash,
 *    envFingerprint, vuaCommit (40-hex do git em runtime), runtimeId
 *  - mesma condicao em todas as linhas (um fingerprint so)
 * Qualquer item faltando => UNVERIFIED. Nao existe "baseline parcial".
 */
function validateBaseline(map: any): Check {
  const reasons: string[] = [];
  const rows: any[] = map.rows ?? [];
  const n = map.runsPerTask;

  if (!rows.length) reasons.push('mapa sem tarefas');
  if (!n || n < 1) reasons.push('runsPerTask ausente/invalido');

  for (const row of rows) {
    const runs: any[] = row.runs ?? [];
    if (runs.length !== n) {
      reasons.push(`${row.taskId}: ${runs.length}/${n} execucoes (exigido ${n}/${n})`);
    }
    for (const r of runs) {
      if (!r.verifierOutput || r.verifierOutput === 'ADAPTER_NO_CODE') {
        reasons.push(`${row.taskId} run ${r.runIndex}: oraculo nao executado de forma independente`);
      }
      if (!/^[0-9a-f]{64}$/.test(r.evidenceSha ?? '')) {
        reasons.push(`${row.taskId} run ${r.runIndex}: evidenceSha ausente/invalido`);
      }
    }
  }

  const c = map.condition ?? {};
  if (typeof c.seed !== 'number') reasons.push('seed ausente (baseline exige seed fixo, ex. 42)');
  if (!/^[0-9a-f]{40}$/.test(c.vuaCommit ?? '')) {
    reasons.push('vuaCommit ausente/invalido (exige git rev-parse HEAD em runtime)');
  }
  if (!c.runtimeId) reasons.push('runtimeId ausente');
  if (!c.suiteVersion) reasons.push('suiteVersion ausente');
  if (!c.suiteHash) reasons.push('suiteHash ausente (suite nao congelada)');
  if (!c.envFingerprint) reasons.push('envFingerprint ausente');
  if (!c.promptVersion) reasons.push('promptVersion ausente');

  const fps = new Set(rows.map((r: any) => r.conditionFingerprint));
  if (fps.size > 1) reasons.push('conditionFingerprint diverge entre tarefas (condicoes nao uniformes)');

  return { ok: reasons.length === 0, reasons };
}

// ─────────────────────────────────────────────────────────────
// Comparacao candidato vs baseline (TAO-REGRESSION)
// ─────────────────────────────────────────────────────────────

interface Delta {
  taskId: string;
  baseline: number;
  candidate: number;
  delta: number;
  regression: boolean;
}

function compare(
  baseline: any, candidate: any, maxDegradation: number,
): { comparable: boolean; blockers: string[]; warnings: string[]; deltas: Delta[]; verdict: string } {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const bc = baseline.condition ?? {};
  const cc = candidate.condition ?? {};

  // Mesma suite (inclui o oraculo held-out via suiteHash)
  if (!bc.suiteHash || bc.suiteHash !== cc.suiteHash) {
    blockers.push(
      `suiteHash diverge (baseline ${String(bc.suiteHash).slice(0, 12)}… vs ` +
      `candidato ${String(cc.suiteHash).slice(0, 12)}…): suites diferentes, comparacao invalida`,
    );
  }
  // Mesmas condicoes de medicao
  for (const k of ['provider', 'model', 'temperature', 'seed']) {
    if (JSON.stringify(bc[k]) !== JSON.stringify(cc[k])) {
      blockers.push(`condicao diverge: ${k} (baseline=${bc[k]} vs candidato=${cc[k]})`);
    }
  }
  // Mesmo N
  if (baseline.runsPerTask !== candidate.runsPerTask) {
    blockers.push(`N de execucoes diverge (baseline=${baseline.runsPerTask} vs candidato=${candidate.runsPerTask})`);
  }
  if (blockers.length) {
    return { comparable: false, blockers, warnings, deltas: [], verdict: 'UNVERIFIED' };
  }

  if (bc.envFingerprint !== cc.envFingerprint) {
    warnings.push('envFingerprint diverge: ambientes diferentes; comparacao segue, marcada como cross-env');
  }
  // vuaCommit divergente e esperado: e exatamente a mudanca que a regressao mede.
  if (bc.vuaCommit !== cc.vuaCommit) {
    warnings.push(
      `vuaCommit diverge (baseline ${String(bc.vuaCommit).slice(0, 8)} → ` +
      `candidato ${String(cc.vuaCommit).slice(0, 8)}): delta atribuido a esta mudanca`,
    );
  }

  const deltas: Delta[] = [];
  let regressed = false;
  for (const bRow of baseline.rows ?? []) {
    const cRow = (candidate.rows ?? []).find((r: any) => r.taskId === bRow.taskId);
    if (!cRow) {
      blockers.push(`tarefa ${bRow.taskId} ausente no candidato`);
      continue;
    }
    const delta = cRow.passRate - bRow.passRate;
    const regression = delta < -maxDegradation;
    if (regression) regressed = true;
    deltas.push({ taskId: bRow.taskId, baseline: bRow.passRate, candidate: cRow.passRate, delta, regression });
  }
  if (blockers.length) {
    return { comparable: false, blockers, warnings, deltas, verdict: 'UNVERIFIED' };
  }

  const verdict = regressed
    ? 'REGRESSION'
    : deltas.some(d => d.delta > 0) ? 'IMPROVED' : 'STABLE';
  return { comparable: true, blockers, warnings, deltas, verdict };
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args['accept-baseline']) {
    const map = loadJson(args['accept-baseline']);
    const check = validateBaseline(map);
    console.log('═══════════════════════════════════════════════════');
    if (check.ok) {
      const c = map.condition;
      console.log('✅ TAO-BASELINE ACEITA');
      console.log(`   suite:   ${c.suiteVersion} (${String(c.suiteHash).slice(0, 12)}…)`);
      console.log(`   modelo:  ${c.provider}/${c.model} temp=${c.temperature} seed=${c.seed}`);
      console.log(`   runs:    ${map.runsPerTask}/tarefa × ${map.rows.length} tarefas`);
      console.log(`   commit:  ${c.vuaCommit}`);
      console.log(`   runtime: ${c.runtimeId}`);
      console.log('═══════════════════════════════════════════════════');
      process.exit(0);
    }
    console.log(`❌ TAO BASELINE = UNVERIFIED (${check.reasons.length} motivo(s)):`);
    for (const r of check.reasons) console.log(`   - ${r}`);
    console.log('═══════════════════════════════════════════════════');
    process.exit(1);
  }

  if (args.baseline && args.candidate) {
    const maxDeg = Number(args['max-degradation'] ?? 0);
    const b = loadJson(args.baseline);
    const c = loadJson(args.candidate);
    const res = compare(b, c, maxDeg);

    console.log('═══════════════════════════════════════════════════');
    console.log('  TAO-REGRESSION: candidato vs baseline');
    console.log('═══════════════════════════════════════════════════');
    for (const w of res.warnings) console.log(`  ⚠️  ${w}`);
    for (const bl of res.blockers) console.log(`  ⛔ ${bl}`);
    for (const d of res.deltas) {
      const sign = d.delta > 0 ? '+' : '';
      const tag = d.regression ? '🔻 REGRESSION' : '  ok';
      console.log(
        `  ${tag} ${d.taskId.padEnd(18)} ` +
        `base=${(d.baseline * 100).toFixed(1)}% → cand=${(d.candidate * 100).toFixed(1)}% ` +
        `(${sign}${(d.delta * 100).toFixed(1)}pp)`,
      );
    }
    console.log('───────────────────────────────────────────────────');
    console.log(`  veredito: ${res.verdict}  (max-degradation=${maxDeg})`);
    console.log('═══════════════════════════════════════════════════');

    if (!res.comparable) process.exit(2);
    process.exit(res.verdict === 'REGRESSION' ? 1 : 0);
  }

  console.error('Uso:');
  console.error('  npx tsx scripts/tao-compare.ts --accept-baseline <mapa.json>');
  console.error('  npx tsx scripts/tao-compare.ts --baseline <b.json> --candidate <c.json> [--max-degradation 0]');
  process.exit(2);
}

main();
