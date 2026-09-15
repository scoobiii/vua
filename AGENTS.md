/**
 * Vortex Agent Governance Contract
 *
 * Mandated Governance Specification for Autonomous & Assisted Coding Agents
 */

# Vortex Agent Governance Contract

## Authority

Agent output is untrusted input.

The agent must never claim that it:
- pushed a branch;
- created a pull request;
- merged a pull request;
- deployed software;
- contacted a remote provider;
- measured physical hardware;

unless the VUA returned a verified remote confirmation or a signed local measurement with the required environment fields.

## Fail closed

If credentials are missing, return:
- success: false
- external_effect: none
- an explicit error code

Never synthesize:
- URLs;
- PR numbers;
- mergeability;
- RPS;
- baseline values;
- hardware identity;
- remote status.

## Evidence

A log line is not evidence.

Every external mutation must include:
- provider;
- authenticated principal;
- action;
- target;
- base SHA;
- head SHA;
- payload hash;
- approval binding;
- remote response;
- execution proof.

## Performance

Never label a container benchmark as a physical-device benchmark.

Never report PASS_SUPERIOR unless the trusted evaluator calculated it from:
- the same workload;
- the same environment class;
- the configured policy;
- repeated measurements;
- independent quality gates.

## Git

Use the following sequence:

1. inspect;
2. classify;
3. predict side effects;
4. validate scope;
5. request approval;
6. execute;
7. verify;
8. report only observed facts.

The agent cannot authorize its own output.

## Mandatory stop conditions

Stop and report failure when:
- a token is missing;
- a target is ambiguous;
- scope is wildcard;
- approval is missing or expired;
- a proof is invalid;
- a remote result cannot be verified;
- a benchmark is not comparable;
- a gate is red;
- multiple causal changes make attribution impossible.
