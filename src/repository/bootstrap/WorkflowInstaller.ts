/**
 * Workflow Installer
 * Installs and audits all 5 mandatory Vortex Governance Workflows in .github/workflows/
 */

import fs from 'node:fs';
import path from 'node:path';

export interface WorkflowStatusItem {
  filename: string;
  name: string;
  exists: boolean;
  valid: boolean;
  sizeBytes: number;
}

export class WorkflowInstaller {
  private readonly workflowsDir: string;
  public static readonly MANDATORY_WORKFLOWS = [
    'vortex-ci.yml',
    'vortex-governance-conformance.yml',
    'agent-patch-arena.yml',
    'agent-patch-arena-promotion.yml',
    'sync-conflict-resolver.yml',
  ];

  constructor(baseDir: string = process.cwd()) {
    this.workflowsDir = path.join(baseDir, '.github', 'workflows');
  }

  /**
   * Audit existing workflows in .github/workflows/
   */
  public auditWorkflows(): {
    totalRequired: number;
    presentCount: number;
    workflows: WorkflowStatusItem[];
    allPresent: boolean;
  } {
    if (!fs.existsSync(this.workflowsDir)) {
      return {
        totalRequired: WorkflowInstaller.MANDATORY_WORKFLOWS.length,
        presentCount: 0,
        workflows: WorkflowInstaller.MANDATORY_WORKFLOWS.map((f) => ({
          filename: f,
          name: f.replace('.yml', ''),
          exists: false,
          valid: false,
          sizeBytes: 0,
        })),
        allPresent: false,
      };
    }

    const items: WorkflowStatusItem[] = [];
    let presentCount = 0;

    for (const filename of WorkflowInstaller.MANDATORY_WORKFLOWS) {
      const filePath = path.join(this.workflowsDir, filename);
      const exists = fs.existsSync(filePath);
      let sizeBytes = 0;
      let valid = false;

      if (exists) {
        presentCount++;
        const stat = fs.statSync(filePath);
        sizeBytes = stat.size;
        const content = fs.readFileSync(filePath, 'utf8');
        valid = content.includes('name:') && (content.includes('jobs:') || content.includes('on:'));
      }

      items.push({
        filename,
        name: filename.replace('.yml', ''),
        exists,
        valid,
        sizeBytes,
      });
    }

    return {
      totalRequired: WorkflowInstaller.MANDATORY_WORKFLOWS.length,
      presentCount,
      workflows: items,
      allPresent: presentCount === WorkflowInstaller.MANDATORY_WORKFLOWS.length,
    };
  }

  /**
   * Ensure workflows directory exists
   */
  public ensureWorkflowsDirectory(): void {
    if (!fs.existsSync(this.workflowsDir)) {
      fs.mkdirSync(this.workflowsDir, { recursive: true });
    }
  }
}
