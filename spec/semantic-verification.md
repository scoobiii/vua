# VUA — Capability Orchestration, Escalation & Semantic Verification Specification v0.2

> Status: draft normative specification
> Date: 2026-09-09
> Companion: Vortex Invocation Contract v0.4

## 1. Purpose

VUA is the universal capability-selection, routing and adapter layer between an agent/LLM and governed execution.

VUA MUST NOT treat an LLM response as proof of correctness. More importantly, VUA MUST NOT model intelligence as a single capability. Mathematics, web search, retrieval, vision, code execution, APIs, planning, memory and domain reasoning are complementary capabilities in an AGI-style system.

The central rule is:

```text
LLM inference        ≠ truth
Web search           ≠ truth
ExecutionProof       ≠ semantic truth
Capability success   ≠ task success
```

The system SHOULD use the cheapest authorized capability that can establish the required property, and SHOULD escalate when the current capability cannot establish it.

## 2. Core architecture

```text
                         REQUEST
                            │
                            ▼
                     VUA INTENT / TASK
                       CLASSIFIER
                            │
                            ▼
                  CAPABILITY ROUTER
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
      LLM              external evidence      deterministic
   inference            Search / API / RAG    / specialized
        │                   │                    │
        └───────────────────┼────────────────────┘
                            ▼
                     CANDIDATE RESULT
                            │
                            ▼
                    VERIFICATION ROUTER
                            │
                 ┌──────────┼──────────┐
                 ▼          ▼          ▼
             semantic    evidence   execution
             verifier    verifier   verifier
                 │          │          │
                 └──────────┼──────────┘
                            ▼
                       VORTEX GATEWAY
                            │
             identity / authorization / policy
                 scope / limits / audit / proof
                            │
                            ▼
                         RESULT
```

VUA selects and composes capabilities. Vortex governs their execution and proof boundary.

## 3. Capability model

A capability is an independently addressable unit of competence or evidence acquisition. Examples include:

- `llm.inference.v1`
- `retrieval.local.v1`
- `web.search.v1`
- `web.fetch.v1`
- `api.query.v1`
- `math.solve.v1`
- `units.convert.v1`
- `logic.check.v1`
- `schema.validate.v1`
- `ocr.extract.v1`
- `vision.detect.v1`
- `metrology.measure.v1`
- `compiler.build.v1`
- `tests.run.v1`
- `domain.rule.v1`
- `human.review.v1`

A capability descriptor SHOULD expose:

```json
{
  "capability_id": "web.search.v1",
  "kind": "external_evidence",
  "input_types": ["natural_language_query"],
  "output_type": "search_evidence",
  "deterministic": false,
  "probabilistic": false,
  "side_effect": false,
  "external_dependency": true,
  "network_required": true,
  "cost_class": "low",
  "authority": "vua",
  "version": "1.0.0",
  "proof_required": true,
  "verification_capabilities": ["verify.web.source.v1"]
}
```

Capabilities MUST declare whether they are deterministic, probabilistic, side-effecting, externally dependent, network-dependent, and independently verifiable.

## 4. Intelligence is compositional

VUA MUST NOT assume that a stronger LLM alone dominates a composition of smaller specialized capabilities.

```text
small LLM
   + retrieval
   + web/API
   + deterministic tools
   + vision/OCR
   + domain rules
   + memory
   + verification
   + planning
        │
        ▼
   composite capability
```

A junior model can outperform a senior model on a bounded task when the junior is connected to the correct authoritative capability and the senior is not.

This is not a claim that the junior model is intrinsically more intelligent. It is a system-level capability advantage.

## 5. Task decomposition and routing

Before execution, VUA SHOULD classify the task along these dimensions:

- knowledge freshness;
- deterministic vs probabilistic nature;
- required precision;
- required external evidence;
- required modality;
- side-effect risk;
- verification availability;
- latency/cost constraints;
- offline/online availability.

Examples:

| Task characteristic | Preferred capability |
|---|---|
| stable factual knowledge | local knowledge / RAG / LLM |
| current fact | web search + source extraction |
| numerical calculation | deterministic math |
| unit conversion | deterministic units |
| structured output | schema validator |
| source code | compiler + tests |
| image text | OCR |
| object count/location | vision detection |
| physical measurement | metrology + deterministic conversion |
| domain safety | domain rule engine |
| unavailable proof | escalation or `NOT_PROVABLE` |

Web search MUST be treated as an evidence-acquisition capability, not as a generic intelligence upgrade.

## 6. Escalation / "ask for help" policy

When the current capability cannot establish the required property, VUA MUST NOT silently convert uncertainty into success.

The router SHOULD escalate in this order:

```text
current capability
      │
      ├── sufficient evidence → verify
      │
      └── insufficient evidence
               │
               ▼
       cheapest suitable verifier
               │
               ├── PASS → accept
               ├── FAIL → repair/replan
               └── NOT_PROVABLE
                       │
                       ▼
               next authorized capability
                       │
                       ▼
                stronger model / API /
                web / specialist / human
                       │
                       ▼
                 NOT_PROVABLE
```

Escalation MUST be bounded by policy, attempt limits, timeout, cost, network permissions and capability scope.

A model MAY request help, but the model MUST NOT authorize its own unrestricted tool use.

## 7. Confidence is not verification

LLM confidence, self-consistency, fluent explanation, or agreement with a previous answer MUST NOT by itself produce `semantic_verified=true`.

If a task has a suitable deterministic or specialized verifier, VUA SHOULD invoke it regardless of the LLM's confidence when policy requires proof.

## 8. Web search and external APIs

VUA SHOULD invoke `web.search.v1` when the task requires information that is:

- current or time-sensitive;
- explicitly requested from the web;
- unavailable in authorized local knowledge/RAG;
- dependent on an external source;
- required for source comparison or citation.

