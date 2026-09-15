import React, { useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  FileCode2,
  Grid,
} from 'lucide-react';
import type { AdversarialResult } from '../vortex/types.js';

export const AdversarialMatrix: React.FC = () => {
  const [results, setResults] = useState<AdversarialResult[]>([]);
  const [running, setRunning] = useState(false);

  const runSuite = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/vortex/conformance/adversarial', {
        method: 'POST',
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRunning(false);
    }
  };

  const passCount = results.filter((r) => r.passed).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Adversarial Conformance Suite</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">
                spec §21: Negative Invariants
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              An implementation does not attain conformance merely because happy paths succeed.
              It must actively repel: <span className="font-mono text-zinc-200">FORGE, REPLAY, ESCALATE, ESCAPE, TAMPER</span>.
            </p>
          </div>

          <button
            onClick={runSuite}
            disabled={running}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs flex items-center gap-2 transition shadow"
          >
            {running ? (
              <>
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
                Executing Invariants...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Execute Adversarial Suite
              </>
            )}
          </button>
        </div>
      </div>

      {/* Security Quadrant Matrix (spec §22) */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
          <Grid className="w-4 h-4 text-indigo-400" />
          Foundation Security Matrix (spec §22)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {/* Top Left: Vortex */}
          <div className="p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/20 space-y-1 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-[10px] font-mono font-bold bg-emerald-900 text-emerald-300 px-2 py-0.5 rounded border border-emerald-700">
              TARGET
            </div>
            <div className="font-bold text-emerald-400 text-sm">Vortex / Verifiable Agent</div>
            <div className="text-[11px] text-zinc-300">High Security • High Evidence</div>
            <p className="text-[11px] text-zinc-400 mt-2">
              Bounded execution, cryptographic identity, RFC 8785 canonical proof, independent verification.
            </p>
          </div>

          {/* Top Right: Black-box Guard */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 space-y-1">
            <div className="font-bold text-zinc-300 text-sm">Black-box Guard</div>
            <div className="text-[11px] text-zinc-400">High Security • Low Evidence</div>
            <p className="text-[11px] text-zinc-500 mt-2">
              Strong block rules but zero cryptographic accountability. Cannot be independently verified by third parties.
            </p>
          </div>

          {/* Bottom Left: Audit Theater */}
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50 space-y-1">
            <div className="font-bold text-amber-400 text-sm">Audit Theater</div>
            <div className="text-[11px] text-zinc-400">Low Security • High Evidence</div>
            <p className="text-[11px] text-zinc-500 mt-2">
              Copious logging and telemetry, but weak or porous authorization controls allowing escapes.
            </p>
          </div>

          {/* Bottom Right: Blind Agent */}
          <div className="p-4 rounded-xl border border-rose-950 bg-rose-950/20 space-y-1">
            <div className="font-bold text-rose-400 text-sm">Blind Agent (Unsafe)</div>
            <div className="text-[11px] text-zinc-400">Low Security • Low Evidence</div>
            <p className="text-[11px] text-zinc-500 mt-2">
              Direct unconstrained tool calls with zero boundaries, zero identity, and unrecorded side effects.
            </p>
          </div>
        </div>
      </div>

      {/* Adversarial Invariant Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.length === 0 ? (
          <div className="col-span-full p-8 bg-zinc-900 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
            Run the adversarial suite to test negative security invariants.
          </div>
        ) : (
          results.map((r) => {
            return (
              <div
                key={r.scenario}
                className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 bg-zinc-900 ${
                  r.passed ? 'border-emerald-500/30' : 'border-rose-500/40'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold text-indigo-400 px-2 py-0.5 rounded bg-zinc-800">
                      {r.scenario}
                    </span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        r.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                      }`}
                    >
                      {r.passed ? 'DEFENDED' : 'BREACH'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white">{r.name}</h4>
                  <p className="text-[11px] text-zinc-400 mt-1">{r.description}</p>
                </div>

                <div className="pt-2 border-t border-zinc-800/80 font-mono text-[11px] space-y-1">
                  <div className="text-zinc-500">
                    Expected: <span className="text-zinc-300">{r.expected_status}</span>
                  </div>
                  <div className="text-zinc-500">
                    Observed: <span className="text-emerald-400">{r.actual_status}</span>
                  </div>
                  <div className="text-zinc-500 text-[10px] mt-1 pt-1 border-t border-zinc-800 truncate">
                    {r.evidence}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
