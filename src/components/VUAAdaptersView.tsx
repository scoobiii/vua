import React, { useState, useEffect } from 'react';
import {
  Layers,
  Github,
  Terminal,
  Smartphone,
  Monitor,
  Shield,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  ArrowRight,
  Cpu,
  Key,
  HardDrive,
  Activity,
  FileCheck,
  Server
} from 'lucide-react';
import type { ExecutionProof } from '../vortex/types.js';

interface VUAAdaptersViewProps {
  onSendToVerifier: (proof: ExecutionProof) => void;
}

interface AdapterMetadata {
  id: 'github' | 'linux' | 'android' | 'windows';
  name: string;
  environment: string;
  version: string;
  status: string;
  description: string;
  capabilities: string[];
  supportedActions: Array<{
    action: string;
    description: string;
    requiresApproval?: boolean;
    defaultParams?: Record<string, unknown>;
  }>;
  systemMetrics?: Record<string, string | number>;
}

export const VUAAdaptersView: React.FC<VUAAdaptersViewProps> = ({ onSendToVerifier }) => {
  const [adapters, setAdapters] = useState<AdapterMetadata[]>([]);
  const [selectedId, setSelectedId] = useState<'github' | 'linux' | 'android' | 'windows'>('github');
  const [selectedAction, setSelectedAction] = useState<string>('inspect_repo');
  const [payloadText, setPayloadText] = useState<string>('{\n  "owner": "vortex-foundation",\n  "repo": "vua-connector"\n}');
  const [targetText, setTargetText] = useState<string>('{\n  "repository": "vortex-foundation/vua-connector"\n}');
  const [approvalToken, setApprovalToken] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [probing, setProbing] = useState<boolean>(false);
  const [probeResult, setProbeResult] = useState<any>(null);
  const [conformanceRunning, setConformanceRunning] = useState<boolean>(false);
  const [conformanceResult, setConformanceResult] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Load adapters list
  useEffect(() => {
    fetch('/api/vua/adapters')
      .then((res) => res.json())
      .then((data) => {
        if (data.adapters) {
          setAdapters(data.adapters);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  const currentAdapter = adapters.find((a) => a.id === selectedId);

  // When selected adapter changes, load default action and params
  useEffect(() => {
    if (!currentAdapter) return;
    const firstAction = currentAdapter.supportedActions[0];
    if (firstAction) {
      setSelectedAction(firstAction.action);
      setPayloadText(JSON.stringify(firstAction.defaultParams || {}, null, 2));
    }
    setResult(null);
    setError(null);
    setProbeResult(null);
  }, [selectedId, adapters]);

  const handleActionSelect = (actionName: string) => {
    setSelectedAction(actionName);
    const act = currentAdapter?.supportedActions.find((a) => a.action === actionName);
    if (act?.defaultParams) {
      setPayloadText(JSON.stringify(act.defaultParams, null, 2));
    }
  };

  const handleProbe = async () => {
    setProbing(true);
    try {
      const res = await fetch(`/api/vua/adapters/${selectedId}/probe`, { method: 'POST' });
      const data = await res.json();
      setProbeResult(data);
    } catch (err: any) {
      setProbeResult({ status: 'degraded', error: err.message });
    } finally {
      setProbing(false);
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    let parsedPayload: Record<string, unknown> = {};
    let parsedTarget: Record<string, unknown> = {};
    try {
      if (payloadText.trim()) parsedPayload = JSON.parse(payloadText);
      if (targetText.trim()) parsedTarget = JSON.parse(targetText);
    } catch (parseErr: any) {
      setError(`JSON Inválido: ${parseErr.message}`);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/vua/adapters/${selectedId}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: selectedAction,
          target: parsedTarget,
          payload: parsedPayload,
          approval_token: approvalToken || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Falha na execução do adaptador: HTTP ${res.status}`);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado durante a execução do adaptador VUA');
    } finally {
      setLoading(false);
    }
  };

  const handleRunConformance = async () => {
    setConformanceRunning(true);
    try {
      const res = await fetch('/api/vua/conformance', { method: 'POST' });
      const data = await res.json();
      setConformanceResult(data);
    } catch (err: any) {
      setConformanceResult({ status: 'FAIL', error: err.message });
    } finally {
      setConformanceRunning(false);
    }
  };

  const adapterIcons = {
    github: Github,
    linux: Terminal,
    android: Smartphone,
    windows: Monitor,
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">
                VUA • VORTEX UNIVERSAL CONNECTOR
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                MULTI-PLATFORM ADAPTERS: 4/4 ACTIVE
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                ED25519 GOVERNANCE
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              VUA — Conectores Universais Governamentais
            </h2>
            <p className="text-xs text-zinc-400 max-w-3xl mt-1 leading-relaxed">
              O <strong>Vortex Universal Connector (VUA)</strong> oferece adaptadores nativos e auditáveis para{' '}
              <strong>GitHub (VCS)</strong>, <strong>Ambiente Linux (POSIX)</strong>,{' '}
              <strong>Android (AOSP/ADB)</strong> e <strong>Windows (Win32/NT)</strong>. Cada operação é executada sob
              fronteiras restritas de sandbox, emitindo provas criptográficas <code className="text-cyan-300">ExecutionProof v1</code> canônicas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleRunConformance}
              disabled={conformanceRunning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/90 text-xs text-cyan-300 border border-cyan-500/40 font-semibold transition"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${conformanceRunning ? 'animate-spin' : 'text-cyan-400'}`} />
              {conformanceRunning ? 'Executando Testes...' : 'Rodar Conformance (4 Ambientes)'}
            </button>

            <button
              type="button"
              onClick={handleProbe}
              disabled={probing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 border border-zinc-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${probing ? 'animate-spin' : ''}`} />
              {probing ? 'Verificando...' : 'Testar Ambiente'}
            </button>
          </div>
        </div>
      </div>

      {/* Conformance Results Card (if run) */}
      {conformanceResult && (
        <div className={`rounded-xl border p-4 text-xs space-y-3 ${
          conformanceResult.status === 'PASS'
            ? 'border-emerald-500/40 bg-emerald-950/20 text-emerald-300'
            : 'border-rose-500/40 bg-rose-950/20 text-rose-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {conformanceResult.suite} — {conformanceResult.status === 'PASS' ? '100% PASS' : 'FAIL'}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-300">
                {conformanceResult.passed_tests}/{conformanceResult.total_tests} Adaptadores Aprovados
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConformanceResult(null)}
              className="text-zinc-400 hover:text-zinc-200 text-xs underline"
            >
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {conformanceResult.results?.map((r: any, idx: number) => (
              <div key={idx} className="bg-zinc-950/70 border border-zinc-800/80 p-2.5 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs font-mono font-semibold">
                  <span className="capitalize text-white">{r.adapter}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    r.passed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {r.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate">Ação: {r.action}</div>
                <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                  <span>Prova Ed25519: {r.proof_verified ? 'Válida' : 'Falha'}</span>
                  <span>{r.duration_ms}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Adapter Selector Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* GitHub Card */}
        <button
          type="button"
          onClick={() => setSelectedId('github')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedId === 'github'
              ? 'border-cyan-500 bg-cyan-950/20 shadow-md ring-1 ring-cyan-500/40'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-800 text-white">
                <Github className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">GitHub</div>
                <div className="text-[10px] text-zinc-400">Cloud VCS & Actions</div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRONTO
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 line-clamp-2">
            Verificação de commits assinados, branch protection e propostas de PR com hash canônico RFC 8785.
          </p>
        </button>

        {/* Linux Card */}
        <button
          type="button"
          onClick={() => setSelectedId('linux')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedId === 'linux'
              ? 'border-cyan-500 bg-cyan-950/20 shadow-md ring-1 ring-cyan-500/40'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-800 text-amber-400">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Linux POSIX</div>
                <div className="text-[10px] text-zinc-400">Sandbox & cgroups v2</div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ONLINE
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 line-clamp-2">
            Sandbox jail em /tmp/vua-sandbox, auditoria de permissões octais POSIX e monitoramento de cgroups.
          </p>
        </button>

        {/* Android Card */}
        <button
          type="button"
          onClick={() => setSelectedId('android')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedId === 'android'
              ? 'border-cyan-500 bg-cyan-950/20 shadow-md ring-1 ring-cyan-500/40'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-800 text-emerald-400">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Android AOSP</div>
                <div className="text-[10px] text-zinc-400">ADB & APK Integrity</div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRONTO
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 line-clamp-2">
            Bridge de comandos ADB shell, auditoria de assinatura APK v2/v3 e isolamento Scoped Storage.
          </p>
        </button>

        {/* Windows Card */}
        <button
          type="button"
          onClick={() => setSelectedId('windows')}
          className={`p-4 rounded-xl border text-left transition-all ${
            selectedId === 'windows'
              ? 'border-cyan-500 bg-cyan-950/20 shadow-md ring-1 ring-cyan-500/40'
              : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-zinc-800 text-blue-400">
                <Monitor className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Windows NT</div>
                <div className="text-[10px] text-zinc-400">PowerShell & NTFS ACLs</div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRONTO
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 line-clamp-2">
            Modo ConstrainedLanguage do PowerShell, auditoria de DACL NTFS, blindagem de registro e WSL2.
          </p>
        </button>
      </div>

      {/* Main Interactive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Action Console */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-cyan-400" />
                Ações Suportadas ({currentAdapter?.name})
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                {currentAdapter?.environment}
              </span>
            </div>

            {/* Actions list */}
            <div className="space-y-2">
              {currentAdapter?.supportedActions.map((act) => (
                <button
                  key={act.action}
                  type="button"
                  onClick={() => handleActionSelect(act.action)}
                  className={`w-full p-2.5 rounded-lg border text-left transition ${
                    selectedAction === act.action
                      ? 'border-cyan-500 bg-cyan-950/30 text-white'
                      : 'border-zinc-800/80 bg-zinc-950/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-mono text-xs font-semibold text-zinc-200">
                    <span className="text-cyan-300">{act.action}</span>
                    {act.requiresApproval && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        REQUER TOKEN
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 leading-snug">{act.description}</div>
                </button>
              ))}
            </div>

            {/* Target configuration */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block flex items-center justify-between">
                <span>Alvo da Operação (target JSON)</span>
                <span className="text-[10px] text-zinc-500 font-mono">vua://{selectedId}/{selectedAction}</span>
              </label>
              <textarea
                value={targetText}
                onChange={(e) => setTargetText(e.target.value)}
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Payload configuration */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Parâmetros da Ação (payload JSON)
              </label>
              <textarea
                value={payloadText}
                onChange={(e) => setPayloadText(e.target.value)}
                rows={4}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Approval Token (if needed) */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">
                Token de Aprovação Humana (Opcional / Ações Destrutivas)
              </label>
              <input
                type="text"
                value={approvalToken}
                onChange={(e) => setApprovalToken(e.target.value)}
                placeholder="TOKEN-VORTEX-APPROVE-..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Submit button */}
            <button
              type="button"
              onClick={handleExecute}
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white shadow-lg transition ${
                loading
                  ? 'bg-cyan-800/50 cursor-not-allowed'
                  : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Executando via VUA Gateway...
                </>
              ) : (
                <>
                  Executar no Adaptador VUA
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>

          {/* Environment Probe Result Card */}
          {probeResult && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-2 text-xs">
              <div className="font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                Diagnóstico do Adaptador ({probeResult.adapter})
              </div>
              <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800/80 font-mono text-[11px] text-zinc-300">
                <pre>{JSON.stringify(probeResult.metrics || probeResult, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Results & Cryptographic Audit */}
        <div className="lg:col-span-7 space-y-4">
          {/* Error display */}
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Falha na Execução do Adaptador VUA
              </div>
              <p className="font-mono text-zinc-200">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!result && !error && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-12 text-center space-y-3">
              <Layers className="w-10 h-10 text-zinc-600 mx-auto" />
              <h4 className="text-sm font-semibold text-zinc-300">Nenhuma Ação Executada</h4>
              <p className="text-xs text-zinc-500 max-w-md mx-auto">
                Selecione um adaptador (GitHub, Linux, Android ou Windows), ajuste os parâmetros e clique em{' '}
                <strong>"Executar no Adaptador VUA"</strong> para visualizar a saída governada e a prova criptográfica.
              </p>
            </div>
          )}

          {/* Results display */}
          {result && (
            <div className="space-y-4">
              {/* Output Header */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-xs text-white">Execução Governada VUA Concluída</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-cyan-300 border border-zinc-700">
                      {result.adapter} : {result.action}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-400">
                    <span>
                      Ambiente: <strong className="text-zinc-200">{result.environment}</strong>
                    </span>
                    <span>
                      Latência: <strong className="text-cyan-300">{result.durationMs}ms</strong>
                    </span>
                  </div>
                </div>

                {/* Data JSON */}
                <div>
                  <div className="text-xs font-semibold text-zinc-400 mb-1">Dados de Retorno do Adaptador</div>
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 font-mono text-[11px] text-zinc-200 max-h-64 overflow-y-auto">
                    <pre>{JSON.stringify(result.data, null, 2)}</pre>
                  </div>
                </div>

                {/* Audit Log */}
                {result.auditLog && result.auditLog.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-zinc-400 mb-1">Trilha de Auditoria do Adaptador</div>
                    <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800/80 font-mono text-[11px] text-zinc-400 space-y-1 max-h-36 overflow-y-auto">
                      {result.auditLog.map((log: string, idx: number) => (
                        <div key={idx} className="text-zinc-300">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Cryptographic ExecutionProof Card */}
              {result.execution_proof && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-cyan-400" />
                      <span className="text-xs font-bold text-cyan-300">
                        Prova Criptográfica de Execução VUA (RFC 8785 + Ed25519)
                      </span>
                    </div>

                    {result.verification?.valid ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        100% VERIFICADO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-950 border border-amber-500/40 text-amber-300">
                        AUDITORIA PENDENTE
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-zinc-400">
                    <div>
                      <span className="text-zinc-500">Hash de Entrada JCS:</span>
                      <div className="text-zinc-300 truncate" title={result.execution_proof.input_hash}>
                        {result.execution_proof.input_hash}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Hash de Saída JCS:</span>
                      <div className="text-zinc-300 truncate" title={result.execution_proof.output_hash}>
                        {result.execution_proof.output_hash}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Chave Ed25519 Emissora:</span>
                      <div className="text-cyan-300 truncate">{result.execution_proof.key_id}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Assinatura Digital Ed25519:</span>
                      <div className="text-emerald-400 truncate">{result.execution_proof.signature.substring(0, 32)}...</div>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSendToVerifier(result.execution_proof)}
                      className="flex items-center gap-1.5 text-xs text-cyan-300 hover:text-cyan-200 underline font-medium"
                    >
                      Abrir no Verificador Independente
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
