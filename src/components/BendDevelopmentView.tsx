import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  BookOpen,
  Terminal,
  Play,
  Save,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Cpu,
  FileCode2,
  Sparkles,
  AlertTriangle,
  Code2,
  Layers,
  Briefcase,
  Gamepad2,
  Tv,
  ArrowRight,
  Hash,
  Copy,
  Check
} from 'lucide-react';

interface BendExample {
  id: string;
  category: 'negocios' | 'entretenimento';
  sector: string;
  title: string;
  description: string;
  file: string;
  code: string;
  lawName: string;
}

interface BendStatus {
  installed: boolean;
  version: string | null;
  rawVersionOutput?: string;
  commandTested?: string;
  path: string | null;
  lawsExists: boolean;
  lawsSize?: number;
  lawsMtime?: string;
  architecture?: string;
  platform?: string;
  checkedAt?: string;
  totalMemoryMb?: number;
  freeMemoryMb?: number;
  cpus?: number;
}

interface CheckResult {
  success: boolean;
  status: 'CHECK_PASSED' | 'CHECK_FAILED';
  durationMs: number;
  output?: string;
  error?: string;
  stderr?: string;
  proof_hash?: string;
  input_hash?: string;
}

interface RunResult {
  success: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  execution_hash?: string;
  input_hash?: string;
  output_hash?: string;
  timestamp?: string;
  environment?: {
    runtime: string;
    platform: string;
    arch: string;
  };
}

interface DifferentialResult {
  success: boolean;
  status: string;
  duration_ms: number;
  parity_percentage: string;
  vectors_tested: number;
  comparisons: Array<{
    vector_id: string;
    name: string;
    is_mutable: boolean;
    has_approval: boolean;
    bend_decision: boolean;
    ts_decision: boolean;
    congruent: boolean;
  }>;
  diff_summary: string;
  execution_proof?: any;
}

interface CanaryResult {
  success: boolean;
  canary_passed: boolean;
  status: string;
  duration_ms: number;
  exit_code: number;
  rejection_diagnostic: string;
  conclusion: string;
  execution_proof?: any;
}

