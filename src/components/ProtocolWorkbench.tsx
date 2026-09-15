import React, { useState } from 'react';
import {
  Play,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  Send,
  FileCode,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  Fingerprint,
} from 'lucide-react';
import type { ExecutionProof, VortexOperation, VortexResponse } from '../vortex/types.js';

interface ProtocolWorkbenchProps {
  onSendToVerifier: (proof: ExecutionProof) => void;
  activeSessions: Array<{ session_id: string; resource: string }>;
}

export const ProtocolWorkbench: React.FC<ProtocolWorkbenchProps> = ({
  onSendToVerifier,
  activeSessions,
}) => {
  const [selectedTool, setSelectedTool] = useState<VortexOperation>('inspect');
  const [requestId, setRequestId] = useState(`req-${Date.now()}`);
  const [targetRepo, setTargetRepo] = useState('scoobiii/vortex');
  const [targetBranch, setTargetBranch] = useState('feat/governance');
  const [targetPath, setTargetPath] = useState('/workspace/vortex/src/lib.ts');
  const [inputContent, setInputContent] = useState('export const version = "2.0.0";');
  const [approvalToken, setApprovalToken] = useState('vortex-approved-human');
  const [capability, setCapability] = useState('repository.write');
  const [selectedSession, setSelectedSession] = useState(activeSessions[0]?.session_id || '');

  const [loading, setLoading] = useState(false);
  const [lastResponse, setLastResponse] = useState<VortexResponse | null>(null);
  const [rawRpcResponse, setRawRpcResponse] = useState<string>('');
  const [copiedProof, setCopiedProof] = useState(false);

  // Auto-update presets when tool changes
  const handleToolSelect = (tool: VortexOperation) => {
    setSelectedTool(tool);
    setRequestId(`req-${Date.now()}`);
    if (tool === 'inspect') {
      setCapability('repository.read');
    } else if (tool === 'branch.write') {
      setCapability('repository.write');
      setApprovalToken('vortex-approved-human');
    } else if (tool === 'propose') {
      setCapability('repository.read');
    } else if (tool === 'execute') {
      setCapability('sandbox.execute');
    }
  };

  const executeMcpCall = async () => {
    setLoading(true);
    setLastResponse(null);

    const mcpToolName = `vortex.${selectedTool}`;
    const payload = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: mcpToolName,
        arguments: {
          request_id: requestId,
          target: {
            repository: targetRepo,
            branch: targetBranch,
            path: targetPath,
          },
          input: {
            content: inputContent,
            path: targetPath,
            type: selectedTool === 'propose' ? 'patch' : undefined,
          },
          authorization: {
            principal_id: 'scoobiii',
            agent_id: 'agent/vortex-llm',
            policy_id: 'vortex-development',
            policy_version: '1.0.0',
            capability,
            scope: {
              repositories: ['scoobiii/vortex'],
              branches: ['feat/*', 'fix/*'],
              paths: ['/workspace/vortex/*'],
            },
            gos3_session_id: selectedSession || undefined,
            sandbox_id: 'sandbox-default',
          },
          approval_token: approvalToken,
        },
      },
    };

    try {
      const res = await fetch('/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setRawRpcResponse(JSON.stringify(data, null, 2));

      if (data.result) {
        setLastResponse(data.result);
      } else if (data.error) {
        setLastResponse({
          status: 'EXECUTION_ERROR',
          error: { code: String(data.error.code), message: data.error.message },
        });
      }
    } catch (err: unknown) {
      setLastResponse({
        status: 'EXECUTION_ERROR',
        error: { code: 'NETWORK_ERROR', message: String(err) },
      });
    } finally {
      setLoading(false);
    }
  };

  const copyProof = () => {
    if (lastResponse?.execution_proof) {
      navigator.clipboard.writeText(JSON.stringify(lastResponse.execution_proof, null, 2));
      setCopiedProof(true);
      setTimeout(() => setCopiedProof(false), 2000);
    }
  };

  // Pipeline stages
  const stages = [
    { name: 'REQUEST', active: true },
    { name: 'IDENTITY', active: true },
    { name: 'AUTHORIZATION', active: !lastResponse || lastResponse.status !== 'POLICY_DENIED' },
    { name: 'LIMITS', active: !lastResponse || lastResponse.status !== 'SANDBOX_DENIED' },
    { name: 'ONBOARD', active: !lastResponse || lastResponse.status !== 'ONBOARD_REQUIRED' },
    { name: 'EXECUTION', active: lastResponse?.execution_proof?.executed ?? false },
    { name: 'PROOF', active: !!lastResponse?.execution_proof },
    { name: 'VERIFICATION', active: !!lastResponse?.execution_proof?.signature },
  ];

  return (
    <div className="space-y-6">
      {/* Normative Pipeline Visualizer */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
          <span>Normative Governance Pipeline</span>
          <span className="font-mono text-indigo-400">spec §4: Execution cannot skip mandatory steps</span>
        </div>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {stages.map((st, i) => (
            <div
              key={st.name}
              className={`p-2 rounded-lg text-center border transition-all ${
                st.active
                  ? 'bg-zinc-800/90 border-indigo-500/40 text-indigo-200 shadow-sm'
                  : 'bg-zinc-950/60 border-zinc-800 text-zinc-500 opacity-60'
              }`}
            >
              <div className="text-[10px] text-zinc-400 font-mono">0{i + 1}</div>
              <div className="text-xs font-bold font-mono tracking-tight">{st.name}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Tool Selector & Arguments */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-indigo-400" />
              MCP Governed Tool Invocation
            </h2>

            {/* Semantic Tool Selector */}
            <div>
              <label className="text-xs font-medium text-zinc-300 mb-2 block">
                Semantic Operation (spec §5)
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {(['inspect', 'propose', 'verify', 'execute', 'branch.write'] as VortexOperation[]).map(
                  (tool) => (
                    <button
                      key={tool}
                      onClick={() => handleToolSelect(tool)}
                      className={`px-2.5 py-2 text-xs font-mono font-medium rounded-lg border transition ${
                        selectedTool === tool
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow'
                          : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      {tool}
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Request Parameters */}
            <div className="space-y-3 pt-2 border-t border-zinc-800 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Request ID (Temporal Nonce)</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={requestId}
                      onChange={(e) => setRequestId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                    />
                    <button
                      onClick={() => setRequestId(`req-${Date.now()}`)}
                      className="px-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300"
                      title="Generate new nonce"
                    >
                      ↻
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-zinc-400 block mb-1">Capability Claim</label>
                  <select
                    value={capability}
                    onChange={(e) => setCapability(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                  >
                    <option value="repository.read">repository.read (side_effect=false)</option>
                    <option value="repository.write">repository.write (scoped branch)</option>
                    <option value="sandbox.execute">sandbox.execute (bounded process)</option>
                    <option value="unauthorized.admin">unauthorized.admin (attack test)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 block mb-1">Target Repository</label>
                  <input
                    type="text"
                    value={targetRepo}
                    onChange={(e) => setTargetRepo(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Target Branch</label>
                  <input
                    type="text"
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Target Path (Filesystem Scope)</label>
                <input
                  type="text"
                  value={targetPath}
                  onChange={(e) => setTargetPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                />
              </div>

              {selectedTool === 'branch.write' && (
                <div>
                  <label className="text-zinc-400 block mb-1">
                    GOS3 Session (spec §8: Resource Onboard Contract)
                  </label>
                  <select
                    value={selectedSession}
                    onChange={(e) => setSelectedSession(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                  >
                    <option value="">-- No GOS3 Session (triggers ONBOARD_REQUIRED) --</option>
                    {activeSessions.map((s) => (
                      <option key={s.session_id} value={s.session_id}>
                        {s.session_id} ({s.resource})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-zinc-400 block mb-1">Input / Payload Content</label>
                <textarea
                  rows={3}
                  value={inputContent}
                  onChange={(e) => setInputContent(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200 resize-y"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Human Approval Token (spec §15: AUTHORIZED != APPROVED)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={approvalToken}
                    onChange={(e) => setApprovalToken(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200"
                  />
                  <button
                    onClick={() => setApprovalToken('')}
                    className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-xs"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setApprovalToken('vortex-approved-human')}
                    className="px-2 py-1 bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 rounded text-xs font-mono"
                  >
                    Set
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={executeMcpCall}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition shadow-md"
            >
              <Play className="w-4 h-4 fill-current" />
              {loading ? 'Executing Governed Pipeline...' : `Execute tools/call (vortex.${selectedTool})`}
            </button>
          </div>
        </div>

        {/* Right Column: Execution Results & ExecutionProof */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Vortex Execution & Evidence Result
              </h2>
              {lastResponse?.execution_proof && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyProof}
                    className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded"
                  >
                    <Copy className="w-3 h-3" />
                    {copiedProof ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={() => onSendToVerifier(lastResponse.execution_proof!)}
                    className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-1 rounded font-medium"
                  >
                    Audit in Verifier →
                  </button>
                </div>
              )}
            </div>

            {lastResponse ? (
              <div className="space-y-4 flex-1 flex flex-col text-xs">
                {/* Status Card */}
                <div
                  className={`p-3.5 rounded-lg border flex items-center justify-between ${
                    lastResponse.status === 'EXECUTION_SUCCESS'
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : lastResponse.status === 'POLICY_DENIED' ||
                        lastResponse.status === 'SANDBOX_DENIED' ||
                        lastResponse.status === 'REPLAY_REJECTED'
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {lastResponse.status === 'EXECUTION_SUCCESS' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold font-mono text-sm">{lastResponse.status}</div>
                      <div className="text-[11px] opacity-80">
                        {lastResponse.error?.message || 'Operation executed within governed limits'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono text-[11px]">
                    <div>
                      executed:{' '}
                      <span className="font-bold">
                        {String(lastResponse.execution_proof?.executed ?? false)}
                      </span>
                    </div>
                    {lastResponse.execution_proof && (
                      <div className="opacity-75">{lastResponse.execution_proof.duration_ms}ms</div>
                    )}
                  </div>
                </div>

                {/* ExecutionProof Details */}
                {lastResponse.execution_proof && (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 space-y-2 font-mono text-[11px]">
                    <div className="flex items-center justify-between text-zinc-400 pb-1 border-b border-zinc-800">
                      <span className="flex items-center gap-1 text-indigo-400 font-semibold">
                        <Fingerprint className="w-3.5 h-3.5" />
                        ExecutionProof v1 (RFC 8785 Canonical)
                      </span>
                      <span>{lastResponse.execution_proof.identity.algorithm}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-zinc-300">
                      <div>
                        <span className="text-zinc-500">request_id:</span> {lastResponse.execution_proof.request_id}
                      </div>
                      <div>
                        <span className="text-zinc-500">execution_id:</span> {lastResponse.execution_proof.execution_id}
                      </div>
                      <div>
                        <span className="text-zinc-500">key_id:</span> {lastResponse.execution_proof.identity.key_id}
                      </div>
                      <div>
                        <span className="text-zinc-500">connector:</span> {lastResponse.execution_proof.connector_id}
                      </div>
                    </div>

                    <div className="space-y-1 pt-1 text-zinc-400">
                      <div className="truncate">
                        <span className="text-zinc-500">input_hash:</span> {lastResponse.execution_proof.input_hash}
                      </div>
                      <div className="truncate">
                        <span className="text-zinc-500">output_hash:</span> {lastResponse.execution_proof.output_hash}
                      </div>
                      <div className="truncate text-emerald-400">
                        <span className="text-zinc-500">signature:</span> {lastResponse.execution_proof.signature}
                      </div>
                    </div>
                  </div>
                )}

                {/* Output payload */}
                {lastResponse.output && (
                  <div className="flex-1 min-h-[140px] bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-auto">
                    <div className="text-zinc-500 text-[10px] uppercase font-mono mb-1">
                      Connector Output
                    </div>
                    <pre className="font-mono text-zinc-300 text-[11px] whitespace-pre-wrap">
                      {JSON.stringify(lastResponse.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border border-dashed border-zinc-800 rounded-lg text-zinc-500">
                <Terminal className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs">No execution requested yet.</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Select an operation and click Execute tools/call to trigger the full governance pipeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
