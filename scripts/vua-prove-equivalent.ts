#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════
 * GOS3 CONTRACT HEADER (spec §8)
 * contract: scripts/vua-prove-equivalent.ts
 * version: 1.0.0
 * description: Provedor diferencial universal. Prova que AFTER se
 *   comporta de forma byte-identica a BEFORE sobre um corpus auditavel.
 *   Qualquer divergencia (1 byte) = FAIL. Nao mede performance; prova
 *   equivalencia. Agnóstico a LLM e a provider: opera sobre funcoes,
 *   nao sobre modelos.
 * ═══════════════════════════════════════════════════════════════════
 *
 * Uso:
 *   npx tsx scripts/vua-prove-equivalent.ts \
 *     --before ./src/vortex/crypto.ts#signProofPayload \
 *     --after  ./src/vortex/crypto.ts#signCanonicalString \
 *     --corpus ./proof-corpus.json
 *
 * Corpus (JSON auditavel):
 *   [{ "id": "caso-1", "argsBefore": [...], "argsAfter": [...] }]
 *
 * Comparacao (canonica, byte-exata):
 *   canonicalize(await BEFORE(...argsBefore)) === canonicalize(await AFTER(...argsAfter))
 *
 * Saidas: 0 = todos byte-identicos · 1 = divergencia · 2 = erro de uso/carregamento
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalize } from '../src/vortex/canonicalize.ts';

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

function usage(): void {
  console.error('Uso:');
  console.error('  npx tsx scripts/vua-prove-equivalent.ts --before <mod#export> --after <mod#export> --corpus <corpus.json> [--show N]');
  console.error('Ex.:');
  console.error('  npx tsx scripts/vua-prove-equivalent.ts \\');
  console.error('    --before ./src/vortex/crypto.ts#signProofPayload \\');
  console.error('    --after  ./src/vortex/crypto.ts#signCanonicalString \\');
  console.error('    --corpus ./proof-corpus.json');
}

function parseRef(s: string): { mod: string; exp: string } {
  const i = s.lastIndexOf('#');
  if (i < 0) return { mod: s, exp: 'default' };
  return { mod: s.slice(0, i), exp: s.slice(i + 1) };
}

async function loadFn(ref: string): Promise<(...a: any[]) => any> {
  const { mod, exp } = parseRef(ref);
  const url = pathToFileURL(resolve(mod)).href;
  let m: any;
  try {
    m = await import(url);
  } catch (e) {
    console.error(`FAIL: modulo nao carregou: ${mod}: ${(e as Error).message}`);
    process.exit(2);
  }
  const fn = m[exp];
  if (typeof fn !== 'function') {
    console.error(`FAIL: export '${exp}' nao e funcao em ${mod}`);
    process.exit(2);
  }
  return fn;
}

const canon = (v: unknown): string => (v === undefined ? 'undefined' : canonicalize(v));
const short = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12);

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.before || !args.after || !args.corpus) {
    usage();
    process.exit(2);
  }
  const show = Number(args.show ?? 3);

  const before = await loadFn(args.before);
  const after = await loadFn(args.after);

  let corpus: any[];
  try {
    corpus = JSON.parse(readFileSync(resolve(args.corpus), 'utf8'));
  } catch (e) {
    console.error(`FAIL: corpus ilegivel: ${(e as Error).message}`);
    process.exit(2);
  }
  if (!Array.isArray(corpus) || corpus.length === 0) {
    console.error('FAIL: corpus vazio ou invalido (esperado array nao-vazio)');
    process.exit(2);
  }

  let ok = 0;
  let bad = 0;
  for (const c of corpus) {
    const id = c.id ?? '(sem id)';
    let a = '';
    let b = '';
    let err = '';
    try {
      a = canon(await before(...(c.argsBefore ?? [])));
    } catch (e) {
      err = 'BEFORE lancou: ' + (e as Error).message;
    }
    try {
      b = canon(await after(...(c.argsAfter ?? [])));
    } catch (e) {
      err += (err ? ' | ' : '') + 'AFTER lancou: ' + (e as Error).message;
    }
    if (!err && a === b) {
      ok++;
    } else {
      bad++;
      console.log(`DIVERGE ${id}${err ? ' — ' + err : ''}`);
      if (!err && bad <= show) {
        console.log(`  before: sha ${short(a)} | after: sha ${short(b)}`);
        console.log(`  before[0..160]: ${a.slice(0, 160)}`);
        console.log(`  after [0..160]: ${b.slice(0, 160)}`);
      }
    }
  }

  console.log(`\n${ok}/${ok + bad} casos byte-identicos (canonico RFC 8785)`);
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(`FAIL inesperado: ${(e as Error).message}`);
  process.exit(2);
});
