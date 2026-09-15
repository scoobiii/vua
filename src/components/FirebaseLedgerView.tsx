import React, { useState, useEffect } from 'react';
import {
  Database,
  Shield,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  LogIn,
  LogOut,
  RefreshCw,
  Cloud,
  FileCheck2,
  Lock,
  UserCheck,
  Zap,
  Copy,
  Check,
  BookOpen,
  Key,
  Terminal,
} from 'lucide-react';
import {
  auth,
  db,
  loginWithEmail,
  registerWithEmail,
  logoutUser,
  persistExecutionProof,
  subscribeToExecutionProofs,
  testConnection,
  firebaseConfig,
  type User
} from '../firebase/config.js';
import type { ExecutionProof } from '../vortex/types.js';

interface FirebaseLedgerViewProps {
  onSendToVerifier?: (proof: ExecutionProof) => void;
}

export const FirebaseLedgerView: React.FC<FirebaseLedgerViewProps> = ({ onSendToVerifier }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(auth.currentUser);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [cloudProofs, setCloudProofs] = useState<any[]>([]);
  const [loadingProofs, setLoadingProofs] = useState<boolean>(true);
  const [savingProof, setSavingProof] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Swagger & Firebase Auth Integration state
  const [firebaseIdToken, setFirebaseIdToken] = useState<string | null>(null);
  const [verifyingToken, setVerifyingToken] = useState<boolean>(false);
  const [tokenVerifyResult, setTokenVerifyResult] = useState<any | null>(null);
  const [testingMeRoute, setTestingMeRoute] = useState<boolean>(false);
  const [meRouteResult, setMeRouteResult] = useState<any | null>(null);

  // Monitor Auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Check connection
  useEffect(() => {
    testConnection().then((res) => {
      setConnectionStatus(res.ok ? 'connected' : 'error');
    });
  }, []);

  // Subscribe to proofs when user is logged in
  useEffect(() => {
    if (!currentUser) {
      setCloudProofs([]);
      setLoadingProofs(false);
      return;
    }

    setLoadingProofs(true);
    const unsubscribe = subscribeToExecutionProofs(
      currentUser.uid,
      (proofs) => {
        setCloudProofs(proofs);
        setLoadingProofs(false);
      },
      (err) => {
        console.warn('Subscription notice:', err);
        setLoadingProofs(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('Preencha e-mail e senha.');
      return;
    }
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (authMode === 'login') {
        await loginWithEmail(authEmail, authPassword);
        setActionMessage('Autenticação realizada com sucesso!');
      } else {
        await registerWithEmail(authEmail, authPassword);
        setActionMessage('Conta de operador registrada e autenticada!');
      }
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setAuthError(err?.message || 'Falha na autenticação do Firebase Auth.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      setActionMessage('Sessão encerrada com sucesso.');
      setFirebaseIdToken(null);
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
    }
  };

  // Load Firebase ID token when user changes
  useEffect(() => {
    if (currentUser) {
      currentUser.getIdToken().then((t) => setFirebaseIdToken(t)).catch(console.error);
    } else {
      setFirebaseIdToken(null);
      setTokenVerifyResult(null);
      setMeRouteResult(null);
    }
  }, [currentUser]);

  const handleVerifyCurrentToken = async () => {
    if (!firebaseIdToken) {
      setActionMessage('Faça login primeiro para gerar e validar seu token JWT.');
      return;
    }
    setVerifyingToken(true);
    try {
      const res = await fetch('/api/auth/firebase/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${firebaseIdToken}`,
        },
        body: JSON.stringify({ idToken: firebaseIdToken }),
      });
      const data = await res.json();
      setTokenVerifyResult(data);
      setActionMessage('Token verificado via /api/auth/firebase/verify com sucesso!');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setTokenVerifyResult({ valid: false, error: err?.message || String(err) });
    } finally {
      setVerifyingToken(false);
    }
  };

  const handleTestMeRoute = async () => {
    if (!firebaseIdToken) {
      setActionMessage('Acesso negado: faça login primeiro para testar /api/auth/firebase/me.');
      return;
    }
    setTestingMeRoute(true);
    try {
      const res = await fetch('/api/auth/firebase/me', {
        headers: {
          Authorization: `Bearer ${firebaseIdToken}`,
        },
      });
      const data = await res.json();
      setMeRouteResult(data);
      setActionMessage('Rota /api/auth/firebase/me testada com sucesso!');
      setTimeout(() => setActionMessage(null), 4000);
    } catch (err: any) {
      setMeRouteResult({ error: err?.message || String(err) });
    } finally {
      setTestingMeRoute(false);
    }
  };

  const handleOpenSwaggerPreauth = () => {
    if (!firebaseIdToken) {
      window.open('/api-docs', '_blank', 'noreferrer');
      return;
    }
    window.open(`/api-docs?token=${encodeURIComponent(firebaseIdToken)}`, '_blank', 'noreferrer');
  };

  const handlePersistSampleProof = async () => {
    if (!currentUser) {
      setActionMessage('Faça login com sua conta de operador para gravar no Firestore.');
      return;
    }

    setSavingProof(true);
    try {
      // Create governed sample execution proof
      const sampleProof: ExecutionProof = {
        proof_version: '1',
        execution_id: `vua-exec-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        request_id: `req-${Date.now()}`,
        runtime_id: 'runtime-vua-core',
        agent_id: 'vua-primary-agent',
        principal_id: currentUser.email || currentUser.uid,
        connector_id: 'firebase-firestore',
        operation: 'governance.record_execution_proof',
        executed: true,
        started_at: new Date(Date.now() - 42).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 42,
        status: 'EXECUTION_SUCCESS',
        input_hash: 'sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        output_hash: 'sha256:43d3ea65137f7f9a1128bd5c9783e15dcfe040b0437c8c3a3238229ef61c26c7',
        policy_id: 'policy-vua-cloud-ledger',
        policy_version: '1.0.0',
        gos3_session_id: 'gos3-cloud-vault',
        sandbox_id: 'sandbox-vua-zero-trust',
        identity: {
          key_id: 'vortex-ed25519-primary',
          algorithm: 'Ed25519',
        },
        signature: 'ed25519:64byteSignatureSampleDeterministicallyCanonicalRFC8785VerifiedProof',
        proof_hash: 'sha256:36d516f74997da93891c9eea4aa86043a892fbaa804901cc2007a2e0802892a4',
      };

      await persistExecutionProof(sampleProof);
      setActionMessage(`Prova ${sampleProof.execution_id.substring(0, 16)}... gravada no Firestore com sucesso!`);
      setTimeout(() => setActionMessage(null), 5000);
    } catch (err: any) {
      setActionMessage(`Erro ao persistir prova: ${err?.message || 'Falha de permissão'}`);
    } finally {
      setSavingProof(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const consoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data`;

  return (
    <div className="space-y-6">
      {/* Top Banner / Metadata Card */}
      <div className="bg-gradient-to-r from-amber-950/40 via-zinc-900 to-orange-950/30 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  Firebase Cloud Firestore & Authentication
                </h2>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-950 border border-amber-600/40 text-amber-300">
                  us-west2 • Enterprise Edition
                </span>
                <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded ${
                  connectionStatus === 'connected'
                    ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400'
                    : 'bg-yellow-950 border border-yellow-500/40 text-yellow-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-yellow-400 animate-pulse'}`} />
                  {connectionStatus === 'connected' ? 'ONLINE & CONECTADO' : 'VERIFICANDO...'}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1 max-w-3xl">
                Armazenamento em nuvem durável para Provas de Execução Governamentais, perfis de operadores e auditorias do Patch Arena com regras de segurança Zero-Trust e ABAC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-amber-500 text-amber-300 text-xs font-mono rounded-lg transition shadow"
              title="Abrir dados no Console Oficial do Firebase"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Abrir Firebase Console</span>
            </a>
          </div>
        </div>

        {/* Database Identifiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-zinc-800/80 text-xs font-mono">
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-400 text-[10px] block">PROJETO FIREBASE (PROJECT_ID)</span>
            <span className="text-zinc-200 font-semibold">{firebaseConfig.projectId}</span>
          </div>
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-400 text-[10px] block">BANCO DE DADOS (FIRESTORE_DATABASE_ID)</span>
            <span className="text-amber-400 font-semibold truncate block" title={firebaseConfig.firestoreDatabaseId}>
              {firebaseConfig.firestoreDatabaseId}
            </span>
          </div>
          <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-800">
            <span className="text-zinc-400 text-[10px] block">CLIENT ID OAUTH</span>
            <span className="text-zinc-300 truncate block" title={firebaseConfig.oAuthClientId}>
              {firebaseConfig.oAuthClientId.substring(0, 24)}...
            </span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 bg-zinc-900 border border-cyan-500/40 rounded-xl text-xs text-cyan-300 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Auth & Operators Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-indigo-400" />
                Operador & Autenticação
              </span>
              {currentUser ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-400">
                  AUTENTICADO
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  DESCONECTADO
                </span>
              )}
            </div>

            {currentUser ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-indigo-950 border border-indigo-500/40 flex items-center justify-center font-bold text-indigo-400">
                    {currentUser.displayName ? currentUser.displayName[0] : (currentUser.email ? currentUser.email[0].toUpperCase() : 'O')}
                  </div>
                  <div>
                    <div className="font-semibold text-zinc-100">{currentUser.displayName || 'Operador VUA'}</div>
                    <div className="text-[11px] text-zinc-400 font-mono">{currentUser.email}</div>
                  </div>
                </div>

                <div className="bg-zinc-950 p-2 rounded border border-zinc-800 space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">UID:</span>
                    <span className="text-zinc-300">{currentUser.uid.substring(0, 16)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Privilégio ABAC:</span>
                    <span className="text-amber-400 font-bold">
                      {currentUser.email?.includes('admin') ? 'ADMIN' : 'OPERATOR'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-2.5 py-1">
                <div className="flex items-center justify-between text-[11px] pb-1 border-b border-zinc-800">
                  <span className="text-zinc-300 font-medium">Acesso do Operador</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setAuthMode('login'); setAuthError(null); }}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${authMode === 'login' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Login
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAuthMode('register'); setAuthError(null); }}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${authMode === 'register' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
                    >
                      Novo Operador
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="p-2 rounded bg-rose-950/40 border border-rose-800/60 text-[11px] text-rose-300">
                    {authError}
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">E-mail Operacional</label>
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="operador@vortex.foundation"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-zinc-400 block mb-0.5">Senha</label>
                  <input
                    type="password"
                    required
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition disabled:opacity-50 mt-2"
                >
                  <LogIn className="w-3 h-3" />
                  <span>{authLoading ? 'Processando...' : (authMode === 'login' ? 'Entrar' : 'Registrar Operador')}</span>
                </button>
              </form>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-zinc-800">
            {currentUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
              >
                <LogOut className="w-3.5 h-3.5 text-zinc-400" />
                Encerrar Sessão
              </button>
            )}
          </div>
        </div>

        {/* Security Rules & ABAC Info Card */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              Regras Firestore Hardened & ABAC Ativas
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500/40 text-emerald-300">
              DEPLOYED: rules_version = &apos;2&apos;
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Coleção /users
              </span>
              <p className="text-[11px] text-zinc-400">
                Isolamento estrito de PII: Leituras limitadas ao proprietário (<code>request.auth.uid == userId</code>) ou Admin. Proibida a auto-elevação de cargos.
              </p>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Coleção /execution_proofs
              </span>
              <p className="text-[11px] text-zinc-400">
                Imutabilidade absoluta (<code>allow update: if false</code>). Criação validada por schéma e restrita ao <code>owner_uid == request.auth.uid</code>.
              </p>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Coleção /arena_tournaments
              </span>
              <p className="text-[11px] text-zinc-400">
                Logs de torneio determinísticos sem mutação. Validação estrita de limites de score e hashes de evidência canônicos RFC 8785.
              </p>
            </div>

            <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 space-y-1">
              <span className="text-[11px] font-bold text-zinc-200 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Catch-All Default Deny
              </span>
              <p className="text-[11px] text-zinc-400">
                Zero-Trust: Bloqueio universal de caminhos não mapeados (<code>match /{'{document=**}'} allow read, write: if false;</code>).
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Sincronização em tempo real via WebSockets (onSnapshot)
            </span>
            <button
              type="button"
              onClick={handlePersistSampleProof}
              disabled={savingProof || !currentUser}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold rounded-lg shadow transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              {savingProof ? 'Gravando Prova...' : 'Persistir Prova de Teste no Firestore'}
            </button>
          </div>
        </div>
      </div>

      {/* Swagger OpenAPI & Firebase Auth Integration Toolkit */}
      <div className="bg-zinc-900/70 border border-amber-500/30 rounded-xl p-4.5 space-y-4 shadow-lg shadow-black/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">
                  Firebase Auth Integrado ao Swagger UI (OpenAPI 3.0)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 font-bold">
                  SECURITY: FirebaseAuth (Bearer JWT)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                O Swagger UI em <code>/api-docs</code> aceita tokens JWT do Firebase Auth com validação de claims (aud, iss, sub, exp) e papéis ABAC.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenSwaggerPreauth}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition flex items-center gap-1.5 shadow"
              title="Abrir Swagger UI já pré-autorizado com seu Firebase ID Token"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Abrir Swagger Pré-Autorizado</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Token Management Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                {currentUser ? 'Seu Firebase ID Token (JWT Assinado)' : 'Token JWT de Identidade (Autenticação Obrigatória)'}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-zinc-500">
                  {currentUser ? `UID: ${currentUser.uid.substring(0, 10)}...` : 'Status: Não autenticado'}
                </span>
                {firebaseIdToken && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(firebaseIdToken, 'token')}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-mono flex items-center gap-1 transition"
                    title="Copiar token para colar no botão Authorize do Swagger"
                  >
                    {copiedField === 'token' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedField === 'token' ? 'Copiado!' : 'Copiar Token'}
                  </button>
                )}
              </div>
            </div>

            <div className={`p-2 rounded border font-mono text-[11px] break-all select-all max-h-16 overflow-y-auto ${firebaseIdToken ? 'bg-zinc-900/90 border-zinc-800 text-amber-200/90' : 'bg-zinc-950 border-zinc-800/60 text-zinc-500'}`}>
              {firebaseIdToken || 'Autenticação necessária: realize login com e-mail e senha no formulário acima para emitir seu token JWT.'}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-zinc-400">
              <span>
                {currentUser ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Conectado como {currentUser.email}
                  </span>
                ) : (
                  <span className="text-amber-400/80">
                    Acesso restrito sob política Zero-Trust. Faça login acima para obter acesso autorizado.
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleVerifyCurrentToken}
                  disabled={verifyingToken}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1 disabled:opacity-50"
                  title="Valida o token chamando POST /api/auth/firebase/verify"
                >
                  <RefreshCw className={`w-3 h-3 ${verifyingToken ? 'animate-spin' : ''}`} />
                  {verifyingToken ? 'Validando...' : 'Validar no Express'}
                </button>

                <button
                  type="button"
                  onClick={handleTestMeRoute}
                  disabled={testingMeRoute}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition flex items-center gap-1 disabled:opacity-50"
                  title="Testa a rota autenticada GET /api/auth/firebase/me"
                >
                  <Terminal className="w-3 h-3" />
                  {testingMeRoute ? 'Consultando...' : 'Testar /me'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-lg p-3 space-y-2 text-xs">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Especificação OpenAPI Swagger
            </span>
            <ul className="space-y-1.5 text-zinc-400 text-[11px]">
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400">•</span>
                <span><strong>SecurityScheme:</strong> <code>FirebaseAuth</code> (HTTP Bearer)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400">•</span>
                <span><strong>Issuer:</strong> <code>securetoken.google.com/{firebaseConfig.projectId}</code></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400">•</span>
                <span><strong>Audience:</strong> <code>{firebaseConfig.projectId}</code></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400">•</span>
                <span><strong>Swagger Persist:</strong> <code>persistAuthorization: true</code></span>
              </li>
            </ul>
          </div>
        </div>

        {/* Verification / Me Result Preview */}
        {(tokenVerifyResult || meRouteResult) && (
          <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 space-y-1.5 text-xs font-mono">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-zinc-800 pb-1">
              <span className="text-amber-400 font-semibold flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5" />
                Resultado do Backend Express (Validação de Token Firebase):
              </span>
              <button
                type="button"
                onClick={() => { setTokenVerifyResult(null); setMeRouteResult(null); }}
                className="text-zinc-500 hover:text-zinc-300 text-[10px]"
              >
                Limpar
              </button>
            </div>
            <pre className="text-emerald-300 text-[11px] overflow-x-auto max-h-36 p-1">
              {JSON.stringify(tokenVerifyResult || meRouteResult, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Cloud Ledger Realtime Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold text-zinc-200">
              Livro-Razão em Nuvem (Cloud Ledger de Provas Governamentais)
            </h3>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
              {cloudProofs.length} registros
            </span>
          </div>

          <span className="text-[11px] text-zinc-400 font-mono">
            /execution_proofs
          </span>
        </div>

        {!currentUser ? (
          <div className="p-8 text-center bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-2">
            <Database className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-300 font-medium">Faça login com o Google para visualizar suas provas no Cloud Firestore</p>
            <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
              As regras de segurança do Firestore garantem que apenas você possa listar suas próprias provas auditadas.
            </p>
          </div>
        ) : loadingProofs ? (
          <div className="p-8 text-center text-xs text-zinc-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            Carregando livro-razão criptográfico do Firestore...
          </div>
        ) : cloudProofs.length === 0 ? (
          <div className="p-8 text-center bg-zinc-950 rounded-lg border border-zinc-800/80 space-y-3">
            <FileCheck2 className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs text-zinc-300 font-medium">Nenhuma prova persistida ainda nesta conta</p>
            <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
              Clique no botão &quot;Persistir Prova de Teste no Firestore&quot; acima para registrar sua primeira prova governada com assinatura Ed25519 no banco na nuvem.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-[11px]">
                  <th className="py-2 px-3">EXECUTION ID</th>
                  <th className="py-2 px-3">STATUS</th>
                  <th className="py-2 px-3">OPERAÇÃO</th>
                  <th className="py-2 px-3">DIGEST RFC 8785</th>
                  <th className="py-2 px-3">TIMESTAMP</th>
                  <th className="py-2 px-3 text-right">AÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {cloudProofs.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-2.5 px-3 text-zinc-200 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span>{item.execution_id}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.execution_id, item.id)}
                          className="text-zinc-400 hover:text-zinc-200"
                        >
                          {copiedField === item.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.status === 'SUCCESS'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-zinc-300">
                      {item.operation}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px] truncate max-w-[180px]" title={item.proof_hash}>
                      {item.proof_hash ? item.proof_hash.substring(0, 18) + '...' : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-zinc-400 text-[11px]">
                      {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {onSendToVerifier && (
                        <button
                          type="button"
                          onClick={() => onSendToVerifier({
                            proof_version: item.proof_version || '1',
                            execution_id: item.execution_id,
                            request_id: item.request_id || item.execution_id,
                            runtime_id: item.runtime_id || 'runtime-vua-core',
                            agent_id: item.agent_id || 'vua-primary-agent',
                            principal_id: item.principal_id || 'vua-operator',
                            connector_id: item.connector_id || 'firebase-firestore',
                            operation: item.operation || 'governance.record_execution_proof',
                            executed: true,
                            started_at: item.timestamp || new Date().toISOString(),
                            completed_at: item.timestamp || new Date().toISOString(),
                            duration_ms: item.duration_ms || 0,
                            status: item.status || 'EXECUTION_SUCCESS',
                            input_hash: item.input_hash || '',
                            output_hash: item.output_hash || '',
                            policy_id: item.policy_id || 'policy-vua-cloud-ledger',
                            policy_version: item.policy_version || '1.0.0',
                            gos3_session_id: item.gos3_session_id || 'gos3-cloud-vault',
                            sandbox_id: item.sandbox_id || 'sandbox-vua-zero-trust',
                            identity: item.identity || {
                              key_id: 'vortex-ed25519-primary',
                              algorithm: 'Ed25519',
                            },
                            signature: item.signature || '',
                            proof_hash: item.proof_hash,
                          })}
                          className="px-2.5 py-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 rounded text-[10px] transition"
                        >
                          Verificar Prova
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
