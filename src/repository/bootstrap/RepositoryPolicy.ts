/**
 * VUA Repository Governance Policy & Types
 * Defines schemas, contract declarations, and ruleset models
 */

export interface VortexRepositoryContract {
  $schema?: string;
  schema: string;
  repository: string;
  governance: {
    profile: string;
    minimum_version: string;
    evaluation_mode: 'FAIL_CLOSED' | 'AUDIT_ONLY';
  };
  default_branch: string;
  required_workflows: string[];
  required_checks: string[];
  protected_branches: string[];
  ruleset: {
    name: string;
    target: string;
    enforcement: 'active' | 'evaluate' | 'disabled';
    ref_name_include: string[];
  };
  enforcement: {
    force_push: boolean;
    deletion: boolean;
    pull_request_required: boolean;
    up_to_date_required: boolean;
    dismiss_stale_reviews: boolean;
    require_code_owner_review: boolean;
    required_approvals: number;
    require_last_push_approval?: boolean;
  };
}

export interface GitHubRulesetSchema {
  id?: number;
  name: string;
  target: 'branch' | 'tag';
  enforcement: 'active' | 'evaluate' | 'disabled';
  bypass_actors: Array<{
    actor_id: number;
    actor_type: string;
    bypass_mode: string;
  }>;
  conditions: {
    ref_name: {
      include: string[];
      exclude?: string[];
    };
  };
  rules: Array<
    | { type: 'deletion' }
    | { type: 'non_fast_forward' }
    | {
        type: 'pull_request';
        parameters: {
          required_approving_review_count: number;
          dismiss_stale_reviews_on_push: boolean;
          require_code_owner_review: boolean;
          require_last_push_approval: boolean;
          required_review_thread_resolution: boolean;
        };
      }
    | {
        type: 'required_status_checks';
        parameters: {
          strict_required_status_checks_policy: boolean;
          required_status_checks: Array<{
            context: string;
            integration_id?: number;
          }>;
        };
      }
  >;
}

export interface InspectionGateItem {
  id: string;
  name: string;
  category: 'identity' | 'branch' | 'ruleset' | 'protection' | 'workflow' | 'docs' | 'conformance';
  status: 'PASS' | 'FAIL' | 'MISSING' | 'WARN';
  details: string;
}

export interface InspectionResult {
  repository: string;
  default_branch: string;
  timestamp: string;
  overall_status: 'COMPLIANT' | 'NON_COMPLIANT' | 'DRIFT_DETECTED';
  gates: InspectionGateItem[];
  ruleset_active: boolean;
  drift_details?: string[];
}

export interface BootstrapStepLog {
  step: number;
  total: number;
  title: string;
  action: 'PASS' | 'CREATE' | 'INSTALL' | 'CONFIGURE' | 'UPDATE' | 'SKIP' | 'FAIL';
  detail: string;
}

export interface BootstrapResult {
  repository: string;
  success: boolean;
  status: 'VUA/VORTEX GOVERNED' | 'BOOTSTRAP_FAILED' | 'PARTIAL_BOOTSTRAP';
  logs: BootstrapStepLog[];
  evidence_hash?: string;
  timestamp: string;
}

export interface ConformanceVerificationResult {
  repository: string;
  overall: 'COMPLIANT' | 'NON_COMPLIANT';
  checks: Record<string, 'PASS' | 'FAIL'>;
  timestamp: string;
  summary: string;
}
