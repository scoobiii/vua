import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Shield,
  Key,
  Server,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Lock,
  ArrowRight,
  Terminal,
  Activity,
  HardDrive
} from 'lucide-react';
import type { ExecutionProof } from '../vortex/types.js';

interface LLMGatewayViewProps {
  onSendToVerifier: (proof: ExecutionProof) => void;
}

export const LLMGatewayView: React.FC<LLMGatewayViewProps> = ({ onSendToVerifier }) => {
  const [provider, setProvider] = useState<'gemini' | 'openai' | 'ollama' | 'lmstudio' | 'llamacpp'>('gemini');
  const [model, setModel] = useState<string>('gemini-3.8-flash');
  const [baseUrl, setBaseUrl] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(2048);
  const [systemInstruction, setSystemInstruction] = useState<string>(
    'You are a high-assurance autonomous agent operating under the Vortex Foundation Execution Protocol.'
  );

  const [prompt, setPrompt] = useState<string>(
    'Analyze how cryptographic execution proofs (RFC 8785 JCS + Ed25519) eliminate unauthorized agent actions in production.'
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Probe local state
  const [probeStatus, setProbeStatus] = useState<{
    tested: boolean;
    online: boolean;
    models: string[];
    latency_ms?: number;
    error?: string;
  }>({ tested: false, online: false, models: [] });
  const [probing, setProbing] = useState<boolean>(false);

  // Server providers metadata
  const [serverProviders, setServerProviders] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/vortex/llm/providers')
      .then((res) => res.json())
      .then((data) => {
        if (data.providers) setServerProviders(data.providers);
      })
      .catch((err) => console.error(err));
  }, []);

  // Update default models when provider changes
  useEffect(() => {
    if (provider === 'gemini') {
      setModel('gemini-3.8-flash');
      setBaseUrl('');
    } else if (provider === 'openai') {
      setModel('gpt-4o-mini');
      setBaseUrl('https://api.openai.com/v1');
    } else if (provider === 'ollama') {
      setModel('llama3');
      setBaseUrl('http://localhost:11434');
      handleProbe('ollama', 'http://localhost:11434');
    } else if (provider === 'lmstudio') {
      setModel('local-model');
      setBaseUrl('http://localhost:1234/v1');
      handleProbe('lmstudio', 'http://localhost:1234/v1');
    } else if (provider === 'llamacpp') {
      setModel('qwen2.5-coder-0.5b');
      setBaseUrl('http://127.0.0.1:11434');
      setMaxTokens(128);
      setTemperature(0);
    }
  }, [provider]);

  const handleProbe = async (targetProvider = provider, targetUrl = baseUrl) => {
    if (targetProvider !== 'ollama' && targetProvider !== 'lmstudio') return;
    setProbing(true);
    try {
      const res = await fetch('/api/vortex/llm/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: targetProvider,
          baseUrl: targetUrl || (targetProvider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:1234/v1'),
        }),
      });
      const data = await res.json();
      setProbeStatus({
        tested: true,
        online: Boolean(data.online),
        models: data.models || [],
        latency_ms: data.latency_ms,
        error: data.error,
      });
      if (data.models && data.models.length > 0) {
        setModel(data.models[0]);
      }
    } catch (err: any) {
      setProbeStatus({
        tested: true,
        online: false,
        models: [],
        error: err.message,
      });
    } finally {
      setProbing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/vortex/llm/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          config: {
            provider,
            model,
            baseUrl: baseUrl || undefined,
            apiKey: apiKey || undefined,
            temperature,
            maxTokens,
            systemInstruction,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Execution error');
    } finally {
      setLoading(false);
    }
  };

  const presets = [
    {
      title: 'Auditoria de Segurança',
      prompt: 'Analise o modelo de autorização do Vortex e descreva como a assinatura Ed25519 impede que agentes LLM adulterem arquivos não governados.',
    },
    {
      title: 'Proposta de Refatoração',
      prompt: 'Gere um patch de governança formal demonstrando a estrutura de isolamento em sandbox para caminhos restritos.',
    },
    {
      title: 'Verificação Criptográfica',
      prompt: 'Explique por que a canonicalização RFC 8785 (JCS) byte a byte é indispensável para evitar divergências de hash em ambientes distribuídos.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="rounded-xl border border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900/90 to-zinc-950 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                DUAL ENGINE: CLOUD API KEY & LOCAL LLM
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ED25519 PROOF EMISSION
              </span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-400" />
              Gateway Multi-LLM Governança Vortex
            </h2>
            <p className="text-xs text-zinc-400 max-w-2xl mt-1">
              Execute tarefas de IA conectando tanto <strong>modelos em nuvem via API Key</strong> (Google Gemini, OpenAI) quanto <strong>modelos locais offline</strong> (Ollama, LM Studio). Todas as gerações passam pelo pipeline normativo com prova de execução <code className="text-indigo-300">ExecutionProof v1</code> e assinatura RFC 8785.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-zinc-800/80 border border-zinc-700/60 text-xs">
              <span className="text-zinc-400">Canal MCP:</span>{' '}
              <span className="font-mono text-indigo-300">vortex.llm.invoke</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Configuration & Provider Selector */}
        <div className="lg:col-span-5 space-y-5">
          {/* Provider Selection Cards */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block">
              Selecione o Provedor de LLM
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Gemini */}
              <button
                type="button"
                onClick={() => setProvider('gemini')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'gemini'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Google Gemini
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300">
                    API Key
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">@google/genai nativo, alta velocidade e multimodal.</p>
              </button>

              {/* OpenAI Compatible */}
              <button
                type="button"
                onClick={() => setProvider('openai')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'openai'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Server className="w-3.5 h-3.5 text-emerald-400" />
                    OpenAI / Cloud
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                    Cloud
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">OpenAI, Groq, DeepSeek ou endpoint customizado.</p>
              </button>

              {/* Ollama */}
              <button
                type="button"
                onClick={() => setProvider('ollama')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'ollama'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    Ollama (Local)
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">
                    localhost
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">100% offline, zero nuvem, soberania total de dados.</p>
              </button>

              {/* LM Studio */}
              <button
                type="button"
                onClick={() => setProvider('lmstudio')}
                className={`p-3 rounded-lg border text-left transition-all ${
                  provider === 'lmstudio'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Terminal className="w-3.5 h-3.5 text-purple-400" />
                    LM Studio (Local)
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-mono">
                    :1234
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">LM Studio, vLLM ou servidor compatível local.</p>
              </button>

              {/* llama.cpp Native Edge */}
              <button
                type="button"
                onClick={() => setProvider('llamacpp')}
                className={`p-3 rounded-lg border text-left transition-all col-span-2 ${
                  provider === 'llamacpp'
                    ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-sm'
                    : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                    <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                    llama.cpp Nativo (Edge / Termux A23 CPU)
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                    C/C++ SIMD + Q4 GGUF
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Inferência quente em binário compilado C/C++, fila serial (concorrência = 1), governada pelo VUA Node.js com provas Ed25519.
                </p>
              </button>
            </div>
          </div>

          {/* Provider Specific Settings */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Parâmetros de Conexão & Modelo
              </h3>
              {(provider === 'ollama' || provider === 'lmstudio') && (
                <button
                  type="button"
                  onClick={() => handleProbe()}
                  disabled={probing}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                  title="Testar conectividade local"
                >
                  <RefreshCw className={`w-3 h-3 ${probing ? 'animate-spin' : ''}`} />
                  {probing ? 'Testando...' : 'Testar Conexão Local'}
                </button>
              )}
            </div>

            {/* Local Probe Feedback */}
            {(provider === 'ollama' || provider === 'lmstudio') && probeStatus.tested && (
              <div
                className={`p-3 rounded-lg border text-xs ${
                  probeStatus.online
                    ? 'border-emerald-500/30 bg-emerald-950/30 text-emerald-300'
                    : 'border-amber-500/30 bg-amber-950/30 text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span className="flex items-center gap-1.5">
                    {probeStatus.online ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    )}
                    {probeStatus.online
                      ? `Servidor ${provider.toUpperCase()} Ativo (${probeStatus.latency_ms}ms)`
                      : `Servidor ${provider.toUpperCase()} Inacessível`}
                  </span>
                  <span className="font-mono text-[10px]">{baseUrl}</span>
                </div>

                {probeStatus.online && probeStatus.models.length > 0 ? (
                  <div className="mt-2 text-[11px] text-zinc-300">
                    Modelos detectados: <strong>{probeStatus.models.join(', ')}</strong>
                  </div>
                ) : !probeStatus.online ? (
                  <div className="mt-1.5 text-[11px] text-zinc-400">
                    {provider === 'ollama' ? (
                      <>
                        Execute no terminal: <code className="text-amber-200">ollama serve</code> ou{' '}
                        <code className="text-amber-200">ollama run llama3</code>. O backend do Vortex faz o proxy
                        automaticamente sem restrição de CORS.
                      </>
                    ) : (
                      <>Inicie o servidor local no LM Studio na porta 1234 habilitando a opção "Start Server".</>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Model Field */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Identificador do Modelo</label>
              {provider === 'ollama' && probeStatus.models.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  {probeStatus.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={provider === 'gemini' ? 'gemini-3.8-flash' : provider === 'ollama' ? 'llama3' : 'gpt-4o-mini'}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              )}
            </div>

            {/* Base URL (if local or custom) */}
            {(provider === 'ollama' || provider === 'lmstudio' || provider === 'llamacpp' || provider === 'openai') && (
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Endpoint URL (Base)</label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    provider === 'ollama'
                      ? 'http://localhost:11434'
                      : provider === 'llamacpp'
                      ? 'http://127.0.0.1:11434'
                      : provider === 'lmstudio'
                      ? 'http://localhost:1234/v1'
                      : 'https://api.openai.com/v1'
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
                {provider === 'llamacpp' && (
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Aponta para o binário nativo <code className="text-cyan-300">llama-server</code> compilado em C/C++ no Termux/Android.
                  </p>
                )}
              </div>
            )}

            {/* API Key (if cloud provider or user specified) */}
            {provider !== 'ollama' && provider !== 'lmstudio' && (
              <div>
                <label className="text-xs text-zinc-400 mb-1 flex items-center justify-between">
                  <span>Chave de API (Opcional se já configurada no ambiente)</span>
                  {provider === 'gemini' && (
                    <span className="text-[10px] text-emerald-400">GEMINI_API_KEY server-side</span>
                  )}
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    provider === 'gemini'
                      ? 'Usa GEMINI_API_KEY do servidor por padrão (ou insira chave personalizada)'
                      : 'sk-...'
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            {/* Hyperparameters */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Temperatura: {temperature}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">Max Tokens</label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 1024)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* System Instruction */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Instrução de Sistema (Persona do Agente)</label>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                rows={2}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Execution Console & Results */}
        <div className="lg:col-span-7 space-y-5">
          {/* Prompt Console */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                Prompt de Execução Governada
              </label>

              <span className="text-[11px] text-zinc-500">
                Alvo: <span className="font-mono text-zinc-300">{provider}</span> :{' '}
                <span className="font-mono text-indigo-300">{model}</span>
              </span>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setPrompt(p.prompt)}
                  className="text-[11px] px-2.5 py-1 rounded bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/50 transition"
                >
                  {p.title}
                </button>
              ))}
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Digite seu comando ou prompt para a LLM..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-100 focus:outline-none focus:border-indigo-500 font-mono leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-zinc-500 flex items-center gap-1">
                <Lock className="w-3 h-3 text-indigo-400" />
                Emite <code className="text-zinc-400">ExecutionProof v1</code> assinado por Ed25519
              </span>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white shadow-lg transition ${
                  loading
                    ? 'bg-indigo-700/50 cursor-not-allowed'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
                }`}
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Executando no Gateway...
                  </>
                ) : (
                  <>
                    Executar via Vortex
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-xs text-rose-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Falha na Execução do Gateway
              </div>
              <p className="font-mono text-zinc-300">{error}</p>
            </div>
          )}

          {/* Result Card */}
          {result && (
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4">
              {/* Result Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-xs text-white">Resposta Governada Concluída</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                    {result.provider} / {result.model}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span>
                    Latência: <strong className="text-zinc-200">{result.duration_ms}ms</strong>
                  </span>
                  {result.usage?.total_tokens && (
                    <span>
                      Tokens: <strong className="text-indigo-300">{result.usage.total_tokens}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Text Body */}
              <div className="bg-zinc-950 rounded-lg p-4 border border-zinc-800/80 text-xs text-zinc-200 font-sans leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                {result.text}
              </div>

              {/* Cryptographic Proof Verification Card */}
              {result.execution_proof && (
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-indigo-400" />
                      <span className="text-xs font-semibold text-indigo-300">
                        Prova Criptográfica de Execução (RFC 8785 + Ed25519)
                      </span>
                    </div>

                    {result.verification?.valid ? (
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
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
                      <span className="text-zinc-500">Hash da Entrada (JCS):</span>
                      <div className="text-zinc-300 truncate" title={result.execution_proof.input_hash}>
                        {result.execution_proof.input_hash}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Hash da Saída (JCS):</span>
                      <div className="text-zinc-300 truncate" title={result.execution_proof.output_hash}>
                        {result.execution_proof.output_hash}
                      </div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Key ID Emissora:</span>
                      <div className="text-indigo-300 truncate">{result.execution_proof.key_id}</div>
                    </div>
                    <div>
                      <span className="text-zinc-500">Assinatura Ed25519:</span>
                      <div className="text-emerald-400 truncate">{result.execution_proof.signature.substring(0, 32)}...</div>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onSendToVerifier(result.execution_proof)}
                      className="flex items-center gap-1.5 text-xs text-indigo-300 hover:text-indigo-200 underline font-medium"
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
