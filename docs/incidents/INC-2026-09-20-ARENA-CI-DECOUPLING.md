# INC-2026-09-20 — Desacoplamento Arena vs CI real

| Field | Value |
|-------|--------|
| **Status** | OPEN — remediation on branch `fix/arena-ci-subjection-no-ff-push` |
| **Severity** | High (merge-gate architecture) |
| **Component** | `.github/workflows/agent-patch-arena.yml` |
| **YAML** | FIRST-HAND verified on `main` |
| **Related** | Product PR #5 (Bend) — separate track |

## Summary
Arena can emit PASS_* / auto-merge messaging while required checks (quality-gates, conformance, execution integrity) are red. Subjection step was echo-only; FF step could `git push origin main`.

## Confirmed
- `pull_request_target` + `contents: write`
- Subjection = echo only
- merge_gate = grep PASS_* on arena_output.txt
- FF Auto-Merge = git push origin main (label/input gated)
- Promotion path uses `gh pr merge --auto` (safer if branch protection set)

## Pain
main integrity, npm consumers, CI-subjection credibility — not individual blame on PR #5 author.

## Remediation (this PR)
1. Checks API subjection (`ci_subjection`)
2. merge_gate requires not blocked
3. No direct push; `gh pr merge --auto` only
4. `persist-credentials: false` on checkout

## Close when
- [ ] No executable `git push origin main` in Arena job
- [ ] Subjection blocks merge path when required checks not success
- [ ] Branch protection requires quality-gates + integrity + conformance
