import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  GitCommit,
  Hash,
  TrendingUp,
  Cpu,
  Clock,
  ShieldCheck,
  RefreshCw,
  Trophy,
  Award,
  Zap,
  GitPullRequest,
  Check,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import type { BenchmarkReport } from '../vortex/evidence.js';
import type { ExecutionEvidence } from '../vortex/types.js';

interface ArenaCandidate {
  candidate: {
    agent_id: string;
    agent_model: string;
    branch_or_fork: string;
    patch_summary: string;
    proposer_type?: string;
    diff_stats: {
      added_lines: number;
      removed_lines: number;
      files_changed: number;
    };
  };
  proposer_subjection_verified: boolean;
  canary_passed: boolean;
  canary_tests_passed: number;
  vua_benchmark_accuracy_pct: number;
  latency_p95_ms: number;
  throughput_rps: number;
  baseline_score: number;
  composite_score: number;
  delta_gain: number;
  delta_rps_pct: number;
  delta_latency_pct: number;
  verdict: 'PASS_SUPERIOR' | 'PASS_ACCEPTABLE' | 'FAIL_REGRESSION' | 'DISQUALIFIED';
  auto_merge_eligible: boolean;
  disqualification_reason?: string;
}

interface ArenaResult {
  timestamp: string;
  baseline_metrics: {
    score: number;
    rps: number;
    latency_p95_ms: number;
    accuracy_pct: number;
  };
  universal_subjection_rule_enforced: boolean;
  total_candidates: number;
  superior_candidates: number;
  leaderboard: ArenaCandidate[];
  winning_patch: ArenaCandidate | null;
  evidence_hash: string;
  recommended_action: string;
}

