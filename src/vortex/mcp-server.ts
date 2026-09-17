/**
 * Vortex MCP Specification - Protocol Server & Tool Contract
 * 
 * Normative MCP JSON-RPC 2.0 tool endpoints:
 * - vortex.inspect: Read-only observation (side_effect=false, authorization=required, proof=required)
 * - vortex.propose: Propose change without execution (side_effect=false, execution=prohibited, proof=proposal)
 * - vortex.verify: Independent verification (hashes, policy, tests, proof, signature)
 * - vortex.execute: Authorized bounded execution with policy/sandbox limits
 * - vortex.branch.write: Persistent development branch modification with human approval
 */

import { executeVortexPipeline, createSignedProof } from './gateway.js';
import { executeGovernedLLM, type LLMConfig, type LLMProviderType } from './llm.js';
import { vuaRegistry } from './adapters/registry.js';
import { verifyExecutionProof } from './verifier.js';
import { sha256 } from './crypto.js';
import type { ExecutionProof, VortexOperation, VortexRequest, VortexResponse } from './types.js';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const VORTEX_MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'vortex.inspect',
    description: 'Read-only observation of repositories, files, branches, runtimes, connectors, or policies with cryptographic proof.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'Unique cryptographic request identifier' },
        target: {
          type: 'object',
          properties: {
            repository: { type: 'string' },
            branch: { type: 'string' },
            path: { type: 'string' },
          },
        },
        input: { type: 'object', description: 'Inspection parameters' },
        authorization: { type: 'object', description: 'Vortex Authorization Context' },
      },
      required: ['request_id', 'input'],
    },
  },
  {
    name: 'vortex.propose',
    description: 'Produces an intended patch, change, or configuration without executing side effects. Yields proposal proof.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        target: { type: 'object' },
        input: {
          type: 'object',
          properties: {
            diff: { type: 'string' },
            type: { type: 'string' },
          },
          required: ['type'],
        },
        authorization: { type: 'object' },
      },
      required: ['request_id', 'input'],
    },
  },
  {
    name: 'vortex.verify',
    description: 'Executes independent verification of hashes, policies, diffs, execution proofs, or Ed25519 signatures.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        input: {
          type: 'object',
          properties: {
            execution_proof: { type: 'object' },
            expected_hash: { type: 'string' },
          },
        },
        authorization: { type: 'object' },
      },
      required: ['request_id', 'input'],
    },
  },
  {
    name: 'vortex.execute',
    description: 'Executes a governed operation. Evaluates identity, policy, scope, GOS3, and sandbox limits before execution.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        operation: { type: 'string', description: 'Semantic operation name' },
        target: { type: 'object' },
        input: { type: 'object' },
        authorization: { type: 'object', description: 'Mandatory for mutable executions' },
        sandbox: { type: 'object', description: 'Optional explicit sandbox limits' },
        approval_token: { type: 'string', description: 'Human approval token for sensitive operations' },
      },
      required: ['request_id', 'input'],
    },
  },
  {
    name: 'vortex.branch.write',
    description: 'Alters persistent repository development state (commit, branch creation, branch modification). Requires policy & human approval.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        target: {
          type: 'object',
          properties: {
            repository: { type: 'string' },
            branch: { type: 'string' },
            path: { type: 'string' },
          },
          required: ['repository', 'branch'],
        },
        input: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['content'],
        },
        authorization: { type: 'object' },
        approval_token: { type: 'string', description: 'Mandatory human approval token for branch writing' },
      },
      required: ['request_id', 'target', 'input', 'authorization'],
    },
  },
  {
    name: 'vortex.llm.invoke',
    description: 'Executes a governed LLM inference request (Google Gemini via API Key, OpenAI-compatible, or Local LLM like Ollama / LM Studio) producing an Ed25519 ExecutionProof v1.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        prompt: { type: 'string', description: 'User prompt or task for the model' },
        provider: {
          type: 'string',
          enum: ['gemini', 'openai', 'ollama', 'lmstudio', 'llamacpp', 'custom'],
          description: 'LLM Provider type (gemini, openai, ollama, lmstudio, llamacpp native edge)',
        },
        model: { type: 'string', description: 'Model identifier (e.g. gemini-3.8-flash, llama3, gpt-4o-mini)' },
        baseUrl: { type: 'string', description: 'Optional custom endpoint (e.g. http://localhost:11434 for Ollama)' },
        apiKey: { type: 'string', description: 'Optional custom API key for cloud providers' },
        temperature: { type: 'number' },
        maxTokens: { type: 'number' },
        systemInstruction: { type: 'string' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'vua.adapters.list',
    description: 'Lists all available VUA (Vortex Universal Connector) platform adapters (GitHub, Linux, Android, Windows, Bluesky) and their supported actions.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'vua.adapter.invoke',
    description: 'Invokes a governed action on a VUA Universal Adapter (GitHub, Linux, Android, Windows, or Bluesky) with cryptographic Ed25519 proof emission.',
    inputSchema: {
      type: 'object',
      properties: {
        adapter_id: {
          type: 'string',
          enum: ['github', 'linux', 'android', 'windows', 'bluesky'],
          description: 'Target platform adapter identifier',
        },
        action: {
          type: 'string',
          description: 'Action to execute on adapter (e.g. inspect_repo, exec_command, post, post_thread, reply)',
        },
        target: { type: 'object', description: 'Target metadata' },
        payload: { type: 'object', description: 'Action parameters' },
        approval_token: { type: 'string', description: 'Approval token if required' },
      },
      required: ['adapter_id', 'action'],
    },
  },
];

