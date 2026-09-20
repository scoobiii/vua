import React, { useState, useEffect } from 'react';
import { Header } from './components/Header.js';
import { VUAAdaptersView } from './components/VUAAdaptersView.js';
import { GitHubRepoManager } from './components/GitHubRepoManager.js';
import { ProtocolWorkbench } from './components/ProtocolWorkbench.js';
import { LLMGatewayView } from './components/LLMGatewayView.js';
import { IndependentVerifierView } from './components/IndependentVerifierView.js';
import { FoundationE2ESuite } from './components/FoundationE2ESuite.js';
import { AdversarialMatrix } from './components/AdversarialMatrix.js';
import { GOS3SandboxManager } from './components/GOS3SandboxManager.js';
import { CIBenchmarkGate } from './components/CIBenchmarkGate.js';
import { MascotModal } from './components/MascotModal.js';
import { SemanticOracleView } from './components/SemanticOracleView.js';
import { CapabilityMatrix } from './components/CapabilityMatrix.js';
import { FirebaseLedgerView } from './components/FirebaseLedgerView.js';
import { BendDevelopmentView } from './components/BendDevelopmentView.js';
import type { ExecutionProof } from './vortex/types.js';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('vua-adapters');
  const [status, setStatus] = useState<any>(null);
  const [selectedProofForVerification, setSelectedProofForVerification] = useState<ExecutionProof | null>(null);
  const [activeSessions, setActiveSessions] = useState<Array<{ session_id: string; resource: string }>>([]);
  const [isMascotOpen, setIsMascotOpen] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/vortex/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch Vortex status:', err);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/vortex/gos3/sessions');
      const data = await res.json();
      setActiveSessions(data || []);
    } catch (err) {
      console.error('Failed to fetch GOS3 sessions:', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchSessions();
  }, []);

  const handleRotateKey = async () => {
    try {
      await fetch('/api/vortex/keys/rotate', { method: 'POST' });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendToVerifier = (proof: ExecutionProof) => {
    setSelectedProofForVerification(proof);
    setActiveTab('verifier');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <Header
        status={status}
        onRotateKey={handleRotateKey}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenMascot={() => setIsMascotOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {activeTab === 'vua-adapters' && (
          <VUAAdaptersView onSendToVerifier={handleSendToVerifier} />
        )}

        {activeTab === 'bend-dev' && (
          <BendDevelopmentView />
        )}

        {activeTab === 'firebase-ledger' && (
          <FirebaseLedgerView onSendToVerifier={handleSendToVerifier} />
        )}

        {activeTab === 'capability-matrix' && (
          <CapabilityMatrix />
        )}

        {activeTab === 'semantic-oracle' && (
          <SemanticOracleView />
        )}

        {activeTab === 'github-manager' && (
          <GitHubRepoManager
            onSendToVerifier={handleSendToVerifier}
            onOpenMascot={() => setIsMascotOpen(true)}
          />
        )}

        {activeTab === 'workbench' && (
          <ProtocolWorkbench
            onSendToVerifier={handleSendToVerifier}
            activeSessions={activeSessions}
          />
        )}

        {activeTab === 'llm-gateway' && (
          <LLMGatewayView
            onSendToVerifier={handleSendToVerifier}
          />
        )}

        {activeTab === 'verifier' && (
          <IndependentVerifierView
            initialProof={selectedProofForVerification}
            recentProofs={status?.recent_proofs || []}
          />
        )}

        {activeTab === 'e2e' && <FoundationE2ESuite />}

        {activeTab === 'adversarial' && <AdversarialMatrix />}

        {activeTab === 'gos3' && (
          <GOS3SandboxManager
            onSessionCreated={() => {
              fetchSessions();
              fetchStatus();
            }}
          />
        )}

        {activeTab === 'ci-benchmark' && <CIBenchmarkGate />}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-6 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>VUA (Vortex Universal Adapter) • Open Governance Protocol</span>
          <span className="font-mono text-[11px] text-zinc-400">
            SAFETY = AUTHORIZATION + BOUNDED EXECUTION + ACCOUNTABILITY + INDEPENDENT VERIFICATION + IDENTITY
          </span>
        </div>
      </footer>

      {/* VUA O'Reilly Mascot Modal */}
      <MascotModal
        isOpen={isMascotOpen}
        onClose={() => setIsMascotOpen(false)}
      />
    </div>
  );
}
