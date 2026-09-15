/**
 * Vortex llama.cpp Native Edge Adapter for Constrained ARM/Termux Environments
 * (Optimized for Allwinner A23, Cortex-A7 ARMv7 32-bit / AArch64)
 * 
 * Governance Thesis:
 * 1. LLM executes in native C/C++ llama-server (SIMD/NEON optimized GGUF).
 * 2. VUA handles routing, security invariants, authorization, and crypto signing.
 * 3. Strict serialization (concurrency = 1) prevents memory exhaustion and Android OOM kills.
 */

import { randomUUID } from 'node:crypto';

export interface LlamaRequest {
  prompt: string;
  model?: string;
  max_tokens?: number;
  temperature?: number;
  timeout_ms?: number;
  baseUrl?: string;
}

export interface LlamaResponse {
  text: string;
  model: string;
  duration_ms: number;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// Queue de inferência serial para evitar concorrência no hardware fraco
let inferenceQueue: Promise<unknown> = Promise.resolve();

/**
 * Enfileira a execução para garantir estritamente 1 inferência por vez
 */
export function enqueueInference<T>(operation: () => Promise<T>): Promise<T> {
  const next = inferenceQueue.then(operation, operation);
  inferenceQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`llama.cpp timeout after ${timeoutMs}ms (A23 CPU constraint)`));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Invoca o servidor nativo llama.cpp (llama-server) via HTTP local
 */
export async function invokeLlama(request: LlamaRequest): Promise<LlamaResponse> {
  return enqueueInference(async () => {
    const started = performance.now();
    const timeoutMs = request.timeout_ms ?? 90_000;
    const baseUrl = (request.baseUrl || process.env.LLAMA_CPP_BASE_URL || 'http://127.0.0.1:11434').replace(/\/+$/, '');

    const payload = {
      model: request.model ?? 'qwen',
      messages: [
        {
          role: 'user',
          content: request.prompt,
        },
      ],
      temperature: request.temperature ?? 0,
      max_tokens: request.max_tokens ?? 128,
      stream: false,
    };

    // Tenta primeiro /v1/chat/completions (OpenAI-compatible)
    // Se falhar ou não suportado, tenta endpoint nativo /completion
    let response: Response;
    try {
      response = await withTimeout(
        fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-vua-request-id': randomUUID(),
          },
          body: JSON.stringify(payload),
        }),
        timeoutMs,
      );
    } catch (err: any) {
      // Se for connection refused ou timeout, propaga
      if (err.message && err.message.includes('timeout')) throw err;

      // Fallback para endpoint nativo do llama-server /completion
      const nativePayload = {
        prompt: `<|im_start|>user\n${request.prompt}<|im_end|>\n<|im_start|>assistant\n`,
        temperature: request.temperature ?? 0,
        n_predict: request.max_tokens ?? 128,
        stop: ['<|im_end|>', '<|endoftext|>'],
      };

      response = await withTimeout(
        fetch(`${baseUrl}/completion`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(nativePayload),
        }),
        timeoutMs,
      );

      if (!response.ok) {
        throw new Error(`llama.cpp native HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }

      const nativeData = (await response.json()) as { content?: string; tokens_evaluated?: number; tokens_predicted?: number };
      const text = nativeData.content ?? '';

      return {
        text,
        model: request.model ?? 'qwen-native',
        duration_ms: Math.round((performance.now() - started) * 10) / 10,
        usage: {
          prompt_tokens: nativeData.tokens_evaluated,
          completion_tokens: nativeData.tokens_predicted,
          total_tokens: (nativeData.tokens_evaluated || 0) + (nativeData.tokens_predicted || 0),
        },
      };
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`llama.cpp HTTP ${response.status}: ${body.slice(0, 500)}`);
    }

    const data = (await response.json()) as {
      model?: string;
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      usage?: {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      };
    };

    const text = data.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      throw new Error('llama.cpp returned no assistant text');
    }

    return {
      text,
      model: data.model ?? payload.model,
      duration_ms: Math.round((performance.now() - started) * 10) / 10,
      usage: data.usage,
    };
  });
}
