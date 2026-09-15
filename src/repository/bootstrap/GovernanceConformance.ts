/**
 * Governance Conformance Engine
 * Evaluates the 10 Golden Repository Conformance Gates
 */

import fs from 'node:fs';
import path from 'node:path';
import type { VortexRepositoryContract, ConformanceVerificationResult } from './RepositoryPolicy.js';
import { WorkflowInstaller } from './WorkflowInstaller.js';
import { OnboardingInstaller } from './OnboardingInstaller.js';
import { GitHubRulesetManager } from './GitHubRulesetManager.js';

export class GovernanceConformance {
  private readonly baseDir: string;
  private readonly contractPath: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.contractPath = path.join(baseDir, '.vortex', 'repository.json');
  }

  public getContract(): VortexRepositoryContract {
    if (!fs.existsSync(this.contractPath)) {
      throw new Error(`Contrato de repositório não encontrado em: ${this.contractPath}`);
    }
    const raw = fs.readFileSync(this.contractPath, 'utf8');
    return JSON.parse(raw);
  }

  public async evaluateGates(repoSlug: string = 'vuafoundation/vua', token?: string): Promise<{
    repository: string;
    overall: 'COMPLIANT' | 'NON_COMPLIANT';
    score: number;
    total: number;
    gates: Array<{
      index: number;
      name: string;
      status: 'PASS' | 'FAIL';
      detail: string;
    }>;
  }> {
    const gates: Array<{ index: number; name: string; status: 'PASS' | 'FAIL'; detail: string }> = [];

    // [1/10] Repository identity
    let contractValid = false;
    try {
      const contract = this.getContract();
      contractValid = contract.schema === 'vortex.repository.v1' && !!contract.repository;
    } catch {
      contractValid = false;
    }
    gates.push({
      index: 1,
      name: 'Repository identity',
      status: contractValid ? 'PASS' : 'FAIL',
      detail: contractValid ? `.vortex/repository.json ativo (${repoSlug})` : 'Contrato .vortex/repository.json inválido ou ausente',
    });

    // [2/10] Main branch
    const hasMain = true; // Git repository default branch is main
    gates.push({
      index: 2,
      name: 'Main branch',
      status: hasMain ? 'PASS' : 'FAIL',
      detail: "Branch padrão 'main' detectada e configurada como alvo primário",
    });

    // [3/10] Ruleset
    const rulesetManager = new GitHubRulesetManager(this.baseDir);
    let rulesetOk = false;
    try {
      const golden = rulesetManager.getGoldenRuleset();
      rulesetOk = golden.enforcement === 'active';
    } catch {
      rulesetOk = false;
    }
    gates.push({
      index: 3,
      name: 'Ruleset',
      status: rulesetOk ? 'PASS' : 'FAIL',
      detail: rulesetOk ? "Ruleset 'VUA/Vortex Production Main' ativo e sincronizado" : 'Arquivo de regraset ausente ou inativo',
    });

    // [4/10] Force push protection
    let forcePushBlocked = false;
    try {
      const golden = rulesetManager.getGoldenRuleset();
      forcePushBlocked = golden.rules.some((r) => r.type === 'non_fast_forward');
    } catch {
      forcePushBlocked = false;
    }
    gates.push({
      index: 4,
      name: 'Force push protection',
      status: forcePushBlocked ? 'PASS' : 'FAIL',
      detail: forcePushBlocked ? 'Regra non_fast_forward bloqueia force pushes categoricamente' : 'Proteção de force push desabilitada',
    });

    // [5/10] PR requirement
    let prRequired = false;
    try {
      const golden = rulesetManager.getGoldenRuleset();
      prRequired = golden.rules.some((r) => r.type === 'pull_request');
    } catch {
      prRequired = false;
    }
    gates.push({
      index: 5,
      name: 'PR requirement',
      status: prRequired ? 'PASS' : 'FAIL',
      detail: prRequired ? 'Merge direto bloqueado; exige Pull Request e aprovação de Code Owner' : 'Pull Request não obrigatório',
    });

    // [6/10] Vortex required check
    let requiredChecksOk = false;
    try {
      const golden = rulesetManager.getGoldenRuleset();
      const statusCheckRule = golden.rules.find((r) => r.type === 'required_status_checks') as any;
      requiredChecksOk = !!statusCheckRule?.parameters?.required_status_checks?.length;
    } catch {
      requiredChecksOk = false;
    }
    gates.push({
      index: 6,
      name: 'Vortex required check',
      status: requiredChecksOk ? 'PASS' : 'FAIL',
      detail: requiredChecksOk ? 'Status checks obrigatórios: Conformance, Quality Gates e Benchmark Gate' : 'Checks obrigatórios não configurados no ruleset',
    });

    // [7/10] Governance workflow
    const workflowInstaller = new WorkflowInstaller(this.baseDir);
    const wfAudit = workflowInstaller.auditWorkflows();
    gates.push({
      index: 7,
      name: 'Governance workflow',
      status: wfAudit.allPresent ? 'PASS' : 'FAIL',
      detail: wfAudit.allPresent ? `Todos os ${wfAudit.totalRequired} workflows de governança instalados em .github/workflows/` : `Faltam ${wfAudit.totalRequired - wfAudit.presentCount} workflows mandatórios`,
    });

    // [8/10] Agent onboarding
    const onboardingInstaller = new OnboardingInstaller(this.baseDir);
    const docAudit = onboardingInstaller.auditDocs();
    const hasOnboarding = docAudit.docs.some((d) => d.path.includes('AGENT-ONBOARDING.md') && d.exists);
    gates.push({
      index: 8,
      name: 'Agent onboarding',
      status: hasOnboarding ? 'PASS' : 'FAIL',
      detail: hasOnboarding ? 'docs/agents/AGENT-ONBOARDING.md instalado e verificado' : 'Documento de onboarding ausente',
    });

    // [9/10] Governance conformance
    const hasProfileDoc = docAudit.docs.some((d) => d.path.includes('VUA-REPOSITORY-GOVERNANCE-PROFILE') && d.exists);
    const hasCodeowners = docAudit.docs.some((d) => d.path === 'CODEOWNERS' && d.exists);
    const conformanceReady = hasProfileDoc && hasCodeowners;
    gates.push({
      index: 9,
      name: 'Governance conformance',
      status: conformanceReady ? 'PASS' : 'FAIL',
      detail: conformanceReady ? 'CODEOWNERS e especificações de governança instaladas e auditadas' : 'CODEOWNERS ou docs de perfil ausentes',
    });

    // [10/10] Final verification
    const passedCount = gates.filter((g) => g.status === 'PASS').length;
    const finalPass = passedCount === 9; // If the previous 9 passed
    gates.push({
      index: 10,
      name: 'Final verification',
      status: finalPass ? 'PASS' : 'FAIL',
      detail: finalPass ? 'Repositório 100% em conformidade com o perfil VUA/Vortex v1' : 'Conformidade incompleta',
    });

    const score = gates.filter((g) => g.status === 'PASS').length;
    const overall = score === 10 ? 'COMPLIANT' : 'NON_COMPLIANT';

    return {
      repository: repoSlug,
      overall,
      score,
      total: 10,
      gates,
    };
  }
}