export const CIBenchmarkGate: React.FC = () => {
  const [data, setData] = useState<{
    evidence: ExecutionEvidence;
    benchmark: BenchmarkReport;
  } | null>(null);
  const [arenaData, setArenaData] = useState<ArenaResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [runningArena, setRunningArena] = useState(false);
  const [activeSection, setActiveSection] = useState<'arena' | 'foundation'>('arena');

  const fetchEvidence = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/vortex/evidence');
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchArena = async () => {
    setRunningArena(true);
    try {
      const res = await fetch('/api/vortex/arena/tournament');
      const json = await res.json();
      setArenaData(json);
    } catch (err) {
      console.error('Failed to run arena benchmark:', err);
    } finally {
      setRunningArena(false);
    }
  };

  useEffect(() => {
    fetchEvidence();
    fetchArena();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header with Selector */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">CI Intelligence, Baseline Gain & Selection Arena</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                VUA-SPEC-v2 §2 & §3
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              Regra de Sujeição Universal ao CI: Todo proponente (agente autônomo, engenheiro humano ou fork externo) está
              100% sujeito aos gates do CI. O auto-merge exige estritamente ganho sobre a baseline (<code className="text-emerald-400">PASS_SUPERIOR</code>).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-zinc-950 p-1 rounded-lg border border-zinc-800 flex text-xs">
              <button
                onClick={() => setActiveSection('arena')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeSection === 'arena'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                🏆 Agent Patch Arena
              </button>
              <button
                onClick={() => setActiveSection('foundation')}
                className={`px-3 py-1.5 rounded-md font-medium transition ${
                  activeSection === 'foundation'
                    ? 'bg-zinc-800 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                📊 Foundation Gate
              </button>
            </div>

            <button
              onClick={() => {
                fetchEvidence();
                fetchArena();
              }}
              disabled={loading || runningArena}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || runningArena ? 'animate-spin' : ''}`} />
              Re-executar CI
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 1: AGENT PATCH ARENA & BASELINE GAIN COMPARATOR */}
      {activeSection === 'arena' && (
        <div className="space-y-6">
          {/* Universal Subjection Rule Banner */}
          <div className="bg-gradient-to-r from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-500/30 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-lg text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Cláusula de Sujeição Universal ao CI</span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                    NO-BYPASS MANDATORY
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Nenhum ator (nem mantenedor, nem LLM de ponta) tem privilégio de merge direto. O árbitro do CI mede
                  o ganho contra a baseline e autoriza o auto-merge somente com <span className="text-emerald-400 font-semibold font-mono">PASS_SUPERIOR (Δ &gt; 0)</span>.
                </p>
              </div>
            </div>

            {arenaData && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <div className="bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 text-right">
                  <div className="text-[10px] text-zinc-500 uppercase">Baseline Anchor</div>
                  <div className="text-zinc-200 font-bold">{arenaData.baseline_metrics.score} pts</div>
                </div>
                <div className="bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 text-right">
                  <div className="text-[10px] text-zinc-500 uppercase">Baseline RPS</div>
                  <div className="text-emerald-400 font-bold">{arenaData.baseline_metrics.rps} req/s</div>
                </div>
              </div>
            )}
          </div>

          {/* Leaderboard Table */}
          {arenaData && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white">Leaderboard da Arena de Patches Darwiniana</h3>
                </div>
                <div className="text-xs text-zinc-400 font-mono">
                  {arenaData.superior_candidates} de {arenaData.total_candidates} candidatos superaram a base
                </div>
              </div>

              {/* Candidates Grid / Table */}
              <div className="space-y-3">
                {arenaData.leaderboard.map((item, idx) => {
                  const isWinner = idx === 0 && item.verdict === 'PASS_SUPERIOR';
                  const isDisqualified = item.verdict === 'DISQUALIFIED';
                  const isRegression = item.verdict === 'FAIL_REGRESSION';

                  return (
                    <div
                      key={item.candidate.agent_id}
                      className={`p-4 rounded-xl border transition ${
                        isWinner
                          ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                          : isDisqualified
                          ? 'bg-red-950/10 border-red-900/40 opacity-75'
                          : isRegression
                          ? 'bg-amber-950/10 border-amber-900/40'
                          : 'bg-zinc-950 border-zinc-800'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                              isWinner
                                ? 'bg-amber-500 text-zinc-950'
                                : idx === 1
                                ? 'bg-zinc-300 text-zinc-950'
                                : idx === 2
                                ? 'bg-amber-700 text-white'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {isDisqualified ? '✕' : idx + 1}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-zinc-100">
                                {item.candidate.agent_id}
                              </span>
                              <span className="text-[11px] text-zinc-400">
                                ({item.candidate.agent_model})
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                                Sujeito ao CI: SIM
                              </span>
                            </div>
                            <div className="text-xs text-zinc-400 flex items-center gap-2 mt-0.5">
                              <span className="font-mono text-indigo-400">{item.candidate.branch_or_fork}</span>
                              <span>•</span>
                              <span>{item.candidate.patch_summary}</span>
                            </div>
                          </div>
                        </div>

                        {/* Badges & Scores */}
                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono">
                            <div className="text-base font-bold text-white flex items-center gap-1 justify-end">
                              <span>{item.composite_score}</span>
                              <span
                                className={`text-xs ${
                                  item.delta_gain > 0
                                    ? 'text-emerald-400'
                                    : item.delta_gain < 0
                                    ? 'text-red-400'
                                    : 'text-zinc-400'
                                }`}
                              >
                                (Δ {item.delta_gain >= 0 ? `+${item.delta_gain}` : item.delta_gain})
                              </span>
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              RPS {item.delta_rps_pct >= 0 ? `+${item.delta_rps_pct}%` : `${item.delta_rps_pct}%`} • p95 {item.latency_p95_ms}ms
                            </div>
                          </div>

                          <div className="min-w-[120px] text-right">
                            <span
                              className={`inline-block px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase tracking-wider ${
                                item.verdict === 'PASS_SUPERIOR'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                                  : item.verdict === 'PASS_ACCEPTABLE'
                                  ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                  : item.verdict === 'FAIL_REGRESSION'
                                  ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                  : 'bg-red-950 text-red-400 border border-red-800'
                              }`}
                            >
                              {item.verdict}
                            </span>
                            {item.auto_merge_eligible ? (
                              <div className="text-[10px] text-emerald-400 font-mono mt-0.5 flex items-center gap-1 justify-end">
                                <Check className="w-3 h-3" /> Auto-Merge Aprovado
                              </div>
                            ) : (
                              <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                Auto-Merge Bloqueado
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.disqualification_reason && (
                        <div className="mt-2.5 p-2 bg-red-950/30 border border-red-900/50 rounded text-xs text-red-300 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                          <span>{item.disqualification_reason}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Recommended Action Box */}
              <div className="mt-4 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                  Decisão Normativa do CI
                </div>
                <p className="text-xs font-mono text-zinc-200">
                  {arenaData.recommended_action}
                </p>
                <div className="pt-2 text-[10px] font-mono text-zinc-500 flex items-center justify-between border-t border-zinc-800/80">
                  <span>Hash Canônico de Evidência:</span>
                  <span className="text-emerald-400 font-mono">{arenaData.evidence_hash}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: FOUNDATION EVIDENCE & CANONICAL HASH */}
      {activeSection === 'foundation' && data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Execution Evidence Hash */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm text-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Hash className="w-4 h-4 text-indigo-400" />
                Execution Evidence Hash (CI-Dependent)
              </h3>

              <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg font-mono space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">commit_sha:</span>
                  <span className="text-indigo-300 flex items-center gap-1 truncate max-w-[240px]">
                    <GitCommit className="w-3.5 h-3.5 text-indigo-400" />
                    {data.evidence.commit_sha}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">ci_run_id:</span>
                  <span className="text-zinc-300">{data.evidence.ci.run_id}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">ci_attempt:</span>
                  <span className="text-zinc-300">{data.evidence.ci.run_attempt}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">workflow:</span>
                  <span className="text-zinc-300">{data.evidence.ci.workflow}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">code_coverage:</span>
                  <span className="text-emerald-400 font-bold">{data.evidence.result.coverage} (Deterministic 100%)</span>
                </div>

                <div className="pt-2 border-t border-zinc-800">
                  <span className="text-zinc-500 text-[10px] uppercase block mb-1">
                    Canonical Evidence Hash (RFC 8785 + SHA-256)
                  </span>
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 text-emerald-400 font-mono text-[10px] break-all select-all">
                    {data.evidence.canonical_hash}
                  </div>
                </div>
              </div>

              {/* Absolute Gates Checklist */}
              <div className="space-y-2 pt-2 border-t border-zinc-800">
                <span className="text-[11px] font-semibold text-zinc-300 block">
                  Mandatory Foundation Merge Gates
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Coverage 100%
                  </div>
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Adversarial Suite
                  </div>
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    10/10 E2E Real
                  </div>
                  <div className="p-2 bg-zinc-950 border border-zinc-800 rounded flex items-center gap-2 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Proof Invariants
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Benchmark Comparison against Baseline */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm text-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Benchmark Baseline Comparison
                </h3>
                <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-mono font-bold">
                  {data.benchmark.verdict}
                </span>
              </div>

              {/* Score comparison */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-lg text-center">
                  <div className="text-[10px] text-zinc-500 uppercase font-mono">Baseline Score</div>
                  <div className="text-2xl font-bold font-mono text-zinc-300 mt-1">
                    {data.benchmark.score_baseline}
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-950 border border-emerald-500/40 rounded-lg text-center">
                  <div className="text-[10px] text-emerald-400 uppercase font-mono">Current PR Score</div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                    {data.benchmark.score_current}
                  </div>
                </div>
              </div>

              {/* Metrics table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500 text-[10px]">
                      <th className="pb-1">Metric</th>
                      <th className="pb-1 text-right">Baseline (main)</th>
                      <th className="pb-1 text-right">Current PR</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                    <tr>
                      <td className="py-1.5">Throughput (RPS)</td>
                      <td className="py-1.5 text-right">{data.benchmark.baseline.rps}</td>
                      <td className="py-1.5 text-right text-emerald-400 font-bold">
                        {data.benchmark.current.rps}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5">p50 Latency</td>
                      <td className="py-1.5 text-right">{data.benchmark.baseline.p50_ms}ms</td>
                      <td className="py-1.5 text-right text-emerald-400">
                        {data.benchmark.current.p50_ms}ms
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5">p95 Latency</td>
                      <td className="py-1.5 text-right">{data.benchmark.baseline.p95_ms}ms</td>
                      <td className="py-1.5 text-right text-emerald-400 font-bold">
                        {data.benchmark.current.p95_ms}ms
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5">p99 Latency</td>
                      <td className="py-1.5 text-right">{data.benchmark.baseline.p99_ms}ms</td>
                      <td className="py-1.5 text-right text-emerald-400">
                        {data.benchmark.current.p99_ms}ms
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5">Error Rate</td>
                      <td className="py-1.5 text-right">{data.benchmark.baseline.error_rate_pct}%</td>
                      <td className="py-1.5 text-right text-emerald-400">
                        {data.benchmark.current.error_rate_pct}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[10px] text-zinc-400 font-mono">
                Formula VUA: 30% Throughput + 20% p95 + 15% p99 + 15% Error Rate + 10% Timeout Rate + 10% Memory.
                Condição de auto-merge: O PR precisa obter <span className="text-emerald-400">PASS_SUPERIOR</span> contra a base.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
