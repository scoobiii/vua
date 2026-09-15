# VUA / Vortex Agent Onboarding Protocol

Welcome, autonomous agent or mandated development operator.

Before performing any read, write, or refactor operations in this repository, you **MUST** run:

```bash
vua repo inspect
```

### 1. Inspection Gate
- If status is `COMPLIANT`:
  - You may proceed with local branch creation and testing.
  - All proposals must be submitted via Pull Request targeting `main`.
  - Direct pushes to `main` are blocked by GitHub Ruleset and will fail closed.
- If status is `NON_COMPLIANT`:
  - **STOP IMMEDIATELY.**
  - Do not modify protected production state.
  - Run `vua repo bootstrap` if authorized, or notify repository administrator.

### 2. Required Local Pre-Flight Gates
Prior to pushing any branch:
```bash
npm run lint         # TypeScript static analysis
npm run verify:gos3  # GOS3 Contract Header audit
npm run build        # Production bundle compilation
npm test             # 100% Conformance test suite
```

### 3. Agent Submission Workflow
1. Create a feature branch: `git checkout -b candidate/<feature-slug>`
2. Execute bounded, minimal changes strictly matching requested intent.
3. Verify all 4 pre-flight checks pass locally.
4. Push to origin branch and open a Pull Request.
5. The `Agent Patch Arena — Benchmark Gate` workflow will trigger automatically.
6. Only candidates that achieve `PASS_SUPERIOR` or explicit intent approval without regressing quality will be promoted by `agent-patch-arena-promotion.yml`.
