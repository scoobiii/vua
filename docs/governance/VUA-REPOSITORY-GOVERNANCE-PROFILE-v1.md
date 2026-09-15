# VUA Repository Governance Profile v1

## 1. Principle & Purpose
A repository governed under **VUA/Vortex Governance Profile v1** ensures that:
- **Authorization $\neq$ Approval**: Mandated external agents are untrusted until independently verified.
- **Fail-Closed by Default**: Any missing, invalid, or ambiguous check results in rejection of integration.
- **Two-Tier Architecture**:
  1. **In-Repository Artifacts**: Declarations of intent (`.vortex/repository.json`), verification workflows (`.github/workflows/`), code ownership (`CODEOWNERS`), and onboarding (`docs/agents/AGENT-ONBOARDING.md`).
  2. **External Enforcement**: GitHub Ruleset (`VUA-VORTEX-main.ruleset.json`), branch protection, required status checks, and merge queue enforcement.

## 2. In-Repository Contract (`.vortex/repository.json`)
The repository contains a machine-verifiable contract defining:
- Schema: `vortex.repository.v1`
- Profile: `vua.repository-governance.v1`
- Required checks:
  - `Conformance, 100% Quality Gates & GOS3 Audit`
  - `Trusted benchmark comparison`
  - `Vortex Continuous Governance & Drift Conformance`
- Protected branches: `main`
- Direct pushes: `FORBIDDEN`
- Force pushes: `BLOCKED`
- Branch deletion: `BLOCKED`

## 3. GitHub Ruleset Enforcement
GitHub Ruleset `VUA/Vortex Production Main` enforces:
- Strict pull request requirement with at least 1 approving review.
- Dismiss stale approvals on push.
- Mandatory code owner approval for governance paths.
- Linear non-fast-forward merge prevention (`non_fast_forward`).
- Automated branch up-to-date validation before promotion.