VUA SHOULD NOT invoke web search merely to compensate for a deterministic task that can be solved locally.

Example:

```text
"What is the current MCP specification version?"
        ↓
web.search.v1
        ↓
source extraction
        ↓
source evidence
        ↓
LLM synthesis
        ↓
verify.web.source.v1
```

The search result, fetched content, source identifiers and extraction result are evidence objects and MUST be independently hashable.

## 9. Evidence graph and hashes

Different objects MUST have distinct semantic identities. A sandbox hash MUST NOT be presented as the hash of an LLM response.

Recommended evidence graph:

```text
request
  │
  ├── request_hash
  │
  ├── sandbox_hash
  │
  ├── toolchain_hash
  │
  ├── candidate_output_hash
  │
  ├── capability_evidence_hash
  │       ├── search_query_hash
  │       ├── source_set_hash
  │       └── extracted_evidence_hash
  │
  ├── semantic_check_hash
  │
  └── execution_proof_hash
```

`execution_proof_hash` MAY commit to the complete canonical evidence manifest, but each component hash MUST retain its own meaning.

A repeated sandbox hash across different LLM outputs is not inherently a collision. It is a defect only if the implementation claims that hash represents the output content or uses it as such.

## 10. Verification result

```json
{
  "verification_status": "PASS | FAIL | NOT_PROVABLE",
  "semantic_verified": true,
  "capability_id": "units.convert.v1",
  "check_id": "sha256:...",
  "input_hash": "sha256:...",
  "candidate_hash": "sha256:...",
  "evidence_hash": "sha256:...",
  "reason": "25.4 mm / 25.4 = 1 in",
  "deterministic": true
}
```

`PASS` means the declared verifier accepted the candidate under its contract.

`FAIL` means the candidate violated that contract.

`NOT_PROVABLE` means suitable evidence or a suitable verifier is unavailable. It MUST NOT be rewritten as `PASS` because an LLM was confident.

## 11. Composite verification

Complex tasks MAY require multiple capabilities:

```text
question
  ↓
web search
  ↓
source extraction
  ↓
LLM synthesis
  ↓
deterministic calculation
  ↓
domain rule
  ↓
semantic verification
```

The overall result MUST identify which claims were verified and by which capabilities. One successful verifier MUST NOT automatically certify unrelated claims.

## 12. Measurement rule

Physical measurement MUST separate perception from computation:

```text
image
 ↓
measurement_candidate
 ↓
metrology / vision verification
 ↓
deterministic conversion
 ↓
range / consistency checks
 ↓
semantic verification
```

Example:

```text
28 mm / 25.4 = 1.102362... in
```

The LLM MUST NOT silently normalize 28 mm to 1 inch.

## 13. Failure and recovery

The original candidate MUST be retained when verification fails.

```text
LLM → "180"
 ↓
units.convert.v1
 ↓
FAIL
 ↓
semantic_verified=false
 ↓
REPLAN / ESCALATE
 ↓
correct candidate
```

Recovery MUST produce a new attempt/evidence identity rather than overwriting the failed attempt.

## 14. Security boundary

Authorization MUST precede every adapter side-effect:

```text
REQUEST
 ↓
capability selection
 ↓
VORTEX identity
 ↓
authorization
 ↓
policy / scope / limits
 ↓
ALLOW
 ↓
adapter
```

An adapter MUST NOT self-assert unrestricted principal or wildcard authority.

## 15. Proof boundary

VUA/Vortex MUST distinguish:

- `execution_verified` — execution/evidence chain passed integrity checks;
- `evidence_integrity_verified` — hashes/signatures/canonicalization passed;
- `semantic_verified` — applicable verifier passed;
- `side_effect_verified` — external effect has independently verifiable evidence.

Cryptographic integrity MUST NOT be interpreted as semantic truth.

## 16. Offline-first / online augmentation

Core VUA operation MUST remain possible without cloud connectivity when the required capabilities are local.

When connectivity is available, VUA MAY activate authorized network capabilities such as web search or external APIs.

```text
OFFLINE
LLM + local RAG + deterministic + local tools

ONLINE
        + web/API/search
        + remote models
        + federation
```

Connectivity MUST be a capability constraint, not an architectural dependency.

## 17. Conformance tests

A conforming implementation MUST test:

1. deterministic arithmetic verification;
2. unit conversion precision;
3. semantic rejection of an incorrect but successfully executed LLM answer;
4. `NOT_PROVABLE` when no verifier exists;
5. current-fact routing to authorized web/API capability;
6. preservation and hashing of external evidence;
7. escalation after verifier failure;
8. bounded retry/attempt policy;
9. capability identity/version tracking;
10. authorization before adapter side-effect;
11. preservation of failed candidates and evidence;
12. independent proof of evidence integrity;
13. separation of sandbox hash from candidate-output hash;
14. offline behavior when network capabilities are unavailable.

## 18. Relationship with Vortex

```text
VUA
= capability discovery
+ task decomposition
+ routing
+ escalation
+ adapter invocation

Vortex
= identity
+ authority
+ policy
+ bounded execution
+ evidence
+ independent verification
+ proof
```

VUA selects what should help. Vortex governs whether and how that capability may execute.

## 19. Maturity gate

```text
M0 capability descriptor
 ↓
M1 routing contract + tests
 ↓
M2 real capability execution
 ↓
M3 independent semantic verification
 ↓
M4 evidence graph + proof
 ↓
M5 escalation/recovery
 ↓
M6 CI/conformance + promotion
```

The prohibited shortcut is:

```text
LLM confidence → VERIFIED
```

The required path is:

```text
proposal
 → capability selection
 → governed execution
 → evidence
 → independent verification
 → PASS / FAIL / NOT_PROVABLE
```
