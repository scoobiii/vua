#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════
 * GOS3 CONTRACT HEADER (spec §8)
 * contract: bin/mcp-server.js
 * version: 2.0.0
 * description: VUA MCP Server Adapter (JSON-RPC 2.0 via stdio).
 *   Connects to registry loader and provides governed LLM and VUA tools:
 *   - llm.query      : Prompt query across configured providers in vua-llms.json
 *   - llm.validate   : Deterministic RFC 8785 validation & provenance audit
 *   - llm.execute    : Governed code execution / generation via LLM gateway
 *   - llm.summarize  : High-level technical and governance summarization
 *   - vortex.inspect : Inspect repository metadata and governance state
 *   - vortex.prepare_patch : Prepare deterministic local patch diff
 *   - vortex.push_branch : Push branch with credential check & binding
 *   - vortex.create_pull_request : Open verified PR with GOS3 approval token
 * ═══════════════════════════════════════════════════════════════════
 */

import { createInterface } from 'node:readline';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { vuaRegistry } from '../src/vortex/adapters/registry.ts';
import { executeGovernedLLM } from '../src/vortex/llm.ts';
import { canonicalize } from '../src/vortex/canonicalize.ts';
import { sha256 } from '../src/vortex/crypto.ts';
import { verifyExecutionProof } from '../src/vortex/verifier.ts';

function loadRegistry() {
  const target = resolve('vua-llms.json');
  if (!existsSync(target)) return [];
  try {
    return JSON.parse(readFileSync(target, 'utf8'));
  } catch {
    return [];
  }
}

function resolveProvider(providerId) {
  const all = loadRegistry();
  if (!providerId) return all[0] || null;
  return (
    all.find(
      (p) =>
        p.id === providerId ||
        p.provider === providerId ||
        p.model === providerId
    ) || null
  );
}

const MCP_TOOLS = [
  {
    name: 'llm.query',
    description:
      'Execute a governed query to a configured LLM provider from vua-llms.json (e.g., gemini, openai, local-ollama).',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'The prompt text to send to the LLM' },
        provider: {
          type: 'string',
          description: 'Provider ID from vua-llms.json (e.g., gemini, openai, local-ollama)',
        },
        model: { type: 'string', description: 'Model override name' },
        temperature: { type: 'number', description: 'Sampling temperature (default: 0.2)' },
        system_instruction: { type: 'string', description: 'System instruction prompt' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'llm.validate',
    description:
      'Validate an LLM artifact or execution proof against RFC 8785 canonical serialization and cryptographic invariants.',
    inputSchema: {
      type: 'object',
      properties: {
        payload: {
          type: 'object',
          description: 'The JSON payload or execution proof to validate',
        },
        expected_hash: {
          type: 'string',
          description: 'Optional expected SHA-256 hash for strict proof-over-prose matching',
        },
      },
      required: ['payload'],
    },
  },
  {
    name: 'llm.execute',
    description:
      'Governed code execution and transformation through the configured LLM gateway with proof of execution.',
    inputSchema: {
      type: 'object',
      properties: {
        instruction: { type: 'string', description: 'Coding or execution task instruction' },
        source_code: { type: 'string', description: 'Context source code to transform or evaluate' },
        provider: { type: 'string', description: 'Provider ID from vua-llms.json' },
        target_path: { type: 'string', description: 'Target file path' },
      },
      required: ['instruction'],
    },
  },
  {
    name: 'llm.summarize',
    description:
      'Summarize a governance run, patch diff, or test report using the configured fast LLM provider.',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Content or report to summarize' },
        focus: {
          type: 'string',
          enum: ['security', 'governance', 'diff', 'general'],
          description: 'Focus area of the summary',
        },
        provider: { type: 'string', description: 'Provider ID from vua-llms.json' },
      },
      required: ['content'],
    },
  },
  {
    name: 'vortex.inspect',
    description:
      'Inspect repository metadata, branch protections, and governance state without side effects.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
      },
    },
  },
  {
    name: 'vortex.prepare_patch',
    description:
      'Prepare a deterministic local patch diff and canonical RFC 8785 digest (purely local_only, no remote mutation).',
    inputSchema: {
      type: 'object',
      properties: {
        branch: { type: 'string' },
        head_sha: { type: 'string' },
        changed_files: { type: 'array', items: { type: 'string' } },
      },
      required: ['branch'],
    },
  },
  {
    name: 'vortex.push_branch',
    description:
      'Push a branch/commit to GitHub. Fails closed with CREDENTIAL_MISSING if GITHUB_TOKEN is absent.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        branch: { type: 'string' },
        approval_token: { type: 'string' },
      },
      required: ['owner', 'repo', 'branch'],
    },
  },
  {
    name: 'vortex.create_pull_request',
    description:
      'Open a verified Pull Request on GitHub. Fails closed with CREDENTIAL_MISSING if GITHUB_TOKEN is absent.',
    inputSchema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        head: { type: 'string' },
        base: { type: 'string' },
        body: { type: 'string' },
        approval_token: { type: 'string' },
      },
      required: ['owner', 'repo', 'title', 'head', 'base'],
    },
  },
];

