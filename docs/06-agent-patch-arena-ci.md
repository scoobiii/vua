# Vortex Agent Patch Arena CI

> **Vortex Open Governance Protocol — Patch Arena & CI Darwiniano**

## Purpose

Every proposed patch is an untrusted candidate. The CI, not the proposing agent, is the authority that measures correctness, benchmark gain and merge eligibility.

The architecture is based on isolated candidate branches/forks and measurable competition. No actor — human, Gemini, Claude, GPT, Qwen, bot or local agent — receives a scoring or merge privilege.

```text
Agent proposes patch
  -> isolated PR/fork
  -> trusted CI evaluator
  -> exact base/head comparison
  -> absolute quality + security gates
  -> repeated benchmark
  -> statistical comparison
  -> PASS_SUPERIOR / REJECT
  -> fresh identity verification
  -> protected auto-merge
```

## 1. Candidate contract

A candidate is identified by:

- repository;
- PR number;
- base SHA;
- head SHA;
- evaluator schema version;
- benchmark configuration.

The benchmark is invalid if the PR head or `main` base changes after measurement. A candidate must be re-evaluated after rebase, conflict resolution, or any advance of `main`.

## 2. Universal CI subjection

> **Normative rule:** every proposer is subject to exactly the same CI gates.

There is no production bypass for an agent or maintainer. The decision is based on executable evidence (`Proof over Prose`), not on proposer identity.

The five Canary invariants remain the safety floor where the repository's Canary suite is available:

1. missing approval is blocked with zero side effects;
2. wildcard authorization is rejected with zero side effects;
3. authorized execution succeeds and produces a verifiable proof;
4. tampered execution proof is rejected by the independent verifier;
5. read-only actions do not mutate state.

Failure of a mandatory safety invariant is an immediate rejection.

## 3. Absolute quality gates

A candidate cannot compensate for a correctness or security failure with performance.

The following are hard gates:

1. `npm ci --ignore-scripts` succeeds;
2. TypeScript lint/typecheck succeeds;
3. GOS3 header verification succeeds;
4. production build succeeds;
5. full conformance/test suite succeeds;
6. benchmark command succeeds for every repetition;
7. base and candidate are measured under the same runner, workload and iteration count;
8. no self-reported benchmark score is accepted.

Any failure is `REJECT`.

## 4. Benchmark policy

The production evidence gate uses the repository benchmark executable with a fixed workload:

| Parameter | Policy |
|---|---:|
| Benchmark | `npx tsx bin/vua.js bench` |
| Iterations/run | 1,000 |
| Repetitions | 5 |
| Aggregation | median |
| Minimum throughput gain | +5% |
| Maximum latency regression | +2% |
| Maximum RSS regression | +5% |
| Maximum throughput CV | 10% |

The candidate passes only when all constraints hold:

```text
throughput_gain >= +5%
AND latency_change <= +2%
AND memory_change <= +5%
AND max(CV_base, CV_candidate) <= 10%
```

A lower latency or lower memory can support a candidate, but a regression outside policy rejects it.

## 5. Statistical robustness

Five measurements are collected for both base and candidate. The median is the canonical value.

```text
CV = population_standard_deviation(samples) / mean(samples)
```

A noisy benchmark (`CV > 10%`) is rejected rather than treated as evidence of improvement.

The comparison is against the exact consolidated base, not against a stale benchmark or a score supplied by the candidate.

## 6. Trusted evaluator boundary

The evaluator is loaded from the PR base repository revision. Therefore the candidate cannot change the scoring algorithm, thresholds or verdict logic through its own patch.

The benchmark workflow is `pull_request_target` specifically so the evaluator definition comes from the trusted base repository. The evaluator has read-only repository permissions and removes GitHub authentication tokens from the candidate subprocess environment.

The candidate runs only on an ephemeral GitHub-hosted runner with:

- no repository secrets exposed to the candidate process;
- no write permission from the benchmark job;
- dependency installation with `npm ci --ignore-scripts`;
- no shared production runner;
- no candidate-generated score accepted as evidence.

Workflow and governance files must be protected by CODEOWNERS/review rules.

## 7. Evidence artifact

The Arena publishes `arena-result.json` containing:

- schema version;
- repository identity;
- base SHA;
- head SHA;
- policy parameters;
- absolute gate results;
- raw benchmark samples;
- medians;
- coefficient of variation;
- metric deltas;
- final verdict;
- rejection reason when applicable.

This artifact is the auditable evidence for promotion and later tournament/leaderboard aggregation.

## 8. Promotion boundary

A second trusted workflow consumes the completed Arena evidence. It does **not** execute the candidate code.

Before enabling auto-merge it verifies:

```text
artifact.schema == vortex.patch-arena.v1
artifact.verdict == PASS_SUPERIOR
artifact.head_sha == current PR head SHA
artifact.base_sha == current main SHA
PR is open
PR is not draft
PR base == main
PR is not in conflict
```

If any identity check fails, promotion stops and a fresh Arena run is required.

Promotion uses GitHub protected auto-merge. It must not bypass required reviews, required status checks or merge queues.

## 9. Merge conflicts and moving main

The Arena does not merge competing candidates together. Each candidate is evaluated against its exact base.

If `main` advances after benchmarking, the evidence is stale and promotion is refused. The candidate must be re-evaluated against the new `main` SHA.

If the candidate has a merge conflict, promotion is refused. The conflict must be repaired/rebased, a new head SHA must be pushed, and the Arena must run again.

There is no production `ours`/`theirs` conflict policy.

## 10. Agent accountability

```text
Gemini == Qwen == Claude == GPT == local agent == human patch
```

Agent identity has no scoring privilege. The trusted authority is the CI evidence.

## 11. Multi-agent tournament mode

Multiple candidates may originate from the same base SHA:

```text
                    exact base SHA
                   /       |       \
                  v        v        v
             candidate A  B       C
                  \        |       /
                   -> Arena ranking
                          |
                       winner
                          |
                   rebase/current main
                          |
                    final Arena run
                          |
                  protected merge
```

Scores from different bases must not be compared without explicit normalization and provenance.

## 12. Required repository controls

For production activation:

1. protect `main`;
2. require the Arena status check;
3. enable protected auto-merge/merge queue as appropriate;
4. require review for workflow and governance changes;
5. keep `.github/workflows/` in CODEOWNERS;
6. prefer squash merge for candidate patches;
7. keep the promotion workflow trusted and independent from candidate workflow definitions;
8. preserve Arena artifacts for audit;
9. require a fresh Arena result after any base/head change.

GitHub branch protection remains authoritative; the Arena is an evidence gate, not a bypass mechanism.

## 13. Local execution

To run the Arena locally from a repository clone with both revisions available:

```bash
python3 scripts/agent-patch-arena.py \
  --base "$(git rev-parse origin/main)" \
  --head "$(git rev-parse HEAD)" \
  --output arena-result.json
```

The local result is useful for diagnosis. Production merge eligibility requires the trusted CI run and its immutable artifact.
