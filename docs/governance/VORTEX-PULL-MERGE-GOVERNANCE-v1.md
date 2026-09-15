# Vortex Pull & Merge Governance v1

## 1. Multi-Agent Development Flow
All external agents, human developers, and autonomous workers operate under:

```
READ 
  → INSPECT 
  → PLAN 
  → CHANGE 
  → TEST 
  → COMMIT 
  → PUSH 
  → PULL REQUEST 
  → VORTEX GOVERNANCE 
  → INDEPENDENT VERIFICATION 
  → REQUIRED CI 
  → PROTECTED MERGE
```

## 2. Pull Safety Rules
- Pulling or rebasing from external branches introduces untrusted state into the local tree.
- Never assume pulled changes are safe simply because the author is an authorized agent or commit was previously green.
- Treat every pulled tree as a **NEW CANDIDATE**.
- When changes conflict, do not choose a version based on authorship or agent priority.
- Resolve conflicts strictly according to test suites, GOS3 invariants, and policy contracts.

## 3. Governance Immutability
- Never weaken, disable, or bypass CI checks to make a patch pass.
- Never modify the evaluator and product behavior in the same change.
- All governance changes require independent review by designated repository code owners.
