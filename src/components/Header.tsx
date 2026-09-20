import React, { useState } from 'react';
import {
  Shield,
  Key,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Terminal,
  FileCheck,
  Server,
  Cpu,
  Layers,
  FolderGit2,
  Sparkles,
  Brain,
  BookOpen,
  Database,
  LogIn
} from 'lucide-react';
import { auth, logoutUser, type User } from '../firebase/config.js';

interface HeaderProps {
  status: {
    status: string;
    identity?: {
      agent_id: string;
      principal_id: string;
      key_id: string;
      algorithm: string;
      public_key: string;
    };
    active_gos3_sessions: number;
    execution_proofs_count: number;
  } | null;
  onRotateKey: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenMascot?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onRotateKey,
  activeTab,
  setActiveTab,
  onOpenMascot,
}) => {
  const [copiedKey, setCopiedKey] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(auth.currentUser);

  React.useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setFirebaseUser(u));
    return () => unsub();
  }, []);

  const copyPublicKey = () => {
    if (status?.identity?.public_key) {
      navigator.clipboard.writeText(status.identity.public_key);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleOpenSwagger = async (e: React.MouseEvent) => {
    e.preventDefault();
    let token = '';
    if (firebaseUser) {
      try {
        token = await firebaseUser.getIdToken();
      } catch (err) {
        console.warn('Could not get token for Swagger:', err);
      }
    }
    const targetUrl = token ? `/api-docs?token=${encodeURIComponent(token)}` : '/api-docs';
    window.open(targetUrl, '_blank', 'noreferrer');
  };

  const navItems = [
    { id: 'vua-adapters', label: 'Adaptadores VUA', icon: Layers },
    { id: 'bend-dev', label: 'Bend Development', icon: Sparkles },
    { id: 'firebase-ledger', label: 'Firebase Cloud Ledger', icon: Database },
    { id: 'capability-matrix', label: 'Matriz de Capacidades (100)', icon: Sparkles },
    { id: 'semantic-oracle', label: 'Oráculo Semântico (30 Casos)', icon: Brain },
    { id: 'github-manager', label: 'GitHub & Projetos', icon: FolderGit2 },
    { id: 'workbench', label: 'MCP Workbench', icon: Terminal },
    { id: 'llm-gateway', label: 'Multi-LLM Gateway', icon: Cpu },
    { id: 'verifier', label: 'Independent Verifier', icon: Shield },
    { id: 'e2e', label: 'Foundation 10 E2E', icon: CheckCircle2 },
    { id: 'adversarial', label: 'Adversarial Suite', icon: FileCheck },
    { id: 'gos3', label: 'GOS3 & Sandbox', icon: Server },
    { id: 'ci-benchmark', label: 'CI & Benchmark', icon: RefreshCw },
  ];

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 text-zinc-100 sticky top-0 z-40">
      {/* Top Banner */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Mascot Trigger Avatar (O'Reilly Style) */}
          <button
            id="header-mascot-badge"
            type="button"
            onClick={onOpenMascot}
            title="Conhecer o Mascote VUA: O Pangolim de Governança (Estilo O'Reilly)"
            className="w-10 h-10 rounded-xl bg-zinc-900 border border-amber-600/40 p-1 flex items-center justify-center text-white shrink-0 hover:border-amber-400 hover:scale-105 transition shadow-md shadow-amber-950/20 group relative"
          >
            <img
              src="/vua-mascot.jpg"
              alt="Mascote VUA Pangolim O'Reilly"
              className="w-full h-full object-contain rounded-lg mix-blend-screen filter contrast-125"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/src/assets/images/vua_mascot_1788905946097.jpg';
              }}
            />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
            </span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                VUA
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-500/30 text-cyan-400">
                  UNIVERSAL ADAPTER & GOVERNANCE
                </span>
              </h1>
            </div>
            <p className="text-xs text-zinc-400">
              GitHub • Linux • Android • Windows | RFC 8785 JCS • Ed25519 ExecutionProof v1
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {onOpenMascot && (
            <button
              onClick={onOpenMascot}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/30 hover:bg-amber-900/40 border border-amber-700/40 text-amber-300 text-xs transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Mascote O&apos;Reilly
            </button>
          )}

          {status?.identity && (
            <div className="hidden lg:flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-zinc-400">Key:</span>
              <span className="font-mono text-zinc-200">{status.identity.key_id}</span>
              <button
                onClick={copyPublicKey}
                className="text-indigo-400 hover:text-indigo-300 ml-1 underline"
                title="Copy Public Key PEM"
              >
                {copiedKey ? 'Copied!' : 'Copy PEM'}
              </button>
              <button
                onClick={onRotateKey}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-zinc-200 transition"
                title="Rotate Ed25519 Keypair"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-300 font-mono">POST /mcp</span>
            <a
              href="/.well-known/vortex-keys"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1 ml-1"
              title="RFC Well-Known Keys"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <a
            id="header-swagger-docs-btn"
            href="/api-docs"
            onClick={handleOpenSwagger}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-400 hover:text-emerald-300 text-xs font-mono transition"
            title={firebaseUser ? "Abrir Swagger UI pré-autorizado com seu Firebase Auth Token" : "Abrir Documentação Interativa Swagger UI (OpenAPI 3.0)"}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Swagger /api-docs</span>
            {firebaseUser && (
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-semibold border border-amber-500/30">
                AUTH 🔥
              </span>
            )}
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>

          {firebaseUser ? (
            <button
              type="button"
              onClick={() => setActiveTab('firebase-ledger')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/50 border border-amber-600/40 text-amber-300 text-xs font-mono transition"
              title="Operador Conectado - Clique para gerenciar sessão"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="truncate max-w-[110px]">{firebaseUser.displayName || firebaseUser.email}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setActiveTab('firebase-ledger')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-900/30 hover:bg-amber-800/40 border border-amber-600/30 text-amber-300 text-xs transition"
              title="Autenticar no Firebase Auth"
            >
              <LogIn className="w-3.5 h-3.5 text-amber-400" />
              <span>Autenticar</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Bar */}
      <div className="border-t border-zinc-800/80 bg-zinc-900/50">
        <div className="max-w-7xl mx-auto px-4 flex overflow-x-auto gap-1 py-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  active
                    ? 'bg-zinc-800 text-white shadow-sm border border-zinc-700 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-indigo-400' : 'text-zinc-400'}`} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