/**
 * Handle MCP JSON-RPC 2.0 messages
 */
export async function handleMCPMessage(message: {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}): Promise<{
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}> {
  const { id, method, params } = message;

  // MCP Handshake & Protocol Lifecycle
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'vua-mcp-server',
          version: '1.0.0',
          description: 'VUA - Vortex Universal Connector & Governance Protocol',
        },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {},
    };
  }

  if (method === 'ping') {
    return {
      jsonrpc: '2.0',
      id,
      result: {},
    };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: VORTEX_MCP_TOOLS,
      },
    };
  }

  if (method === 'tools/call') {
    const toolName = params?.name as string;
    const args = (params?.arguments as Record<string, unknown>) || {};

    if (toolName === 'vortex.llm.invoke') {
      const prompt = (args.prompt as string) || '';
      const provider = ((args.provider as string) || 'gemini') as LLMProviderType;
      const model = (args.model as string) || (provider === 'gemini' ? 'gemini-3.8-flash' : provider === 'ollama' ? 'llama3' : 'gpt-4o-mini');
      const config: LLMConfig = {
        provider,
        model,
        baseUrl: args.baseUrl as string,
        apiKey: args.apiKey as string,
        temperature: typeof args.temperature === 'number' ? args.temperature : 0.7,
        maxTokens: typeof args.maxTokens === 'number' ? args.maxTokens : 2048,
        systemInstruction: args.systemInstruction as string,
      };

      try {
        const llmResult = await executeGovernedLLM(prompt, config, args.request_id as string);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            text: llmResult.text,
            provider: llmResult.provider,
            model: llmResult.model,
            usage: llmResult.usage,
            duration_ms: llmResult.duration_ms,
            execution_kind: 'llm',
            capability_executed: false,
            execution_proof: llmResult.execution_proof,
            verification: llmResult.verification,
          },
        };
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: `LLM Execution Error: ${err.message || String(err)}` },
        };
      }
    }

    if (toolName === 'vua.adapters.list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          connector: 'VUA - Vortex Universal Connector',
          adapters: vuaRegistry.list(),
        },
      };
    }

    if (toolName === 'vua.adapter.invoke') {
      const adapterId = args.adapter_id as any;
      const action = args.action as string;
      try {
        const result = await vuaRegistry.invoke({
          adapterId,
          action,
          target: args.target as Record<string, unknown>,
          payload: args.payload as Record<string, unknown>,
          approvalToken: args.approval_token as string,
          requestId: args.request_id as string,
          authorization: args.authorization as any,
        });
        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      } catch (err: any) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32603, message: `VUA Adapter Error: ${err.message || String(err)}` },
        };
      }
    }

    if (toolName === 'vortex.verify') {
      const inputObj = (args.input as Record<string, unknown>) || {};
      const proofToVerify = (args.proof ||
        args.execution_proof ||
        inputObj.proof ||
        inputObj.execution_proof ||
        (args.signature ? args : undefined)) as ExecutionProof | undefined;

      if (!proofToVerify) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            status: 'VERIFICATION_FAILED',
            output: {
              verified: false,
              verification_scope: 'none',
              tamper_evident: false,
              rfc8785_canonical: false,
              reasons: ['No execution proof provided in arguments (expected "proof" or "execution_proof")'],
            },
            error: {
              code: 'PROOF_MISSING',
              message: 'Missing proof object in arguments to vortex.verify',
            },
          },
        };
      }

      const options = {
        embeddedPublicKey: (args.public_key as string) || (args.embeddedPublicKey as string),
        expectedInputHash: (args.expected_input_hash as string) || (inputObj.expected_hash as string),
        expectedOutputHash: args.expected_output_hash as string,
      };

      const verification = verifyExecutionProof(proofToVerify, options);
      const isVerified = verification.valid === true;

      const verifierInputHash = sha256(proofToVerify);
      const verifierOutputHash = sha256({
        valid: verification.valid,
        status: verification.status,
        reasons: verification.reasons,
        checks: verification.checks,
      });

      const verificationProof = createSignedProof({
        request_id: (args.request_id as string) || `req-mcp-${Date.now()}`,
        execution_id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        runtime_id: 'vortex-runtime-node22-hardened',
        agent_id: 'agent/vortex-verifier',
        principal_id: 'scoobiii',
        connector_id: 'connector:governed-runtime',
        operation: 'verify',
        execution_kind: 'capability',
        executed: true,
        status: isVerified ? 'EXECUTION_SUCCESS' : 'VERIFICATION_FAILED',
        input_hash: verifierInputHash,
        output_hash: verifierOutputHash,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: 3,
        policy_id: 'vortex-development',
        policy_version: '1.0.0',
        gos3_session_id: `gos3-sess-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        sandbox_id: 'sandbox-isolated-env',
      });

      return {
        jsonrpc: '2.0',
        id,
        result: {
          status: isVerified ? 'EXECUTION_SUCCESS' : 'VERIFICATION_FAILED',
          verified: isVerified,
          structuredContent: {
            verified: isVerified,
            verification_scope: isVerified ? 'full' : 'rejected',
            tamper_evident: true,
            rfc8785_canonical: verification.checks?.canonicalization?.passed ?? false,
            reasons: verification.reasons,
            checks: verification.checks,
          },
          output: {
            verified: isVerified,
            verification_scope: isVerified ? 'full' : 'rejected',
            tamper_evident: true,
            rfc8785_canonical: verification.checks?.canonicalization?.passed ?? false,
            reasons: verification.reasons,
            checks: verification.checks,
          },
          ...(isVerified
            ? {}
            : {
                error: {
                  code: 'TAMPER_DETECTED',
                  message: `Cryptographic proof verification failed: ${verification.reasons.join('; ')}`,
                },
              }),
          execution_proof: verificationProof,
        },
      };
    }

    let operation: VortexOperation = 'execute';
    if (toolName === 'vortex.inspect') operation = 'inspect';
    else if (toolName === 'vortex.propose') operation = 'propose';
    else if (toolName === 'vortex.verify') operation = 'verify';
    else if (toolName === 'vortex.branch.write') operation = 'branch.write';
    else if (toolName === 'vortex.execute') operation = 'execute';
    else {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method or tool '${toolName}' not found` },
      };
    }

    const vortexReq: VortexRequest = {
      request_id: (args.request_id as string) || `req-mcp-${Date.now()}`,
      operation,
      target: args.target as Record<string, unknown>,
      input: (args.input as Record<string, unknown>) || args,
      authorization: args.authorization as VortexRequest['authorization'],
      sandbox: args.sandbox as VortexRequest['sandbox'],
      approval_token: args.approval_token as string,
    };

    const vortexRes: VortexResponse = await executeVortexPipeline(vortexReq);

    const isOutputVerified = vortexRes.output && typeof vortexRes.output === 'object' && 'verified' in vortexRes.output
      ? (vortexRes.output as any).verified
      : undefined;

    return {
      jsonrpc: '2.0',
      id,
      result: {
        status: vortexRes.status,
        ...(isOutputVerified !== undefined ? { verified: isOutputVerified, structuredContent: vortexRes.output } : {}),
        output: vortexRes.output,
        error: vortexRes.error,
        execution_proof: vortexRes.execution_proof,
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Unsupported MCP method: ${method}` },
  };
}