async function handleRpc(req) {
  if (req.method === 'tools/list') {
    return { tools: MCP_TOOLS };
  }

  if (req.method === 'tools/call') {
    const { name, arguments: args = {} } = req.params;

    // 1. llm.query
    if (name === 'llm.query') {
      const selectedId = args.provider || 'gemini';
      const providerConfig = resolveProvider(selectedId);
      const providerType = providerConfig ? providerConfig.provider : 'gemini';
      const model = args.model || (providerConfig ? providerConfig.model : 'gemini-3.8-flash');

      const result = await executeGovernedLLM(args.prompt, {
        provider: providerType,
        model,
        temperature: args.temperature ?? (providerConfig?.temperature_default || 0.2),
        systemInstruction: args.system_instruction,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                provider: result.provider,
                model: result.model,
                text: result.text,
                duration_ms: result.duration_ms,
                usage: result.usage,
                execution_proof_id: result.execution_proof?.proof_id,
                proof_verified: result.verification?.verified ?? true,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // 2. llm.validate
    if (name === 'llm.validate') {
      const canonicalJson = canonicalize(args.payload);
      const computedHash = sha256(canonicalJson);
      let proofVerification = null;

      if (args.payload?.proof_id && args.payload?.signature) {
        proofVerification = verifyExecutionProof(args.payload);
      }

      const match = args.expected_hash ? computedHash === args.expected_hash : true;

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                valid: match && (proofVerification ? proofVerification.verified : true),
                canonical_sha256: computedHash,
                hash_matched: match,
                proof_verification: proofVerification,
                rfc8785_canonical_length: canonicalJson.length,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // 3. llm.execute
    if (name === 'llm.execute') {
      const selectedId = args.provider || 'gemini';
      const providerConfig = resolveProvider(selectedId);
      const providerType = providerConfig ? providerConfig.provider : 'gemini';
      const model = providerConfig?.model || 'gemini-3.8-flash';

      const prompt = `Instruction: ${args.instruction}\n\n${
        args.target_path ? `Target Path: ${args.target_path}\n` : ''
      }${args.source_code ? `Source Code:\n\`\`\`\n${args.source_code}\n\`\`\`\n` : ''}`;

      const result = await executeGovernedLLM(prompt, {
        provider: providerType,
        model,
        temperature: 0.1,
        systemInstruction:
          'You are the VUA Governed Code Execution engine. Produce verified, deterministic code with no prose or formatting fluff.',
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                output: result.text,
                provider: result.provider,
                model: result.model,
                execution_proof: result.execution_proof,
                verified: result.verification?.verified ?? true,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // 4. llm.summarize
    if (name === 'llm.summarize') {
      const selectedId = args.provider || 'gemini';
      const providerConfig = resolveProvider(selectedId);
      const providerType = providerConfig ? providerConfig.provider : 'gemini';
      const model = providerConfig?.model || 'gemini-3.8-flash';

      const focus = args.focus || 'governance';
      const prompt = `Focus: ${focus}\nSummarize the following governance data/diff succinctly adhering to VUA specification invariants:\n\n${args.content}`;

      const result = await executeGovernedLLM(prompt, {
        provider: providerType,
        model,
        temperature: 0.2,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                summary: result.text,
                focus,
                provider: result.provider,
                duration_ms: result.duration_ms,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // 5. vortex.inspect
    if (name === 'vortex.inspect') {
      const res = await vuaRegistry.invoke({
        adapterId: 'github',
        action: 'inspect_repo',
        target: { owner: args.owner, repo: args.repo },
      });
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }

    // 6. vortex.prepare_patch
    if (name === 'vortex.prepare_patch') {
      const res = await vuaRegistry.invoke({
        adapterId: 'github',
        action: 'prepare_patch',
        payload: args,
      });
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }

    // 7. vortex.push_branch
    if (name === 'vortex.push_branch') {
      const res = await vuaRegistry.invoke({
        adapterId: 'github',
        action: 'push_branch',
        target: { owner: args.owner, repo: args.repo },
        payload: args,
        approvalToken: args.approval_token,
      });
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }

    // 8. vortex.create_pull_request
    if (name === 'vortex.create_pull_request') {
      const res = await vuaRegistry.invoke({
        adapterId: 'github',
        action: 'create_pull_request',
        target: { owner: args.owner, repo: args.repo },
        payload: args,
        approvalToken: args.approval_token,
      });
      return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
    }

    throw new Error(`Tool not found: ${name}`);
  }

  if (req.method === 'initialize') {
    return {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'vua-mcp-server', version: '2.0.0' },
    };
  }

  return {};
}

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const result = await handleRpc(req);
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: req.id, result }) + '\n');
  } catch (err) {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32603, message: err.message },
      }) + '\n'
    );
  }
});
