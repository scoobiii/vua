#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════════════
 * GOS3 CONTRACT HEADER (spec §8)
 * contract: scripts/vua-llm-resolve.ts
 * version: 1.0.0
 * description: Loader e validador de provedores LLM registrados no
 *   vua-llms.json. Resolve e instancia adaptadores sem acoplamento a SDK.
 * ═══════════════════════════════════════════════════════════════════
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface VUALlmProviderConfig {
  id: string;
  name: string;
  provider: string;
  provider_type: 'cloud_api' | 'local_shell';
  endpoint?: string;
  capabilities: string[];
  auth_scheme: 'api_key' | 'bearer_token' | 'none' | 'oauth2';
  env_key?: string;
  env_cmd?: string;
  cmd?: string;
  model?: string;
  context_window?: number;
  temperature_default?: number;
  description: string;
}

export function loadLlmRegistry(configPath?: string): VUALlmProviderConfig[] {
  const target = configPath || resolve('vua-llms.json');
  if (!existsSync(target)) {
    return [];
  }
  try {
    const raw = readFileSync(target, 'utf8');
    return JSON.parse(raw) as VUALlmProviderConfig[];
  } catch (err: any) {
    console.error(`[VUA-LLM] Failed to parse ${target}: ${err.message}`);
    return [];
  }
}

export function resolveLlmProvider(providerId: string): VUALlmProviderConfig | null {
  const all = loadLlmRegistry();
  return all.find((p) => p.id === providerId || p.provider === providerId || p.model === providerId) || null;
}

if (process.argv[1]?.endsWith('vua-llm-resolve.ts')) {
  const query = process.argv[2];
  if (!query) {
    console.log(JSON.stringify(loadLlmRegistry(), null, 2));
  } else {
    const found = resolveLlmProvider(query);
    if (!found) {
      console.error(`Provider not found: ${query}`);
      process.exit(1);
    }
    console.log(JSON.stringify(found, null, 2));
  }
}
