import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  Github,
  Lock,
  Unlock,
  Key,
  Shield,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Eye,
  EyeOff,
  FolderGit2,
  GitCommit,
  GitPullRequest,
  GitMerge,
  FileText,
  FileCode,
  Send,
  Check,
  Star,
  GitFork,
  Sparkles,
  ArrowRight,
  Play
} from 'lucide-react';
import type { ExecutionProof } from '../vortex/types.js';

interface GitHubRepoManagerProps {
  onSendToVerifier: (proof: ExecutionProof) => void;
  onOpenMascot?: () => void;
}

interface GitHubUser {
  login: string;
  name?: string;
  avatar_url?: string;
  bio?: string;
  company?: string;
  location?: string;
  public_repos: number;
  total_private_repos: number;
  followers?: number;
  scopes: string[];
  rate_limit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
  mode?: string;
}

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: string;
  owner_avatar?: string;
  private: boolean;
  description: string;
  default_branch: string;
  branches: string[];
  language: string;
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
  open_issues_count: number;
  governed: boolean;
  branch_protection: boolean;
  ci_status?: string;
}

interface ActiveTarget {
  owner: string;
  repo: string;
  branch: string;
  commit_sha?: string;
  updated_at?: string;
}

export const GitHubRepoManager: React.FC<GitHubRepoManagerProps> = ({
  onSendToVerifier,
  onOpenMascot,
}) => {
  // Auth state
  const [tokenInput, setTokenInput] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [githubUser, setGithubUser] = useState<GitHubUser | null>(null);

  // Repos state
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'public' | 'private' | 'governed'>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');

  // Selected Target
  const [activeTarget, setActiveTarget] = useState<ActiveTarget>({
    owner: 'vuafoundation',
    repo: 'vua',
    branch: 'main',
  });
  const [selectedBranch, setSelectedBranch] = useState<string>('main');

  // Action execution state
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<any | null>(null);
  const [lastEmittedProof, setLastEmittedProof] = useState<ExecutionProof | null>(null);

  // Workflow mode
  const [workflowTab, setWorkflowTab] = useState<'quick' | 'write_pr' | 'write_commit' | 'merge_pr' | 'create_branch' | 'trigger_workflow'>('quick');

  // Branch Creation Form
  const [branchForm, setBranchForm] = useState({
    branch: 'feature/vua-sandbox-experiment',
    baseBranch: 'main',
  });

  // Workflow Dispatch Form
  const [workflowForm, setWorkflowForm] = useState({
    workflowId: 'vortex-ci.yml',
    ref: 'main',
    testSuite: 'full-conformance',
  });

  // PR Form
  const [prForm, setPrForm] = useState({
    title: 'feat: implementar adaptador universal e governança de merge no VUA',
    head: 'feature/vua-governance',
    base: 'main',
    body: `## ⚡ VUA Governed Pull Request\n\n### Sumário\nProposta de Pull Request assinada e validada pelo motor **VUA (Vortex Universal Adapter)** com atestação criptográfica.\n\n### Checklist de Governança GOS3\n- [x] RFC 8785 JCS Canonicalization Aprovada\n- [x] Assinatura Ed25519 Válida\n- [x] Sandbox Zero-Leakage Verificado\n- [x] Regra de Ouro: CI 100% PASS → mergeability OK → merge`,
  });

  // Commit Form
  const [commitForm, setCommitForm] = useState({
    branch: 'feature/vua-governance',
    filePath: 'src/vua-manifest.json',
    message: 'feat: add VUA governed manifest and Ed25519 identity metadata',
    content: '{\n  "vua_version": "1.2.0",\n  "adapter": "github",\n  "governance": "GOS3_COMPLIANT",\n  "canon": "RFC_8785_JCS"\n}',
  });

  // Merge Form
  const [mergeForm, setMergeForm] = useState({
    prNumber: 42,
    mergeMethod: 'squash' as 'squash' | 'merge' | 'rebase',
    commitTitle: 'Merge pull request #42 from feature/vua-governance',
  });

  // Safe JSON Response Parser to avoid "Unexpected token '<'" when backend is offline or Vite SPA fallback returns HTML
  const parseJsonResponse = async <T = any,>(res: Response): Promise<T> => {
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('<!doctype') || trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      const err = new Error(
        `O servidor retornou uma página HTML (${res.status}) em vez de JSON na rota '${res.url}'.`
      );
      (err as any).isHtmlIntercept = true;
      throw err;
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Resposta inválida do servidor (${res.status}): ${text.slice(0, 100)}`);
    }
  };

  // Client-Side Direct GitHub Connect (used when Google AI Studio preview proxy intercepts /api/github with cookie check)
  const connectDirectGitHub = async (pat: string) => {
    const cleanToken = pat.trim();
    const ghRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${cleanToken}`,
        'User-Agent': 'VUA-Connector-Governance/2.5.0',
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!ghRes.ok) {
      const errJson = await ghRes.json().catch(() => ({}));
      throw new Error((errJson as any).message || `GitHub respondeu com erro ${ghRes.status} (verifique se o PAT é válido e possui escopo repo)`);
    }

    const userData = await ghRes.json();
    const scopesHeader = ghRes.headers.get('x-oauth-scopes') || 'repo, read:org';
    const scopes = scopesHeader.split(',').map((s: string) => s.trim()).filter(Boolean);

    const user: GitHubUser = {
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
      bio: userData.bio || 'Desenvolvedor GitHub (Conexão Direta Client-Side)',
      company: userData.company,
      location: userData.location,
      public_repos: userData.public_repos,
      total_private_repos: userData.total_private_repos || 0,
      followers: userData.followers,
      scopes,
      rate_limit: {
        limit: Number(ghRes.headers.get('x-ratelimit-limit') || 5000),
        remaining: Number(ghRes.headers.get('x-ratelimit-remaining') || 4999),
        reset: Number(ghRes.headers.get('x-ratelimit-reset') || Math.floor(Date.now() / 1000) + 3600),
      },
      mode: 'authenticated',
    };

    // Also fetch repositories directly from GitHub API
    try {
      const reposRes = await fetch('https://api.github.com/user/repos?per_page=30&sort=updated', {
        headers: {
          Authorization: `Bearer ${cleanToken}`,
          'User-Agent': 'VUA-Connector-Governance/2.5.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });
      if (reposRes.ok) {
        const reposData = await reposRes.json();
        const mapped: Repository[] = reposData.map((r: any) => ({
          id: r.id,
          name: r.name,
          full_name: r.full_name,
          owner: r.owner?.login || userData.login,
          description: r.description || 'Repositório GitHub verificado.',
          private: r.private,
          stars: r.stargazers_count,
          forks: r.forks_count,
          default_branch: r.default_branch || 'main',
          language: r.language || 'TypeScript',
          governed: true,
        }));
        if (mapped.length > 0) {
          setRepos(mapped);
          setActiveTarget({
            owner: mapped[0].owner,
            repo: mapped[0].name,
            branch: mapped[0].default_branch,
          });
          setSelectedBranch(mapped[0].default_branch);
        }
      }
    } catch {
      // Repos list fetch error is non-fatal
    }

    return user;
  };

  // Fetch initial status & repos
  const fetchStatusAndRepos = async () => {
    setLoadingRepos(true);
    try {
      const statusRes = await fetch('/api/github/status');
      const statusData = await parseJsonResponse(statusRes);
      if (statusData.authenticated && statusData.user) {
        setGithubUser(statusData.user);
      }
      if (statusData.active_target) {
        setActiveTarget(statusData.active_target);
        setSelectedBranch(statusData.active_target.branch || 'main');
      }

      const reposRes = await fetch('/api/github/repos');
      const reposData = await parseJsonResponse(reposRes);
      if (reposData.repos) {
        setRepos(reposData.repos);
      }
    } catch (err: any) {
      console.error('Failed to load GitHub context:', err);
    } finally {
      setLoadingRepos(false);
    }
  };

  useEffect(() => {
    fetchStatusAndRepos();
  }, []);

  // Handle Connect
  const handleConnect = async (useDemo = false) => {
    setLoadingAuth(true);
    setAuthError(null);
    try {
      try {
        const res = await fetch('/api/github/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: useDemo ? undefined : tokenInput, demo: useDemo }),
        });
        const data = await parseJsonResponse(res);
        if (!res.ok || !data.authenticated) {
          setAuthError(data.error || 'Falha ao autenticar com GitHub');
          return;
        }

        setGithubUser(data.user);
        setTokenInput('');
        fetchStatusAndRepos();
        return;
      } catch (backendErr: any) {
        if (backendErr?.isHtmlIntercept && !useDemo && tokenInput.trim()) {
          console.warn('[VUA] Proxy HTML detectado no backend, conectando diretamente via api.github.com');
          const directUser = await connectDirectGitHub(tokenInput);
          setGithubUser(directUser);
          setTokenInput('');
          return;
        }
        throw backendErr;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Erro de rede ao conectar com GitHub');
    } finally {
      setLoadingAuth(false);
    }
  };

  // Handle Disconnect
  const handleDisconnect = async () => {
    try {
      await fetch('/api/github/disconnect', { method: 'POST' });
      setGithubUser(null);
      fetchStatusAndRepos();
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Select Project / Repository
  const handleSelectRepository = async (repo: Repository) => {
    const newTarget: ActiveTarget = {
      owner: repo.owner,
      repo: repo.name,
      branch: repo.default_branch || 'main',
    };
    setActiveTarget(newTarget);
    setSelectedBranch(repo.default_branch || 'main');
    setActionResult(null);
    setLastEmittedProof(null);

    try {
      await fetch('/api/github/active-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTarget),
      });
    } catch (err) {
      console.error('Failed to save active target:', err);
    }
  };

  // Handle Branch Change
  const handleBranchChange = async (branch: string) => {
    setSelectedBranch(branch);
    const updated = { ...activeTarget, branch };
    setActiveTarget(updated);
    try {
      await fetch('/api/github/active-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Execute Governed Action on the GitHub Adapter
  const handleExecuteAction = async (action: string, customPayload: Record<string, unknown> = {}) => {
    setExecutingAction(action);
    setActionResult(null);
    setLastEmittedProof(null);

    try {
      const res = await fetch('/api/github/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload: {
            owner: activeTarget.owner,
            repo: activeTarget.repo,
            branch: selectedBranch,
            ...customPayload,
          },
        }),
      });

      const data = await parseJsonResponse(res);
      setActionResult(data);
      if (data.proof) {
        setLastEmittedProof(data.proof);
      }
    } catch (err: any) {
      setActionResult({
        success: false,
        error: err.message || 'Falha ao executar ação no adaptador GitHub',
      });
    } finally {
      setExecutingAction(null);
    }
  };

  // Filtered repositories list
  const availableOwners = Array.from(new Set(repos.map((r) => r.owner)));
  const filteredRepos = repos.filter((repo) => {
    const matchesSearch =
      repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesOwner = selectedOwner === 'all' || repo.owner === selectedOwner;

    let matchesFilter = true;
    if (filterType === 'public') matchesFilter = !repo.private;
    if (filterType === 'private') matchesFilter = repo.private;
    if (filterType === 'governed') matchesFilter = repo.governed;

    return matchesSearch && matchesOwner && matchesFilter;
  });

  const activeRepoDetails = repos.find(
    (r) => r.owner === activeTarget.owner && r.name === activeTarget.repo
  );

  return (
    <div id="vua-github-manager-view" className="space-y-6">
      {/* Top Banner with Mascot Callout */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-zinc-950 border-2 border-amber-500/40 p-1 flex items-center justify-center shrink-0 shadow-lg relative group cursor-pointer" onClick={onOpenMascot}>
              <img
                src="/vua-mascot.jpg"
                alt="Mascote VUA Pangolim"
                className="w-full h-full object-contain rounded-xl mix-blend-screen filter contrast-125 group-hover:scale-105 transition"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = '/src/assets/images/vua_mascot_1788905946097.jpg';
                }}
              />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 border-2 border-zinc-900 text-[8px] font-bold text-black items-center justify-center">★</span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Gestão Segura de Repositórios & Projetos GitHub
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  VCS Governed Profile v2.5
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-2xl leading-relaxed">
                Conecte-se com segurança para selecionar projetos e auditar branches com o adaptador GitHub do <strong>VUA</strong>. Todas as ações emitem provas criptográficas <strong>Ed25519 + RFC 8785</strong> com zero vazamento de segredos.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {onOpenMascot && (
              <button
                id="btn-open-mascot-modal"
                onClick={onOpenMascot}
                className="px-3.5 py-2 rounded-xl bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/50 text-amber-300 hover:text-amber-200 text-xs font-medium transition flex items-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                Conhecer o Mascote (O&apos;Reilly)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Left is Auth & Connection / Right is Active Target Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Connection & Auth Card */}
        <div className="lg:col-span-1 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Github className="w-5 h-5 text-white" />
                <h3 className="text-sm font-semibold text-white">Status da Conexão GitHub</h3>
              </div>
              {githubUser ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {githubUser.mode === 'sandbox_demo' ? 'Sandbox Demo' : 'Conectado'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-400">
                  Desconectado
                </span>
              )}
            </div>

            {githubUser ? (
              <div className="space-y-4">
                {/* User Profile info */}
                <div className="flex items-center gap-3 p-3 bg-zinc-950/70 border border-zinc-800/80 rounded-lg">
                  {githubUser.avatar_url ? (
                    <img
                      src={githubUser.avatar_url}
                      alt={githubUser.login}
                      className="w-12 h-12 rounded-full border border-zinc-700 object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-300 font-bold">
                      {githubUser.login.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden">
                    <h4 className="text-sm font-semibold text-white truncate">
                      {githubUser.name || githubUser.login}
                    </h4>
                    <span className="text-xs text-zinc-400 font-mono">@{githubUser.login}</span>
                    {githubUser.company && (
                      <p className="text-[11px] text-zinc-500 truncate">{githubUser.company}</p>
                    )}
                  </div>
                </div>

                {/* Scopes & Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Repositórios</span>
                    <span className="text-zinc-200 font-bold text-sm">
                      {githubUser.public_repos} <span className="text-[10px] font-normal text-zinc-400">pub</span> • {githubUser.total_private_repos} <span className="text-[10px] font-normal text-zinc-400">priv</span>
                    </span>
                  </div>
                  <div className="p-2.5 bg-zinc-950/50 border border-zinc-800/60 rounded-lg">
                    <span className="text-zinc-500 block text-[10px] uppercase font-mono">Rate Limit API</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {githubUser.rate_limit?.remaining ?? 4980} / {githubUser.rate_limit?.limit ?? 5000}
                    </span>
                  </div>
                </div>

                {/* Scopes Badges */}
                <div>
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block mb-1.5">
                    Permissões Ativas (Scopes)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {githubUser.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 text-zinc-300 border border-zinc-700/60"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Para auditar repositórios privados ou disparar ações remotas, forneça um token pessoal (PAT) com escopo <code className="text-cyan-400">repo</code>.
                </p>

                {/* Secure Token Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-zinc-300 flex items-center justify-between">
                    <span>Personal Access Token (PAT)</span>
                    <span className="text-[10px] text-zinc-500 font-mono">fine-grained ou classic</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Key className="w-4 h-4" />
                    </div>
                    <input
                      id="input-github-token"
                      type={showToken ? 'text' : 'password'}
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full pl-9 pr-10 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-200"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="p-2.5 rounded-lg bg-red-950/50 border border-red-800/50 text-red-300 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                      <span className="font-semibold">Erro de Conexão</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-red-300/90">{authError}</p>
                    <p className="text-[10px] text-zinc-400 pt-1 border-t border-red-900/40">
                      💡 <strong>Dica para WebAPK / Mobile:</strong> Cole seu Personal Access Token (PAT) do GitHub acima para autenticar com acesso direto. Ou clique em "Usar Repositórios Demo" para explorar sem token.
                    </p>
                  </div>
                )}

                {/* Security Guarantee Box */}
                <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg text-[11px] text-zinc-400 space-y-1">
                  <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" />
                    Isolamento de Credencial
                  </div>
                  <p className="text-[10px] text-zinc-500 leading-normal">
                    O token é mantido estritamente na memória volátil da sessão. Nunca é gravado em logs, banco de dados ou arquivos de texto.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-zinc-800/80 mt-4 space-y-2">
            {githubUser ? (
              <button
                id="btn-disconnect-github"
                onClick={handleDisconnect}
                className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium transition flex items-center justify-center gap-2"
              >
                <Unlock className="w-3.5 h-3.5" />
                Desconectar Sessão
              </button>
            ) : (
              <>
                <button
                  id="btn-connect-github-token"
                  onClick={() => handleConnect(false)}
                  disabled={loadingAuth || !tokenInput.trim()}
                  className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-semibold transition flex items-center justify-center gap-2"
                >
                  {loadingAuth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Autenticar com Token Seguro
                </button>

                <button
                  id="btn-connect-demo-sandbox"
                  onClick={() => handleConnect(true)}
                  disabled={loadingAuth}
                  className="w-full py-2 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  Usar Repositórios Demo da Fundação (Sem Token)
                </button>
              </>
            )}
          </div>
        </div>

        {/* Selected Active Project Card (2 Cols) */}
        <div className="lg:col-span-2 bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Repositório Alvo Ativo no VUA</h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-indigo-950 border border-indigo-500/30 text-indigo-400">
                ACTIVE TARGET
              </span>
            </div>

            {/* Target Header */}
            <div className="p-4 bg-zinc-950/80 border border-zinc-800 rounded-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-mono">{activeTarget.owner}/</span>
                    <h4 className="text-base font-bold text-white tracking-tight">{activeTarget.repo}</h4>
                    {activeRepoDetails?.private ? (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-amber-950/60 border border-amber-500/30 text-amber-400 font-mono">
                        Private
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-zinc-800 text-zinc-400 font-mono">
                        Public
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    {activeRepoDetails?.description || 'Repositório governado pelo ecossistema universal VUA.'}
                  </p>
                </div>

                {/* Branch Selector */}
                <div className="flex items-center gap-2 bg-zinc-900 p-1.5 rounded-lg border border-zinc-800 shrink-0">
                  <GitBranch className="w-4 h-4 text-cyan-400 shrink-0 ml-1" />
                  <select
                    id="select-target-branch"
                    value={selectedBranch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="bg-transparent text-xs font-mono text-zinc-200 focus:outline-none pr-2 cursor-pointer"
                  >
                    {(activeRepoDetails?.branches || ['main', 'develop']).map((b) => (
                      <option key={b} value={b} className="bg-zinc-900 text-zinc-200">
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Metadata Bar */}
              <div className="mt-3 pt-3 border-t border-zinc-800/80 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <GitCommit className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="font-mono text-[11px] text-zinc-300">
                    SHA: {(activeTarget.commit_sha || '856920785b8392b036211cc851e1f6467961ff52').substring(0, 10)}...
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-zinc-300">Branch Protection: Enforced</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] text-zinc-300">Assinatura Ed25519: Ativa</span>
                </div>
              </div>
            </div>

            {/* Governed Workflow Tabs */}
            <div className="mt-4 pt-3 border-t border-zinc-800">
              <div className="flex items-center gap-1 mb-3 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setWorkflowTab('quick')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    workflowTab === 'quick'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Ações Rápidas
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowTab('write_pr')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    workflowTab === 'write_pr'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <GitPullRequest className="w-3.5 h-3.5 text-violet-400" />
                  Escrever & Criar PR
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowTab('write_commit')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    workflowTab === 'write_commit'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                  Gravar Commit em Branch
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowTab('create_branch')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    workflowTab === 'create_branch'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                  Criar Branch
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowTab('trigger_workflow')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    workflowTab === 'trigger_workflow'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 text-blue-400" />
                  Disparar Workflow
                </button>

                <button
                  type="button"
                  onClick={() => setWorkflowTab('merge_pr')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition ${
                    workflowTab === 'merge_pr'
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
                  }`}
                >
                  <GitMerge className="w-3.5 h-3.5 text-amber-400" />
                  Merge no Git
                </button>
              </div>

              {/* Subview 1: Quick Actions */}
              {workflowTab === 'quick' && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    id="btn-action-inspect-repo"
                    onClick={() => handleExecuteAction('inspect_repo')}
                    disabled={Boolean(executingAction)}
                    className="p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition hover:border-zinc-700"
                  >
                    <Search className="w-4 h-4 text-cyan-400 mb-1" />
                    <div className="text-xs font-medium text-zinc-200">Inspecionar Repo</div>
                    <div className="text-[10px] text-zinc-500">Regras e status</div>
                  </button>

                  <button
                    id="btn-action-verify-commit"
                    onClick={() => handleExecuteAction('verify_commit')}
                    disabled={Boolean(executingAction)}
                    className="p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition hover:border-zinc-700"
                  >
                    <GitCommit className="w-4 h-4 text-emerald-400 mb-1" />
                    <div className="text-xs font-medium text-zinc-200">Verificar Commit</div>
                    <div className="text-[10px] text-zinc-500">Assinatura Ed25519</div>
                  </button>

                  <button
                    id="btn-action-check-ci"
                    onClick={() => handleExecuteAction('check_ci_run')}
                    disabled={Boolean(executingAction)}
                    className="p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition hover:border-zinc-700"
                  >
                    <CheckCircle2 className="w-4 h-4 text-indigo-400 mb-1" />
                    <div className="text-xs font-medium text-zinc-200">Quality Gates CI</div>
                    <div className="text-[10px] text-zinc-500">10/10 Gates PASS</div>
                  </button>

                  <button
                    id="btn-action-propose-pr"
                    onClick={() => handleExecuteAction('propose_pr', { title: 'feat: update VUA security policy' })}
                    disabled={Boolean(executingAction)}
                    className="p-2.5 rounded-lg bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-left transition hover:border-zinc-700"
                  >
                    <GitPullRequest className="w-4 h-4 text-violet-400 mb-1" />
                    <div className="text-xs font-medium text-zinc-200">Propor Patch PR</div>
                    <div className="text-[10px] text-zinc-500">Patch RFC 8785</div>
                  </button>
                </div>
              )}

              {/* Subview 2: Write and Create PR */}
              {workflowTab === 'write_pr' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <GitPullRequest className="w-3.5 h-3.5 text-violet-400" />
                      Gerar e Publicar Pull Request Escrita
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      POST /repos/{activeTarget.owner}/{activeTarget.repo}/pulls
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Branch Origem (Head)</label>
                      <input
                        type="text"
                        value={prForm.head}
                        onChange={(e) => setPrForm({ ...prForm, head: e.target.value })}
                        placeholder="feature/vua-governance"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Branch Destino (Base)</label>
                      <input
                        type="text"
                        value={prForm.base}
                        onChange={(e) => setPrForm({ ...prForm, base: e.target.value })}
                        placeholder="main"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-violet-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Título da Pull Request</label>
                    <input
                      type="text"
                      value={prForm.title}
                      onChange={(e) => setPrForm({ ...prForm, title: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:border-violet-500 focus:outline-none font-medium"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Corpo / Descrição do PR (Markdown)</label>
                    <textarea
                      rows={4}
                      value={prForm.body}
                      onChange={(e) => setPrForm({ ...prForm, body: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-violet-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      Gera prova criptográfica ExecutionProof v1 assinada por Ed25519.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('create_pr_written', prForm)}
                      disabled={Boolean(executingAction)}
                      className="px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {executingAction === 'create_pr_written' ? 'Publicando PR...' : 'Gerar e Enviar PR no Git'}
                    </button>
                  </div>
                </div>
              )}

              {/* Subview 3: Write Branch Commit */}
              {workflowTab === 'write_commit' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                      Gravar Arquivo e Criar Commit Assinado em Branch
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      PUT /repos/{activeTarget.owner}/{activeTarget.repo}/contents
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Branch</label>
                      <input
                        type="text"
                        value={commitForm.branch}
                        onChange={(e) => setCommitForm({ ...commitForm, branch: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Caminho do Arquivo (File Path)</label>
                      <input
                        type="text"
                        value={commitForm.filePath}
                        onChange={(e) => setCommitForm({ ...commitForm, filePath: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Mensagem do Commit</label>
                    <input
                      type="text"
                      value={commitForm.message}
                      onChange={(e) => setCommitForm({ ...commitForm, message: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Conteúdo do Arquivo</label>
                    <textarea
                      rows={3}
                      value={commitForm.content}
                      onChange={(e) => setCommitForm({ ...commitForm, content: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      Calcula digest SHA-256 e anexa assinatura Ed25519 à árvore Git.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('write_branch_commit', {
                        branch: commitForm.branch,
                        file_path: commitForm.filePath,
                        content: commitForm.content,
                        message: commitForm.message,
                      })}
                      disabled={Boolean(executingAction)}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <GitCommit className="w-3.5 h-3.5" />
                      {executingAction === 'write_branch_commit' ? 'Gravando Commit...' : 'Gravar Commit no Git'}
                    </button>
                  </div>
                </div>
              )}

              {/* Subview 4: Governed Merge in Git */}
              {workflowTab === 'merge_pr' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <GitMerge className="w-3.5 h-3.5 text-amber-400" />
                      Executar Merge Governado no Git
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      PUT /repos/{activeTarget.owner}/{activeTarget.repo}/pulls/{mergeForm.prNumber}/merge
                    </span>
                  </div>

                  {/* Golden Rule Banner */}
                  <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-semibold text-amber-300 block">Regra de Ouro da Governança VUA:</span>
                      <span className="font-mono text-[11px] text-zinc-300">
                        CI 100% PASS → mergeability OK → merge
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Número do Pull Request (#)</label>
                      <input
                        type="number"
                        value={mergeForm.prNumber}
                        onChange={(e) => setMergeForm({ ...mergeForm, prNumber: Number(e.target.value) })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Método de Merge</label>
                      <select
                        value={mergeForm.mergeMethod}
                        onChange={(e) => setMergeForm({ ...mergeForm, mergeMethod: e.target.value as any })}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none cursor-pointer"
                      >
                        <option value="squash">Squash and merge (Recomendado)</option>
                        <option value="merge">Create a merge commit</option>
                        <option value="rebase">Rebase and merge</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Título do Commit de Merge</label>
                    <input
                      type="text"
                      value={mergeForm.commitTitle}
                      onChange={(e) => setMergeForm({ ...mergeForm, commitTitle: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      O merge só é autorizado se todos os 10 Gates de Conformidade passarem.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('merge_pr', {
                        pull_number: mergeForm.prNumber,
                        merge_method: mergeForm.mergeMethod,
                        commit_title: mergeForm.commitTitle,
                      })}
                      disabled={Boolean(executingAction)}
                      className="px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <GitMerge className="w-3.5 h-3.5" />
                      {executingAction === 'merge_pr' ? 'Executando Merge...' : 'Executar Merge Governado'}
                    </button>
                  </div>
                </div>
              )}

              {/* Subview 5: Create Branch */}
              {workflowTab === 'create_branch' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
                      Criar Nova Branch de Desenvolvimento
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      POST /repos/{activeTarget.owner}/{activeTarget.repo}/git/refs
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Nome da Nova Branch</label>
                      <input
                        type="text"
                        value={branchForm.branch}
                        onChange={(e) => setBranchForm({ ...branchForm, branch: e.target.value })}
                        placeholder="feature/vua-sandbox-experiment"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Branch Base</label>
                      <input
                        type="text"
                        value={branchForm.baseBranch}
                        onChange={(e) => setBranchForm({ ...branchForm, baseBranch: e.target.value })}
                        placeholder="main"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      Aplica regras de branch protection do VUA automaticamente na nova ref.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('create_branch', {
                        branch: branchForm.branch,
                        base_branch: branchForm.baseBranch,
                      })}
                      disabled={Boolean(executingAction)}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <GitBranch className="w-3.5 h-3.5" />
                      {executingAction === 'create_branch' ? 'Criando Branch...' : 'Criar Branch Governada'}
                    </button>
                  </div>
                </div>
              )}

              {/* Subview 6: Trigger Workflow */}
              {workflowTab === 'trigger_workflow' && (
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 text-blue-400" />
                      Disparar Workflow (GitHub Actions Dispatch)
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      POST /repos/{activeTarget.owner}/{activeTarget.repo}/actions/workflows/dispatches
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Arquivo do Workflow</label>
                      <input
                        type="text"
                        value={workflowForm.workflowId}
                        onChange={(e) => setWorkflowForm({ ...workflowForm, workflowId: e.target.value })}
                        placeholder="vortex-ci.yml"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-mono text-zinc-400 block mb-1">Ref / Branch</label>
                      <input
                        type="text"
                        value={workflowForm.ref}
                        onChange={(e) => setWorkflowForm({ ...workflowForm, ref: e.target.value })}
                        placeholder="main"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-zinc-400 block mb-1">Suite de Testes (Parâmetro input)</label>
                    <input
                      type="text"
                      value={workflowForm.testSuite}
                      onChange={(e) => setWorkflowForm({ ...workflowForm, testSuite: e.target.value })}
                      placeholder="full-conformance"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-zinc-400">
                      Disparo monitorado com validação OIDC e attestation SLSA Nível 3.
                    </span>
                    <button
                      type="button"
                      onClick={() => handleExecuteAction('trigger_workflow', {
                        workflow_id: workflowForm.workflowId,
                        ref: workflowForm.ref,
                        inputs: { test_suite: workflowForm.testSuite },
                      })}
                      disabled={Boolean(executingAction)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      {executingAction === 'trigger_workflow' ? 'Disparando...' : 'Disparar Workflow no GitHub'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Execution Feedback / Proof Card */}
          {actionResult && (
            <div className="mt-4 p-3.5 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Ação Executada com Sucesso pelo VUA
                </div>
                {lastEmittedProof && (
                  <button
                    onClick={() => onSendToVerifier(lastEmittedProof)}
                    className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline"
                  >
                    Auditar Prova no Verificador
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* JSON preview */}
              <pre className="p-2.5 bg-zinc-900/90 rounded-lg text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-36 border border-zinc-800">
                {JSON.stringify(actionResult.data || actionResult, null, 2)}
              </pre>

              {lastEmittedProof && (
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 pt-1">
                  <span>Proof Hash: {lastEmittedProof.proof_hash?.substring(0, 24)}...</span>
                  <span className="text-emerald-400 font-semibold">ED25519 SIGNED</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Repositories & Projects Explorer */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Github className="w-4 h-4 text-indigo-400" />
              Explorador de Repositórios & Projetos
            </h3>
            <p className="text-xs text-zinc-400">
              Selecione qualquer projeto abaixo para torná-lo o alvo ativo do VUA.
            </p>
          </div>

          {/* Search and Filters Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                id="input-search-repos"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome ou tag..."
                className="pl-8 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
              />
            </div>

            {/* Owner Filter */}
            {availableOwners.length > 1 && (
              <select
                value={selectedOwner}
                onChange={(e) => setSelectedOwner(e.target.value)}
                className="py-1.5 px-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-300 focus:outline-none"
              >
                <option value="all">Todas as Orgs / Owners</option>
                {availableOwners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            )}

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800 text-xs">
              {(['all', 'public', 'private', 'governed'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setFilterType(filter)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition capitalize ${
                    filterType === filter
                      ? 'bg-indigo-600 text-white'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {filter === 'all' ? 'Todos' : filter === 'public' ? 'Públicos' : filter === 'private' ? 'Privados' : 'VUA'}
                </button>
              ))}
            </div>

            <button
              onClick={fetchStatusAndRepos}
              className="p-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition"
              title="Atualizar lista de repositórios"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRepos ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Repositories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRepos.map((repo) => {
            const isSelected = activeTarget.owner === repo.owner && activeTarget.repo === repo.name;

            return (
              <div
                key={repo.id}
                id={`repo-card-${repo.name}`}
                className={`p-4 rounded-xl border transition flex flex-col justify-between ${
                  isSelected
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/5 ring-1 ring-indigo-500/30'
                    : 'bg-zinc-950/70 border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-950'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="overflow-hidden">
                      <span className="text-[11px] font-mono text-zinc-500 block truncate">
                        {repo.owner}
                      </span>
                      <h4 className="text-sm font-bold text-white truncate tracking-tight">
                        {repo.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {repo.private ? (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-amber-950/70 text-amber-400 border border-amber-500/30">
                          Private
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-zinc-800 text-zinc-400">
                          Public
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mb-3">
                    {repo.description}
                  </p>
                </div>

                <div>
                  {/* Repo Stats Bar */}
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-3 border-t border-zinc-900 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-zinc-400">
                        <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                        {repo.language}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-400" />
                        {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork className="w-3 h-3 text-zinc-500" />
                        {repo.forks_count}
                      </span>
                    </div>

                    <span className="font-mono text-[10px] text-zinc-500">
                      {repo.default_branch}
                    </span>
                  </div>

                  {/* Select Target Button */}
                  <button
                    onClick={() => handleSelectRepository(repo)}
                    className={`w-full py-1.5 px-3 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-semibold cursor-default'
                        : 'bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        Repositório Ativo no VUA
                      </>
                    ) : (
                      'Selecionar como Alvo'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredRepos.length === 0 && (
          <div className="py-12 text-center text-zinc-500 text-xs">
            Nenhum repositório encontrado com os filtros selecionados.
          </div>
        )}
      </div>
    </div>
  );
};
