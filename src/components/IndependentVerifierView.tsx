import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  CheckCircle,
  XCircle,
  Hash,
  FileCheck,
  RotateCcw,
  Sparkles,
  AlertOctagon,
  Copy,
  ExternalLink,
} from 'lucide-react';
import type { ExecutionProof, VerificationResult } from '../vortex/types.js';

interface IndependentVerifierViewProps {
  initialProof?: ExecutionProof | null;
  recentProofs: ExecutionProof[];
}

export const IndependentVerifierView: React.FC<IndependentVerifierViewProps> = ({
  initialProof,
  recentProofs,
}) => {
  const [proofJson, setProofJson] = useState<string>('');
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tamperedField, setTamperedField] = useState<string | null>(null);

  useEffect(() => {
    if (initialProof) {
      setProofJson(JSON.stringify(initialProof, null, 2));
      verifyProof(initialProof);
    } else if (recentProofs.length > 0) {
      setProofJson(JSON.stringify(recentProofs[0], null, 2));
      verifyProof(recentProofs[0]);
    }
  }, [initialProof, recentProofs]);

  const verifyProof = async (proofObj?: ExecutionProof) => {
    setLoading(true);
    let parsed: ExecutionProof;
    try {
      parsed = proofObj || JSON.parse(proofJson);
    } catch (err) {
      setVerificationResult({
        valid: false,
        status: 'VERIFICATION_FAILED',
        reasons: [`JSON parsing error: ${err}`],
        checks: {} as any,
        verified_at: new Date().toISOString(),
      });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/vortex/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: parsed }),
      });
      const data: VerificationResult = await res.json();
      setVerificationResult(data);
    } catch (err: unknown) {
      setVerificationResult({
        valid: false,
        status: 'VERIFICATION_FAILED',
        reasons: [`Verifier network fault: ${err}`],
        checks: {} as any,
        verified_at: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  // Tamper Attack Simulator
  const applyTamper = (type: 'output_hash' | 'executed' | 'agent_id' | 'signature') => {
    try {
      const parsed: ExecutionProof = JSON.parse(proofJson);
      if (type === 'output_hash') {
        parsed.output_hash = 'sha256:0000000000000000000000000000000000000000000000000000000000000000';
      } else if (type === 'executed') {
        parsed.executed = !parsed.executed;
      } else if (type === 'agent_id') {
        parsed.agent_id = 'agent/rogue-unauthorized';
      } else if (type === 'signature') {
        parsed.signature = Buffer.from('corrupted-signature-bytes').toString('base64');
      }

      setTamperedField(type);
      setProofJson(JSON.stringify(parsed, null, 2));
      verifyProof(parsed);
    } catch {
      // Ignored
    }
  };

  const handleSelectRecent = (proof: ExecutionProof) => {
    setTamperedField(null);
    setProofJson(JSON.stringify(proof, null, 2));
    verifyProof(proof);
  };

  const checkKeys = verificationResult?.checks
    ? (Object.keys(verificationResult.checks) as Array<keyof VerificationResult['checks']>)
    : [];

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Independent Verifier (spec §19 & §20)
            </h2>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              The verifier does NOT trust the agent or executor. It independently reconstructs the RFC 8785
              canonical JSON representation, evaluates SHA-256 digests, validates Ed25519 signatures, audits
              timestamps, and enforces anti-replay invariants.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400">Recent Proofs:</span>
            <div className="flex gap-1">
              {recentProofs.slice(0, 3).map((p, i) => (
                <button
                  key={p.execution_id || i}
                  onClick={() => handleSelectRecent(p)}
                  className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-mono border border-zinc-700"
                >
                  #{i + 1} ({p.operation})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Proof Input & Tamper Simulator */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Execution Proof JSON
              </h3>
              {tamperedField && (
                <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono flex items-center gap-1">
                  <AlertOctagon className="w-3 h-3" />
                  TAMPERED: {tamperedField}
                </span>
              )}
            </div>

            <textarea
              rows={14}
              value={proofJson}
              onChange={(e) => {
                setProofJson(e.target.value);
                setTamperedField(null);
              }}
              placeholder="Paste ExecutionProof JSON here..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-[11px] text-zinc-300 resize-y focus:border-indigo-500 focus:outline-none"
            />

            {/* Tamper attack test bar */}
            <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-2">
              <div className="text-[11px] font-semibold text-zinc-300 flex items-center justify-between">
                <span>Adversarial Tamper Simulation (spec §21)</span>
                <span className="text-[10px] text-zinc-500">Inject deliberate corruption</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
                <button
                  onClick={() => applyTamper('output_hash')}
                  className="px-2 py-1.5 bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-200 border border-zinc-700 rounded text-[11px] font-mono transition"
                >
                  Mutate Hash
                </button>
                <button
                  onClick={() => applyTamper('executed')}
                  className="px-2 py-1.5 bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-200 border border-zinc-700 rounded text-[11px] font-mono transition"
                >
                  Flip Executed
                </button>
                <button
                  onClick={() => applyTamper('agent_id')}
                  className="px-2 py-1.5 bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-200 border border-zinc-700 rounded text-[11px] font-mono transition"
                >
                  Spoof Agent ID
                </button>
                <button
                  onClick={() => applyTamper('signature')}
                  className="px-2 py-1.5 bg-zinc-800 hover:bg-rose-900/60 text-zinc-300 hover:text-rose-200 border border-zinc-700 rounded text-[11px] font-mono transition"
                >
                  Corrupt Sig
                </button>
              </div>
            </div>

            <button
              onClick={() => verifyProof()}
              disabled={loading || !proofJson}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition shadow"
            >
              <FileCheck className="w-4 h-4" />
              {loading ? 'Recomputing JCS & Ed25519 Verification...' : 'Audit Proof Independently'}
            </button>
          </div>
        </div>

        {/* Right Column: Audit Results */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              Audit Verdict & Invariant Checks
            </h3>

            {verificationResult ? (
              <div className="space-y-4 text-xs">
                {/* Overall Verdict Banner */}
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between ${
                    verificationResult.valid
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {verificationResult.valid ? (
                      <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
                    ) : (
                      <ShieldAlert className="w-7 h-7 text-rose-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-bold text-sm font-mono tracking-tight">
                        {verificationResult.status}
                      </div>
                      <div className="text-[11px] opacity-80 mt-0.5">
                        {verificationResult.valid
                          ? 'All 10 normative verification properties verified independently'
                          : verificationResult.reasons.join(' • ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 10 Audit Check Items */}
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {checkKeys.map((key) => {
                    const check = verificationResult.checks[key];
                    if (!check) return null;
                    return (
                      <div
                        key={key}
                        className={`p-2.5 rounded-lg border flex items-start justify-between gap-3 text-xs ${
                          check.passed
                            ? 'bg-zinc-950/70 border-zinc-800/80 text-zinc-300'
                            : 'bg-rose-950/20 border-rose-900/50 text-rose-200'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {check.passed ? (
                            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-mono font-semibold capitalize">
                              {key.replace('_', ' ')}
                            </div>
                            <div className="text-[11px] text-zinc-400 mt-0.5">{check.message}</div>
                          </div>
                        </div>

                        <span
                          className={`font-mono text-[10px] px-1.5 py-0.5 rounded uppercase ${
                            check.passed ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}
                        >
                          {check.passed ? 'OK' : 'FAIL'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* JCS Canonical representation snippet */}
                {verificationResult.canonical_jcs && (
                  <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                    <div className="text-[10px] uppercase font-mono text-zinc-500">
                      RFC 8785 JCS Canonical String (Pre-Hash / Pre-Signature)
                    </div>
                    <pre className="font-mono text-[10px] text-zinc-400 truncate">
                      {verificationResult.canonical_jcs}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-zinc-800 rounded-lg text-center text-zinc-500 text-xs">
                Provide or select an ExecutionProof to inspect and verify.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
