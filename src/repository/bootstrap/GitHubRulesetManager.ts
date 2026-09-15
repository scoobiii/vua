/**
 * GitHub Ruleset Manager
 * Manages GitHub Repository & Organization Rulesets via REST API
 * Handles drift detection, export, synchronization, and enforcement verification
 */

import fs from 'node:fs';
import path from 'node:path';
import type { GitHubRulesetSchema } from './RepositoryPolicy.js';

export class GitHubRulesetManager {
  private readonly defaultRulesetPath: string;

  constructor(baseDir: string = process.cwd()) {
    this.defaultRulesetPath = path.join(baseDir, 'governance', 'github', 'VUA-VORTEX-main.ruleset.json');
  }

  /**
   * Load the golden standard Ruleset definition from disk
   */
  public getGoldenRuleset(): GitHubRulesetSchema {
    if (!fs.existsSync(this.defaultRulesetPath)) {
      throw new Error(`Arquivo de regraset dourado não encontrado em: ${this.defaultRulesetPath}`);
    }
    const raw = fs.readFileSync(this.defaultRulesetPath, 'utf8');
    return JSON.parse(raw);
  }

  /**
   * Inspect remote GitHub ruleset using GitHub API if token is provided,
   * or analyze local golden ruleset readiness.
   */
  public async inspectRemoteRuleset(repoSlug: string, token?: string): Promise<{
    hasRuleset: boolean;
    active: boolean;
    rulesetId?: number;
    drift: string[];
    liveRuleset?: any;
  }> {
    const drift: string[] = [];

    if (!token) {
      // Without token, verify local golden ruleset specification readiness
      try {
        const golden = this.getGoldenRuleset();
        if (golden.enforcement !== 'active') {
          drift.push(`Ruleset local 'enforcement' está '${golden.enforcement}', esperado 'active'.`);
        }
        return {
          hasRuleset: true,
          active: golden.enforcement === 'active',
          drift,
        };
      } catch (err: any) {
        return {
          hasRuleset: false,
          active: false,
          drift: [err.message],
        };
      }
    }

    // Call GitHub API to list rulesets
    try {
      const url = `https://api.github.com/repos/${repoSlug}/rulesets`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'VUA-Repository-Bootstrapper/1.0',
        },
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          drift.push(`Acesso ao repositório GitHub falhou ou sem permissão de administração (HTTP ${response.status}).`);
          return { hasRuleset: false, active: false, drift };
        }
        throw new Error(`GitHub API Error: ${response.statusText}`);
      }

      const rulesets = await response.json();
      const vortexRulesetSummary = rulesets.find((r: any) => 
        r.name === 'VUA/Vortex Production Main' || r.name.toLowerCase().includes('vortex')
      );

      if (!vortexRulesetSummary) {
        drift.push("Ruleset 'VUA/Vortex Production Main' não encontrado no GitHub.");
        return { hasRuleset: false, active: false, drift };
      }

      // Fetch full detailed ruleset
      const detailUrl = `https://api.github.com/repos/${repoSlug}/rulesets/${vortexRulesetSummary.id}`;
      const detailResp = await fetch(detailUrl, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'VUA-Repository-Bootstrapper/1.0',
        },
      });

      const detailedRuleset = await detailResp.json();
      const golden = this.getGoldenRuleset();

      if (detailedRuleset.enforcement !== 'active') {
        drift.push(`Ruleset enforcement está '${detailedRuleset.enforcement}' (esperado 'active').`);
      }

      const hasDeletionBlock = detailedRuleset.rules?.some((r: any) => r.type === 'deletion');
      if (!hasDeletionBlock) drift.push('Regra de proteção contra deleção (deletion) ausente.');

      const hasNonFastForward = detailedRuleset.rules?.some((r: any) => r.type === 'non_fast_forward');
      if (!hasNonFastForward) drift.push('Regra de bloqueio de force push (non_fast_forward) ausente.');

      const prRule = detailedRuleset.rules?.some((r: any) => r.type === 'pull_request');
      if (!prRule) drift.push('Regra obrigatória de Pull Request ausente.');

      return {
        hasRuleset: true,
        active: detailedRuleset.enforcement === 'active',
        rulesetId: vortexRulesetSummary.id,
        drift,
        liveRuleset: detailedRuleset,
      };
    } catch (err: any) {
      drift.push(`Erro de conexão com GitHub API: ${err.message}`);
      return { hasRuleset: false, active: false, drift };
    }
  }

  /**
   * Apply / Create / Update GitHub Ruleset via GitHub REST API
   */
  public async applyRuleset(repoSlug: string, token: string): Promise<{
    success: boolean;
    action: 'CREATED' | 'UPDATED' | 'FAILED';
    rulesetId?: number;
    error?: string;
  }> {
    const golden = this.getGoldenRuleset();
    const inspection = await this.inspectRemoteRuleset(repoSlug, token);

    try {
      if (inspection.hasRuleset && inspection.rulesetId) {
        // Update existing ruleset
        const updateUrl = `https://api.github.com/repos/${repoSlug}/rulesets/${inspection.rulesetId}`;
        const resp = await fetch(updateUrl, {
          method: 'PUT',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'VUA-Repository-Bootstrapper/1.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(golden),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          return { success: false, action: 'FAILED', error: `Erro ao atualizar ruleset: ${errBody}` };
        }

        const data = await resp.json();
        return { success: true, action: 'UPDATED', rulesetId: data.id };
      } else {
        // Create new ruleset
        const createUrl = `https://api.github.com/repos/${repoSlug}/rulesets`;
        const resp = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'VUA-Repository-Bootstrapper/1.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(golden),
        });

        if (!resp.ok) {
          const errBody = await resp.text();
          return { success: false, action: 'FAILED', error: `Erro ao criar ruleset: ${errBody}` };
        }

        const data = await resp.json();
        return { success: true, action: 'CREATED', rulesetId: data.id };
      }
    } catch (err: any) {
      return { success: false, action: 'FAILED', error: err.message };
    }
  }

  /**
   * Generate curl commands for manual administrator application if token is unavailable
   */
  public generateManualCurlCommand(repoSlug: string): string {
    const golden = this.getGoldenRuleset();
    const payload = JSON.stringify(golden).replace(/"/g, '\\"');
    return `curl -L -X POST \\
  -H "Accept: application/vnd.github+json" \\
  -H "Authorization: Bearer YOUR_ADMIN_GITHUB_TOKEN" \\
  -H "X-GitHub-Api-Version: 2022-11-28" \\
  https://api.github.com/repos/${repoSlug}/rulesets \\
  -d "${payload}"`;
  }
}
