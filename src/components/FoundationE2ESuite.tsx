import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Play,
  RotateCw,
  Terminal,
  ShieldAlert,
  Fingerprint,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { FoundationE2EResult } from '../vortex/types.js';

export const FoundationE2ESuite: React.FC = () => {
  const [results, setResults] = useState<FoundationE2EResult[]>([]);
  const [running, setRunning] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const runAllE2Es = async () => {
    setRunning(true);
    try {
      const res = await fetch('/api/vortex/conformance/e2e', {
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

  const passCount = results.filter((r) => r.status === 'PASS').length;
  const totalCount = results.length || 10;

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">Foundation 10/10 Integration E2E Suite</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                spec §20 & Foundation Integration v1
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Normative cross-boundary integration tests validating full-pipeline behavior between MCP,
              Gateway, Filesystem, Credential Broker, Anti-Replay, and Independent Verifier.
            </p>
          </div>

          <div className="flex items-center gap-4">
            {results.length > 0 && (
              <div className="text-right font-mono text-xs">
                <span className="text-zinc-400">Status: </span>
                <span className={passCount === totalCount ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                  {passCount} / {totalCount} PASS
                </span>
              </div>
            )}

            <button
              onClick={runAllE2Es}
              disabled={running}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs flex items-center gap-2 transition shadow"
            >
              {running ? (
                <>
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                  Running 10 E2Es...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Execute 10 E2E Tests
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Test List */}
      <div className="space-y-3">
        {results.length === 0 ? (
          <div className="p-12 bg-zinc-900 border border-dashed border-zinc-800 rounded-xl text-center text-zinc-500 text-xs">
            <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-zinc-300 font-medium">No E2E test runs executed yet.</p>
            <p className="text-zinc-500 mt-1">
              Click &quot;Execute 10 E2E Tests&quot; to execute the complete integrated suite.
            </p>
          </div>
        ) : (
          results.map((e2e) => {
            const isPass = e2e.status === 'PASS';
            const isExpanded = expandedId === e2e.id;

            return (
              <div
                key={e2e.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden transition-all shadow-sm"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : e2e.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/40 transition select-none"
                >
                  <div className="flex items-center gap-3">
                    {isPass ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-indigo-400">{e2e.id}</span>
                        <span className="text-xs font-semibold text-white">{e2e.name}</span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">{e2e.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-zinc-400">{e2e.duration_ms}ms</span>
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                        isPass ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                      }`}
                    >
                      {e2e.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/60 text-xs font-mono space-y-3">
                    {e2e.details && (
                      <div>
                        <span className="text-zinc-500 uppercase text-[10px] block mb-1">
                          Test Assertions
                        </span>
                        <pre className="text-zinc-300 bg-zinc-950 p-2 rounded border border-zinc-800 text-[11px]">
                          {JSON.stringify(e2e.details, null, 2)}
                        </pre>
                      </div>
                    )}

                    {e2e.execution_proof && (
                      <div>
                        <span className="text-zinc-500 uppercase text-[10px] block mb-1">
                          Generated ExecutionProof v1
                        </span>
                        <pre className="text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-800 text-[10px] overflow-x-auto">
                          {JSON.stringify(e2e.execution_proof, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