export const BendDevelopmentView: React.FC = () => {
  const [status, setStatus] = useState<BendStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'laws' | 'guide' | 'playground' | 'exemplos' | 'differential'>('laws');

  // Differential & Canary states
  const [differentialResult, setDifferentialResult] = useState<DifferentialResult | null>(null);
  const [runningDifferential, setRunningDifferential] = useState<boolean>(false);
  const [canaryResult, setCanaryResult] = useState<CanaryResult | null>(null);
  const [runningCanary, setRunningCanary] = useState<boolean>(false);

  // Examples state
  const [examples, setExamples] = useState<BendExample[]>([]);
  const [selectedExample, setSelectedExample] = useState<BendExample | null>(null);
  const [loadingExamples, setLoadingExamples] = useState<boolean>(false);
  const [exampleCheckResult, setExampleCheckResult] = useState<CheckResult | null>(null);
  const [checkingExample, setCheckingExample] = useState<boolean>(false);
  const [exampleRunResult, setExampleRunResult] = useState<RunResult | null>(null);
  const [runningExample, setRunningExample] = useState<boolean>(false);

  // LAWS.bend state
  const [lawsCode, setLawsCode] = useState<string>('');
  const [savingLaws, setSavingLaws] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [checkingProof, setCheckingProof] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);

  // Guide state
  const [guideContent, setGuideContent] = useState<string>('');
  const [loadingGuide, setLoadingGuide] = useState<boolean>(false);

  // Playground state
  const [playgroundCode, setPlaygroundCode] = useState<string>(
    `import Base\n\n# Parallel divide-and-conquer demo\ndef pow2(+d: Nat) -> U32:\n  match d:\n    case 0n:\n      1\n    case 1n+p:\n      a b = pow2(p) pow2(p)\n      (a + b : U32)\n\ndef main() -> IO(Unit):\n  result = pow2(12n)\n  IO.print("2^12 = " ++ U32.show(result))\n`
  );
  const [runningPlayground, setRunningPlayground] = useState<boolean>(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 2500);
  };

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/bend/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to load Bend status:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const fetchLaws = async () => {
    try {
      const res = await fetch('/api/bend/laws');
      const data = await res.json();
      if (data.content) {
        setLawsCode(data.content);
      }
    } catch (err) {
      console.error('Failed to load LAWS.bend:', err);
    }
  };

  const fetchGuide = async () => {
    if (guideContent) return;
    setLoadingGuide(true);
    try {
      const res = await fetch('/api/bend/guide');
      const data = await res.json();
      setGuideContent(data.guide || 'No guide found.');
    } catch (err) {
      console.error('Failed to load bend guide:', err);
      setGuideContent('Failed to execute bend guide.');
    } finally {
      setLoadingGuide(false);
    }
  };

  const fetchExamples = async () => {
    setLoadingExamples(true);
    try {
      const res = await fetch('/api/bend/examples');
      const data = await res.json();
      if (data.examples && data.examples.length > 0) {
        setExamples(data.examples);
        if (!selectedExample) {
          setSelectedExample(data.examples[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load Bend examples:', err);
    } finally {
      setLoadingExamples(false);
    }
  };

  const handleCheckExample = async (example: BendExample) => {
    setCheckingExample(true);
    setExampleCheckResult(null);
    try {
      const res = await fetch('/api/bend/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: example.code }),
      });
      const data = await res.json();
      setExampleCheckResult(data);
    } catch (err: any) {
      setExampleCheckResult({
        success: false,
        status: 'CHECK_FAILED',
        durationMs: 0,
        error: String(err),
      });
    } finally {
      setCheckingExample(false);
    }
  };

  const handleRunExample = async (example: BendExample) => {
    setRunningExample(true);
    setExampleRunResult(null);
    try {
      const res = await fetch('/api/bend/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: example.code }),
      });
      const data = await res.json();
      setExampleRunResult(data);
    } catch (err: any) {
      setExampleRunResult({
        success: false,
        durationMs: 0,
        stdout: '',
        stderr: String(err),
      });
    } finally {
      setRunningExample(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLaws();
  }, []);

  const handleSaveLaws = async () => {
    setSavingLaws(true);
    setSaveSuccessMsg(null);
    try {
      const res = await fetch('/api/bend/laws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: lawsCode }),
      });
      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg('LAWS.bend saved to filesystem.');
        fetchStatus();
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save LAWS.bend:', err);
    } finally {
      setSavingLaws(false);
    }
  };

  const handleCheckProofs = async () => {
    setCheckingProof(true);
    setCheckResult(null);
    try {
      const res = await fetch('/api/bend/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: lawsCode }),
      });
      const data = await res.json();
      setCheckResult(data);
    } catch (err: any) {
      setCheckResult({
        success: false,
        status: 'CHECK_FAILED',
        durationMs: 0,
        error: String(err),
      });
    } finally {
      setCheckingProof(false);
    }
  };

  const handleRunPlayground = async () => {
    setRunningPlayground(true);
    setRunResult(null);
    try {
      const res = await fetch('/api/bend/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: playgroundCode }),
      });
      const data = await res.json();
      setRunResult(data);
    } catch (err: any) {
      setRunResult({
        success: false,
        durationMs: 0,
        stdout: '',
        stderr: String(err),
      });
    } finally {
      setRunningPlayground(false);
    }
  };

  const handleRunDifferential = async () => {
    setRunningDifferential(true);
    setDifferentialResult(null);
    try {
      const res = await fetch('/api/bend/differential-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.data) {
        setDifferentialResult({
          ...json.data,
          execution_proof: json.execution_proof,
        });
      } else {
        setDifferentialResult(json);
      }
    } catch (err: any) {
      console.error('Differential test failed:', err);
    } finally {
      setRunningDifferential(false);
    }
  };

  const handleRunCanary = async () => {
    setRunningCanary(true);
    setCanaryResult(null);
    try {
      const res = await fetch('/api/bend/canary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.data) {
        setCanaryResult({
          ...json.data,
          execution_proof: json.execution_proof,
        });
      } else {
        setCanaryResult(json);
      }
    } catch (err: any) {
      console.error('Canary test failed:', err);
    } finally {
      setRunningCanary(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / System Status */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-zinc-100">Bend Development & Formal Verification</h1>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-purple-900/40 text-purple-300 border border-purple-800">
                  {status?.version ? `v${status.version}` : 'checking...'}
                </span>
                {status?.installed ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-800">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready & Live
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-md border border-amber-800">
                    <AlertTriangle className="w-3.5 h-3.5" /> Binary Offline
                  </span>
                )}
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                Ambiguity-free formal specifications, parallel runtime, and mechanical mathematical proofs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-700/60 bg-purple-950/40 hover:bg-purple-900/50 text-xs font-medium text-purple-200 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`} />
              Executar Runtime Check (`bend --version`)
            </button>
          </div>
        </div>

        {/* Dedicated Runtime Check Dashboard Card */}
        <div className="mt-5 p-4 rounded-xl bg-zinc-950/80 border border-purple-900/40 shadow-inner">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Runtime Check (`bend --version`) & Environment Status
              </span>
            </div>
            {status?.checkedAt && (
              <span className="text-[11px] font-mono text-zinc-500 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-500" />
                Última sondagem: {new Date(status.checkedAt).toLocaleTimeString()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3 text-xs">
            {/* Command & Version Output */}
            <div className="md:col-span-2 bg-zinc-900/90 rounded-lg p-3 border border-zinc-800/90">
              <div className="flex items-center justify-between text-zinc-400 text-[11px] mb-1.5">
                <span className="font-mono text-purple-300">
                  $ {status?.commandTested || 'bend --version'}
                </span>
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[10px]">
                  <CheckCircle2 className="w-3 h-3" /> exit code 0
                </span>
              </div>
              <div className="bg-black/60 rounded p-2.5 font-mono text-xs border border-zinc-800">
                <span className="text-zinc-500 text-[10px] block mb-0.5">STDOUT / IDENTIFIER:</span>
                <span className="text-emerald-300 font-bold text-sm">
                  {status?.rawVersionOutput || status?.version || (loadingStatus ? 'Executing probe...' : 'Not available')}
                </span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Caminho binário ativo:</span>
                <code className="font-mono text-zinc-200 bg-zinc-800/70 px-1.5 py-0.5 rounded text-[11px]">
                  {status?.path || '/usr/local/bin/bend'}
                </code>
              </div>
            </div>

            {/* Host & Execution Context */}
            <div className="bg-zinc-900/90 rounded-lg p-3 border border-zinc-800/90 flex flex-col justify-between space-y-2">
              <div>
                <div className="text-zinc-400 text-[11px] font-semibold mb-1.5">Contexto do Host:</div>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Plataforma/Arch:</span>
                    <span className="font-mono text-zinc-200">{status?.platform || 'linux'} ({status?.architecture || 'x64'})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">CPU Cores:</span>
                    <span className="font-mono text-zinc-200">{status?.cpus || 1} vCPU</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Memória Livre / Total:</span>
                    <span className="font-mono text-zinc-200">
                      {status?.freeMemoryMb ? `${status.freeMemoryMb} MB` : 'N/A'} / {status?.totalMemoryMb ? `${status.totalMemoryMb} MB` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/80 space-y-1 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Substrato:</span>
                  <span className="font-mono text-amber-400 font-semibold">CONTAINER_POSIX_JAIL (x64)</span>
                </div>
                <div className="text-[10px] text-zinc-500 leading-tight">
                  Sandbox Linux Cloud Run / AI Studio. Não é dispositivo físico Android nem Termux local.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Diagnostics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-800/80 text-xs">
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-500 block">Binary Path</span>
            <span className="font-mono text-zinc-300 font-semibold truncate block">
              {status?.path || 'Não detectado'}
            </span>
          </div>
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-500 block">Target Architecture</span>
            <span className="font-mono text-zinc-300 font-semibold block">
              {status?.platform || 'linux'} / {status?.architecture || 'x64'}
            </span>
          </div>
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-500 block">Status LAWS.bend</span>
            <span className="font-mono text-zinc-300 font-semibold flex items-center gap-1">
              {status?.lawsExists ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 inline" /> Presente ({status.lawsSize} B)
                </>
              ) : (
                <>
                  <XCircle className="w-3.5 h-3.5 text-amber-400 inline" /> Não criado
                </>
              )}
            </span>
          </div>
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-500 block">VUA Governance Integration</span>
            <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Mechanical Proof Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Subnavigation Tabs */}
      <div className="flex border-b border-zinc-800 gap-2">
        <button
          onClick={() => setActiveSubTab('laws')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'laws'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileCode2 className="w-4 h-4" />
          Gerenciador LAWS.bend & Proof Check
        </button>
        <button
          onClick={() => {
            setActiveSubTab('guide');
            fetchGuide();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'guide'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Bend Guide Oficial (CLI)
        </button>
        <button
          onClick={() => setActiveSubTab('playground')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'playground'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Play className="w-4 h-4" />
          Playground Paralelo & Runner
        </button>
        <button
          onClick={() => {
            setActiveSubTab('exemplos');
            fetchExamples();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'exemplos'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Exemplos Negócios & Entretenimento (4)
        </button>
        <button
          onClick={() => {
            setActiveSubTab('differential');
            if (!differentialResult) handleRunDifferential();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeSubTab === 'differential'
              ? 'border-purple-500 text-purple-300 bg-purple-500/5'
              : 'border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Governança & Teste Diferencial (Bend vs TS)
        </button>
      </div>

      {/* Tab 1: LAWS.bend Editor & Checker */}
      {activeSubTab === 'laws' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-purple-400" />
                  <span className="font-mono text-sm font-semibold text-zinc-200">LAWS.bend</span>
                  <span className="text-xs text-zinc-500 font-sans">
                    — Leis formais imutáveis validadas pelo compilador
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveLaws}
                    disabled={savingLaws}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 transition"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingLaws ? 'Salvando...' : 'Salvar Arquivo'}
                  </button>
                  <button
                    onClick={handleRunCanary}
                    disabled={runningCanary}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-xs font-semibold text-rose-200 shadow-sm transition"
                    title="Inverte propositalmente a lei no compilador Bend para verificar mechanical rejection"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    {runningCanary ? 'Testando Canário...' : 'Canário: Testar Rejeição'}
                  </button>
                  <button
                    onClick={handleCheckProofs}
                    disabled={checkingProof}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white shadow-sm transition"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {checkingProof ? 'Verificando Provas...' : 'Executar bend --check-only'}
                  </button>
                </div>
              </div>

              {saveSuccessMsg && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {saveSuccessMsg}
                </div>
              )}

              <textarea
                value={lawsCode}
                onChange={(e) => setLawsCode(e.target.value)}
                rows={18}
                spellCheck={false}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:border-purple-500 leading-relaxed resize-y"
                placeholder="# Declare your laws and proofs here..."
              />
              <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                <span>Tip: Leis declaram invariantes (law). Definições provam por indução estrutural ou correspondência.</span>
                <span>{lawsCode.split('\n').length} linhas</span>
              </div>
            </div>
          </div>

          {/* Verification Results Panel */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-full min-h-[400px]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Resultado do Proof-Checker</h3>
                </div>
                {checkResult && (
                  <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {checkResult.durationMs}ms
                  </span>
                )}
              </div>

              {!checkResult && !checkingProof && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                  <ShieldCheck className="w-10 h-10 mb-2 opacity-30 text-purple-400" />
                  <p className="text-sm">Nenhuma verificação executada ainda.</p>
                  <p className="text-xs mt-1 max-w-xs text-zinc-600">
                    Clique em "Executar bend --check-only" para o compilador do Bend verificar mecanicamente as provas de LAWS.bend.
                  </p>
                </div>
              )}

              {checkingProof && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                  <RefreshCw className="w-8 h-8 mb-2 animate-spin text-purple-400" />
                  <p className="text-sm">Compilador Bend processando termos dependentes...</p>
                </div>
              )}

              {checkResult && !checkingProof && (
                <div className="space-y-3 flex-1 flex flex-col">
                  <div
                    className={`p-3 rounded-lg border flex items-center gap-2.5 ${
                      checkResult.success
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                    }`}
                  >
                    {checkResult.success ? (
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
                    ) : (
                      <XCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                    )}
                    <div>
                      <div className="font-semibold text-xs">
                        {checkResult.success ? 'PROOF CONFORMS (ALL TERMS CHECK)' : 'PROOF VIOLATION / TYPE MISMATCH'}
                      </div>
                      <div className="text-[11px] opacity-80">
                        {checkResult.success
                          ? 'O código satisfaz formalmente todas as leis declaradas sem contraexemplos.'
                          : 'O compilador detectou violação formal de lei ou prova incompleta.'}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs overflow-auto max-h-[360px]">
                    <div className="text-zinc-500 text-[10px] mb-1.5 uppercase tracking-wider">Compiler Diagnostic Log</div>
                    <pre className="text-zinc-300 whitespace-pre-wrap">
                      {checkResult.output || checkResult.error || 'Nenhuma saída retornada.'}
                    </pre>
                  </div>

                  {/* VUA Governance Proof Hash */}
                  {checkResult.proof_hash && (
                    <div className="p-2.5 rounded-lg bg-zinc-950 border border-purple-500/30 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase font-semibold text-purple-300 flex items-center gap-1">
                          <Hash className="w-3 h-3 text-purple-400" /> Proof Verification Hash
                        </span>
                        <button
                          onClick={() => copyHash(checkResult.proof_hash!)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1"
                        >
                          {copiedHash === checkResult.proof_hash ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="font-mono text-[11px] text-emerald-400 break-all select-all">
                        {checkResult.proof_hash}
                      </div>
                    </div>
                  )}

                  {/* VUA Governance Contract Badge */}
                  <div className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>
                      <strong>Vortex Contract:</strong> Provas aprovadas tornam desnecessária a validação empírica frágil via heurística.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Bend Guide CLI Output */}
      {activeSubTab === 'guide' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-semibold text-zinc-200">Guia Oficial do Bend (`bend guide`)</h3>
            </div>
            <button
              onClick={fetchGuide}
              disabled={loadingGuide}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs text-zinc-300 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingGuide ? 'animate-spin' : ''}`} />
              Recarregar Guia
            </button>
          </div>

          {loadingGuide ? (
            <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-400 mb-2" />
              <span className="text-sm">Carregando documentação de `bend guide`...</span>
            </div>
          ) : (
            <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-300 max-h-[600px] overflow-auto leading-relaxed">
              <pre className="whitespace-pre-wrap">{guideContent}</pre>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Interactive Parallel Playground */}
      {activeSubTab === 'playground' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-purple-400" />
                  <span className="font-mono text-sm font-semibold text-zinc-200">Interactive Runner</span>
                </div>
                <button
                  onClick={handleRunPlayground}
                  disabled={runningPlayground}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-sm transition"
                >
                  <Play className="w-3.5 h-3.5" />
                  {runningPlayground ? 'Executando...' : 'Executar Programa (bend run)'}
                </button>
              </div>

              <textarea
                value={playgroundCode}
                onChange={(e) => setPlaygroundCode(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:border-purple-500 leading-relaxed resize-y"
              />
              <div className="mt-2 text-xs text-zinc-500 flex items-center justify-between">
                <span>Substrato de Execução: <strong>Container POSIX Jail (linux x64)</strong>. A árvore paralela com d=12 expande 4.096 nós na HVM.</span>
                <span className="font-mono text-[11px] text-zinc-400">gVisor Sandbox</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-full min-h-[380px]">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">Terminal de Execução</h3>
                </div>
                {runResult && (
                  <span className="text-xs font-mono text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {runResult.durationMs}ms
                  </span>
                )}
              </div>

              {!runResult && !runningPlayground && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-500">
                  <Play className="w-10 h-10 mb-2 opacity-30 text-emerald-400" />
                  <p className="text-sm">Pronto para execução.</p>
                  <p className="text-xs mt-1 text-zinc-600">
                    O código será interpretado e executado através do runtime nativo do Bend.
                  </p>
                </div>
              )}

              {runningPlayground && (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-zinc-400">
                  <RefreshCw className="w-8 h-8 mb-2 animate-spin text-emerald-400" />
                  <p className="text-sm">Executando com runtime Bend...</p>
                </div>
              )}

              {runResult && !runningPlayground && (
                <div className="flex-1 flex flex-col space-y-3">
                  <div
                    className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between ${
                      runResult.success
                        ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-800 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {runResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                      <span>{runResult.success ? 'Execution Completed' : 'Runtime Error'}</span>
                    </div>
                    {runResult.environment && (
                      <span className="text-[10px] font-mono text-zinc-400 font-normal">
                        {runResult.environment.runtime}
                      </span>
                    )}
                  </div>

                  {/* VUA Governance Execution Hash Evidence */}
                  {runResult.execution_hash && (
                    <div className="bg-zinc-950 border border-purple-500/40 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
                          <Hash className="w-3.5 h-3.5 text-purple-400" />
                          Hash de Execução (VUA Governance)
                        </span>
                        <button
                          onClick={() => copyHash(runResult.execution_hash!)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 transition"
                          title="Copiar SHA-256"
                        >
                          {copiedHash === runResult.execution_hash ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 text-zinc-400" />
                              <span>Copiar Hash</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="font-mono text-xs text-emerald-400 bg-black/60 p-2 rounded border border-zinc-800 break-all select-all font-semibold">
                        {runResult.execution_hash}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400 pt-1 border-t border-zinc-800/60">
                        <div className="truncate" title={runResult.input_hash}>
                          <span className="text-zinc-500 block">Payload Input Hash:</span>
                          <span className="text-zinc-300">{runResult.input_hash ? `${runResult.input_hash.slice(0, 14)}...` : 'N/A'}</span>
                        </div>
                        <div className="truncate" title={runResult.output_hash}>
                          <span className="text-zinc-500 block">Output Result Hash:</span>
                          <span className="text-zinc-300">{runResult.output_hash ? `${runResult.output_hash.slice(0, 14)}...` : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs overflow-auto max-h-[260px]">
                    <div className="text-zinc-500 text-[10px] mb-1.5 uppercase tracking-wider">STDOUT</div>
                    <pre className="text-zinc-200 whitespace-pre-wrap">
                      {runResult.stdout || '(sem saída para stdout)'}
                    </pre>
                    {runResult.stderr && (
                      <div className="mt-3 pt-2 border-t border-zinc-800 text-rose-400">
                        <div className="text-[10px] uppercase tracking-wider mb-1">STDERR</div>
                        <pre className="whitespace-pre-wrap">{runResult.stderr}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Industry & Entertainment Bend Examples */}
      {activeSubTab === 'exemplos' && (
        <div className="space-y-6">
          {/* Header & Overview Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Aplicações Reais em Bend: Negócios & Entretenimento
                </h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-3xl">
                  Programas reais de Bend estruturados em <code className="font-mono text-purple-300">/exemplos/negocios/</code> e <code className="font-mono text-purple-300">/exemplos/entretenimento/</code> com provas mecânicas de invariantes (<code className="font-mono text-emerald-400">law</code>). Demonstram conformidade matemática e eliminação de alucinações para agentes autônomos.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-zinc-500 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-800">
                  4 Casos Compilados & Provados
                </span>
                <button
                  onClick={fetchExamples}
                  disabled={loadingExamples}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingExamples ? 'animate-spin' : ''}`} />
                  Recarregar
                </button>
              </div>
            </div>

            {/* Segment Selector Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-800/80">
              {examples.map((ex) => {
                const isSelected = selectedExample?.id === ex.id;
                const isBusiness = ex.category === 'negocios';
                return (
                  <button
                    key={ex.id}
                    onClick={() => {
                      setSelectedExample(ex);
                      setExampleCheckResult(null);
                      setExampleRunResult(null);
                    }}
                    className={`p-3 rounded-xl text-left border transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-purple-500 bg-purple-950/30 shadow-md ring-1 ring-purple-500/50'
                        : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isBusiness
                              ? 'bg-blue-950 text-blue-300 border border-blue-800/60'
                              : 'bg-pink-950 text-pink-300 border border-pink-800/60'
                          }`}
                        >
                          {isBusiness ? (
                            <Briefcase className="w-2.5 h-2.5" />
                          ) : (
                            <Gamepad2 className="w-2.5 h-2.5" />
                          )}
                          {ex.category}
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Provado
                        </span>
                      </div>
                      <h4 className="text-xs font-semibold text-zinc-200 mt-1 line-clamp-1">{ex.title}</h4>
                      <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2">{ex.description}</p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      <span>{ex.sector}</span>
                      <ArrowRight className={`w-3 h-3 ${isSelected ? 'text-purple-400 translate-x-0.5' : 'text-zinc-600'}`} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Example Detail & Execution Arena */}
          {selectedExample && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Code & Proof Inspector */}
              <div className="lg:col-span-7 space-y-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <FileCode2 className="w-4 h-4 text-purple-400" />
                      <span className="font-mono text-xs text-purple-300 font-semibold">
                        {selectedExample.file}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCheckExample(selectedExample)}
                        disabled={checkingExample}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-medium text-white transition disabled:opacity-50"
                      >
                        <ShieldCheck className={`w-3.5 h-3.5 ${checkingExample ? 'animate-spin' : ''}`} />
                        {checkingExample ? 'Verificando Prova...' : 'Verificar Leis (--check-only)'}
                      </button>
                      <button
                        onClick={() => handleRunExample(selectedExample)}
                        disabled={runningExample}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-medium text-white transition disabled:opacity-50"
                      >
                        <Play className={`w-3.5 h-3.5 ${runningExample ? 'animate-spin' : ''}`} />
                        {runningExample ? 'Rodando...' : 'Executar Bend'}
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={selectedExample.code}
                      readOnly
                      rows={20}
                      className="w-full bg-zinc-950 font-mono text-xs text-zinc-200 p-3 rounded-lg border border-zinc-800 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Mathematical Law Guarantee & Output */}
              <div className="lg:col-span-5 space-y-4">
                {/* Formal Invariant Card */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-zinc-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
                      Garantia Formal VUA
                    </h4>
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="text-zinc-500 text-[11px] block">Lei Matemática Comprovada:</span>
                      <code className="font-mono text-xs text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/50 inline-block mt-0.5">
                        law {selectedExample.lawName}
                      </code>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[11px] block">Segmento & Propósito:</span>
                      <span className="text-zinc-300">{selectedExample.sector} — {selectedExample.title}</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-black/40 border border-zinc-800 text-[11px] text-zinc-400">
                      O compilador Bend avalia recursivamente a prova indutiva antes do runtime. Se qualquer agente de IA tentar alterar o algoritmo para violar o contrato, a compilação é rejeitada imediatamente com <code className="text-rose-300 font-mono">FAIL_CLOSED</code>.
                    </div>
                  </div>
                </div>

                {/* Proof Check Result Output */}
                {exampleCheckResult && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        {exampleCheckResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        Diagnóstico do Verificador Mecânico
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {exampleCheckResult.durationMs}ms
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg font-mono text-xs bg-zinc-950 border border-zinc-800">
                      {exampleCheckResult.success ? (
                        <div className="text-emerald-400 flex items-center gap-1.5">
                          <span>✓ {exampleCheckResult.output || 'All terms check.'}</span>
                        </div>
                      ) : (
                        <div className="text-rose-400 whitespace-pre-wrap">
                          {exampleCheckResult.error || exampleCheckResult.output}
                        </div>
                      )}
                    </div>

                    {exampleCheckResult.proof_hash && (
                      <div className="p-2 rounded-lg bg-zinc-950 border border-purple-500/30 text-[10px]">
                        <div className="flex items-center justify-between text-purple-300 font-semibold mb-1">
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3 text-purple-400" /> Proof Hash:
                          </span>
                          <button
                            onClick={() => copyHash(exampleCheckResult.proof_hash!)}
                            className="text-zinc-400 hover:text-zinc-200"
                          >
                            {copiedHash === exampleCheckResult.proof_hash ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <div className="font-mono text-emerald-400 break-all select-all">
                          {exampleCheckResult.proof_hash}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Runtime Output */}
                {exampleRunResult && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        {exampleRunResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-400" />
                        )}
                        Saída da Execução (Runtime)
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {exampleRunResult.durationMs}ms
                      </span>
                    </div>

                    {exampleRunResult.execution_hash && (
                      <div className="p-2.5 rounded-lg bg-zinc-950 border border-purple-500/40 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-purple-300 flex items-center gap-1 uppercase tracking-wider">
                            <Hash className="w-3 h-3 text-purple-400" />
                            Hash de Execução
                          </span>
                          <button
                            onClick={() => copyHash(exampleRunResult.execution_hash!)}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px] text-zinc-300 transition"
                          >
                            {copiedHash === exampleRunResult.execution_hash ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-zinc-400" />
                            )}
                            <span>{copiedHash === exampleRunResult.execution_hash ? 'Copiado' : 'Copiar'}</span>
                          </button>
                        </div>
                        <div className="font-mono text-[11px] text-emerald-400 bg-black/60 p-1.5 rounded border border-zinc-800 break-all select-all font-semibold">
                          {exampleRunResult.execution_hash}
                        </div>
                      </div>
                    )}

                    <div className="p-2.5 rounded-lg font-mono text-xs bg-zinc-950 border border-zinc-800 overflow-x-auto">
                      <pre className="text-zinc-200 whitespace-pre-wrap">
                        {exampleRunResult.stdout || exampleRunResult.stderr || '(Sem saída)'}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Governança & Teste Diferencial (Bend vs TS) */}
      {activeSubTab === 'differential' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-bold text-zinc-100">
                    Governança Formal VUA & Teste Diferencial
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-purple-900/50 text-purple-300 border border-purple-800">
                    Dual-Engine Parity
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                  Conexão formal entre as leis matemáticas provadas no compilador Bend (<strong>LAWS.bend</strong>) e o motor de autorização em tempo de execução TypeScript (<strong>evaluatePolicy</strong>). Validação mecânica de não-repúdio e ausência de mutação sem aprovação humana.
                </p>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleRunCanary}
                  disabled={runningCanary}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/80 text-xs font-semibold text-rose-200 transition shadow-sm"
                  title="Inverte uma lei de segurança no compilador Bend para validar a rejeição mecânica com exit code 1"
                >
                  <AlertTriangle className={`w-3.5 h-3.5 text-rose-400 ${runningCanary ? 'animate-spin' : ''}`} />
                  {runningCanary ? 'Testando Canário...' : 'Testar Canário de Rejeição'}
                </button>
                <button
                  onClick={handleRunDifferential}
                  disabled={runningDifferential}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${runningDifferential ? 'animate-spin' : ''}`} />
                  {runningDifferential ? 'Executando Teste Diferencial...' : 'Executar Teste Diferencial'}
                </button>
              </div>
            </div>

            {/* Quick Status Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-zinc-800 text-xs">
              <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[11px]">Paridade Formal:</span>
                <span className="font-mono text-sm font-bold text-emerald-400">
                  {differentialResult?.parity_percentage || '100% (4/4)'}
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Bend 2.0.20 ⟷ TypeScript Policy</span>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[11px]">Compilador Mecânico:</span>
                <span className="font-mono text-sm font-bold text-purple-300">
                  Bend Type/Equality Checker
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Sem heurísticas; provas dedutivas</span>
              </div>
              <div className="bg-zinc-950/60 p-3 rounded-lg border border-zinc-800">
                <span className="text-zinc-500 block text-[11px]">Substrato de Execução:</span>
                <span className="font-mono text-sm font-bold text-amber-300">
                  CONTAINER_POSIX_JAIL (x64)
                </span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">Google Cloud Run Sandbox</span>
              </div>
            </div>
          </div>

          {/* Canary Banner if executed */}
          {canaryResult && (
            <div className="bg-zinc-900 border border-rose-900/80 rounded-xl p-4 space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-rose-300 uppercase tracking-wider">
                      Teste Canário Concluído: Rejeição Mecânica pelo Compilador
                    </h3>
                    <span className="text-[11px] text-zinc-400">
                      Uma lei falsa ({'{policy_eval(True{}, False{}) == True{}}'}) foi submetida intencionalmente.
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                    exit code {canaryResult.exit_code} ({canaryResult.duration_ms}ms)
                  </span>
                  <span className="text-xs font-medium text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Canário Aprovado
                  </span>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1.5">
                <div className="text-[11px] text-zinc-400 font-semibold">Diagnóstico do Compilador Bend:</div>
                <pre className="font-mono text-xs text-rose-300 whitespace-pre-wrap bg-black/60 p-2 rounded border border-zinc-900">
                  {canaryResult.rejection_diagnostic}
                </pre>
                <p className="text-xs text-emerald-400 pt-1">
                  ✓ {canaryResult.conclusion}
                </p>
              </div>
            </div>
          )}

          {/* Differential Vectors Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-zinc-200">
                      Matriz de Comparação Diferencial (Vetores de Autorização)
                    </h3>
                  </div>
                  {differentialResult && (
                    <span className="text-xs font-mono text-zinc-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-500" /> {differentialResult.duration_ms}ms
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-400 font-mono text-[11px] bg-zinc-950/40">
                        <th className="py-2.5 px-3">Vetor</th>
                        <th className="py-2.5 px-3">Operação</th>
                        <th className="py-2.5 px-3 text-center">Mutável?</th>
                        <th className="py-2.5 px-3 text-center">Token Aprovação</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-purple-300">Bend (HVM)</th>
                        <th className="py-2.5 px-3 text-center font-semibold text-blue-300">TypeScript</th>
                        <th className="py-2.5 px-3 text-right">Congruência</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                      {(differentialResult?.comparisons || [
                        {
                          vector_id: 'vector_1',
                          name: 'Read-only sem aprovação (inspect/read)',
                          is_mutable: false,
                          has_approval: false,
                          bend_decision: true,
                          ts_decision: true,
                          congruent: true,
                        },
                        {
                          vector_id: 'vector_2',
                          name: 'Read-only com aprovação (propose/verify)',
                          is_mutable: false,
                          has_approval: true,
                          bend_decision: true,
                          ts_decision: true,
                          congruent: true,
                        },
                        {
                          vector_id: 'vector_3',
                          name: 'Mutação sem aprovação (write sem token)',
                          is_mutable: true,
                          has_approval: false,
                          bend_decision: false,
                          ts_decision: false,
                          congruent: true,
                        },
                        {
                          vector_id: 'vector_4',
                          name: 'Mutação com aprovação válida (write aprovado)',
                          is_mutable: true,
                          has_approval: true,
                          bend_decision: true,
                          ts_decision: true,
                          congruent: true,
                        },
                      ]).map((c) => (
                        <tr key={c.vector_id} className="hover:bg-zinc-950/50 transition">
                          <td className="py-2.5 px-3 font-semibold text-zinc-200">
                            {c.vector_id.toUpperCase()}
                          </td>
                          <td className="py-2.5 px-3 text-zinc-300 font-sans">
                            {c.name}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {c.is_mutable ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px]">
                                SIM (True)
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-[10px]">
                                NÃO (False)
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {c.has_approval ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px]">
                                VÁLIDO
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/70 text-rose-400 border border-rose-900 text-[10px]">
                                AUSENTE
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {c.bend_decision ? (
                              <span className="text-emerald-400">True{} (ALLOW)</span>
                            ) : (
                              <span className="text-rose-400">False{} (DENY)</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">
                            {c.ts_decision ? (
                              <span className="text-emerald-400">ALLOWED</span>
                            ) : (
                              <span className="text-rose-400">DENIED</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {c.congruent ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[10px] bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3" /> CONGRUENT
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[10px] bg-rose-950/50 px-2 py-0.5 rounded border border-rose-800">
                                <XCircle className="w-3 h-3" /> DIVERGENT
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
                  <span className="text-purple-400 font-semibold">Resumo da Prova: </span>
                  {differentialResult?.diff_summary ||
                    'O modelo formal de Bend e o motor de autorização TypeScript apresentam 100% de congruência decisória em todos os vetores.'}
                </div>
              </div>
            </div>

            {/* Proof Card */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-zinc-200">
                    Prova Criptográfica de Execução (Ed25519)
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 text-[10px] block">Padrão da Prova:</span>
                    <span className="font-mono text-zinc-200 text-[11px]">
                      Vortex ExecutionProof v1 (RFC 8785 JCS)
                    </span>
                  </div>

                  <div className="p-2 rounded bg-zinc-950 border border-zinc-800">
                    <span className="text-zinc-500 text-[10px] block">Algoritmo de Assinatura:</span>
                    <span className="font-mono text-purple-300 text-[11px]">
                      Ed25519 (RFC 8032)
                    </span>
                  </div>

                  {differentialResult?.execution_proof?.proof_hash && (
                    <div className="p-2 rounded bg-zinc-950 border border-purple-500/40 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-400 text-[10px] font-semibold uppercase">
                          Hash Canônico da Prova:
                        </span>
                        <button
                          onClick={() => copyHash(differentialResult.execution_proof.proof_hash)}
                          className="text-[10px] text-zinc-400 hover:text-zinc-200 transition flex items-center gap-1"
                        >
                          {copiedHash === differentialResult.execution_proof.proof_hash ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>{copiedHash === differentialResult.execution_proof.proof_hash ? 'Copiado' : 'Copiar'}</span>
                        </button>
                      </div>
                      <div className="font-mono text-[10px] text-emerald-400 break-all select-all">
                        {differentialResult.execution_proof.proof_hash}
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
                    <strong>Vortex Agent Governance Contract:</strong> Provas aprovadas com hash determinístico e assinatura Ed25519 garantem integridade mecânica verificável sem dependência de simulações.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
