/**
 * Onboarding & Governance Documentation Installer
 * Manages CODEOWNERS, agent onboarding protocol, and repository profile specs
 */

import fs from 'node:fs';
import path from 'node:path';

export interface DocItemStatus {
  path: string;
  name: string;
  exists: boolean;
  sizeBytes: number;
}

export class OnboardingInstaller {
  private readonly baseDir: string;

  public static readonly REQUIRED_DOCS = [
    'docs/governance/VUA-REPOSITORY-GOVERNANCE-PROFILE-v1.md',
    'docs/governance/VORTEX-PULL-MERGE-GOVERNANCE-v1.md',
    'docs/agents/AGENT-ONBOARDING.md',
    'CODEOWNERS',
  ];

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  public auditDocs(): {
    totalRequired: number;
    presentCount: number;
    docs: DocItemStatus[];
    allPresent: boolean;
  } {
    const items: DocItemStatus[] = [];
    let presentCount = 0;

    for (const relPath of OnboardingInstaller.REQUIRED_DOCS) {
      const fullPath = path.join(this.baseDir, relPath);
      const exists = fs.existsSync(fullPath);
      let sizeBytes = 0;

      if (exists) {
        presentCount++;
        sizeBytes = fs.statSync(fullPath).size;
      }

      items.push({
        path: relPath,
        name: path.basename(relPath),
        exists,
        sizeBytes,
      });
    }

    return {
      totalRequired: OnboardingInstaller.REQUIRED_DOCS.length,
      presentCount,
      docs: items,
      allPresent: presentCount === OnboardingInstaller.REQUIRED_DOCS.length,
    };
  }

  public ensureDirectories(): void {
    const govDir = path.join(this.baseDir, 'docs', 'governance');
    const agentDir = path.join(this.baseDir, 'docs', 'agents');
    if (!fs.existsSync(govDir)) fs.mkdirSync(govDir, { recursive: true });
    if (!fs.existsSync(agentDir)) fs.mkdirSync(agentDir, { recursive: true });
  }
}
