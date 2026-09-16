/**
 * Vortex Universal Connector (VUA) - Core Library Entrypoint
 * 
 * Provides:
 * - Deterministic Execution Pipeline (executeVortexPipeline)
 * - Cryptographic Attestations (Ed25519 + RFC 8785)
 * - Independent Execution Proof Verifier (verifyExecutionProof)
 * - Multi-Environment Adapters (Linux, Android, Windows, GitHub)
 * - Dual Cloud & Local LLM Gateway (Gemini, Ollama, LM Studio, Qwen, etc.)
 * - GOS3 Contract Audit and Conformance Test Suite
 */

export * from './types.js';
export * from './canonicalize.js';
export * from './crypto.js';
export * from './policy.js';
export * from './sandbox.js';
export * from './evidence.js';
export * from './verifier.js';
export * from './gateway.js';
export * from './llm.js';
export * from './conformance.js';
export * from './adapters/index.js';
export * from './semantic-oracle.js';
export * from './hardware-profiler.js';
