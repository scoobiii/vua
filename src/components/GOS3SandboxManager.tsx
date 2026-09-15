import React, { useState, useEffect } from 'react';
import {
  Server,
  FolderLock,
  Plus,
  Clock,
  Shield,
  Key,
  Network,
  Cpu,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { GOS3Session } from '../vortex/types.js';

interface GOS3SandboxManagerProps {
  onSessionCreated: () => void;
}

export const GOS3SandboxManager: React.FC<GOS3SandboxManagerProps> = ({ onSessionCreated }) => {
  const [sessions, setSessions] = useState<GOS3Session[]>([]);
  const [resourcePath, setResourcePath] = useState('/workspace/vortex/src/engine.ts');
  const [durationSec, setDurationSec] = useState(300);
  const [creating, setCreating] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/vortex/gos3/sessions');
      const data = await res.json();
      setSessions(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  const createSession = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/vortex/gos3/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principal_id: 'scoobiii',
          agent_id: 'agent/vortex-llm',
          resource: resourcePath,
          duration_seconds: durationSec,
        }),
      });
      await res.json();
      fetchSessions();
      onSessionCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white">GOS3 Onboarding & Sandbox Governor</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                spec §8 & §9
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
              An agent does not modify a resource simply because it can access it.
              Resource modification requires a formal GOS3 contract and bound sandbox envelope.
            </p>
          </div>

          <button
            onClick={fetchSessions}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs flex items-center gap-1 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh Sessions
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: GOS3 Onboarding & Active Sessions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <FolderLock className="w-4 h-4 text-indigo-400" />
              GOS3 Resource Onboarding Contract
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-zinc-400 block mb-1">Resource Path to Authorize</label>
                <input
                  type="text"
                  value={resourcePath}
                  onChange={(e) => setResourcePath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-zinc-200"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Session Duration Window (Seconds)</label>
                <input
                  type="number"
                  value={durationSec}
                  onChange={(e) => setDurationSec(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 font-mono text-zinc-200"
                />
              </div>

              <button
                onClick={createSession}
                disabled={creating}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition shadow"
              >
                <Plus className="w-4 h-4" />
                {creating ? 'Creating Contract...' : 'Issue GOS3 Onboard Contract & Session'}
              </button>
            </div>

            {/* Active Sessions List */}
            <div className="pt-4 border-t border-zinc-800 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-300">Active GOS3 Sessions</span>
                <span className="font-mono text-zinc-500">{sessions.length} active</span>
              </div>

              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-lg text-center text-zinc-500 text-xs">
                    No active GOS3 sessions. Issue one above to authorize state modifications.
                  </div>
                ) : (
                  sessions.map((s) => (
                    <div
                      key={s.session_id}
                      className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs space-y-1 font-mono"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-indigo-400 font-bold">{s.session_id}</span>
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800">
                          {s.status}
                        </span>
                      </div>
                      <div className="text-zinc-400 truncate">
                        <span className="text-zinc-500">resource:</span> {s.resource}
                      </div>
                      <div className="text-zinc-500 text-[10px] flex items-center justify-between pt-1">
                        <span>expires: {new Date(s.expires_at).toLocaleTimeString()}</span>
                        <span>v{s.header_contract.contract_version}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Sandbox Boundary Limits (spec §9) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4 shadow-sm text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-400" />
              Observable Sandbox Boundaries (spec §9)
            </h3>

            <div className="space-y-3 font-mono">
              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold text-[11px]">
                  <FolderLock className="w-3.5 h-3.5 text-indigo-400" />
                  Filesystem Scope (realpath + boundary)
                </div>
                <div className="text-[10px] text-zinc-400 space-y-0.5">
                  <div>• /workspace/vortex/*</div>
                  <div>• /tmp/vortex-sandbox/*</div>
                  <div className="text-rose-400/80">• Traversal (../) blocked</div>
                  <div className="text-rose-400/80">• Sibling prefix attacks blocked</div>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold text-[11px]">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  Credential Scope Boundary
                </div>
                <div className="text-[10px] text-zinc-400 space-y-0.5">
                  <div>• cred-vortex-dev</div>
                  <div>• cred-read-only</div>
                  <div className="text-rose-400/80">• Unauthorized credentials trigger CREDENTIAL_DENIED</div>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold text-[11px]">
                  <Network className="w-3.5 h-3.5 text-emerald-400" />
                  Network Scope Boundary
                </div>
                <div className="text-[10px] text-zinc-400 space-y-0.5">
                  <div>• api.github.com</div>
                  <div>• localhost:3000</div>
                  <div className="text-rose-400/80">• Out-of-scope egress blocked</div>
                </div>
              </div>

              <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg space-y-1">
                <div className="flex items-center gap-2 text-zinc-300 font-semibold text-[11px]">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" />
                  Resource Limits & Timeouts
                </div>
                <div className="text-[10px] text-zinc-400 space-y-0.5">
                  <div>• Max Timeout: 10,000ms</div>
                  <div>• Memory Limit: 512 MB</div>
                  <div>• Timeout invariant: executed=true, status=EXECUTION_TIMEOUT</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
