# Security Policy — Vortex Execution Governance & VUA

Vortex MCP Execution Governance Profile v1 enforces the core security thesis:
> **SAFETY = AUTHORIZATION + BOUNDED EXECUTION + ACCOUNTABILITY + INDEPENDENT VERIFICATION + IDENTITY**

## Supported Versions

| Version | Status | Specification |
| ------- | ------ | ------------- |
| 1.0.x   | :white_check_mark: Supported | Vortex Execution Governance Profile v1 & GOS3 |
| < 1.0   | :x: End of Life | Experimental Alpha |

## Cryptographic & Execution Invariants

All governed executions across VUA (Universal Adapters), LLM gateways, and MCP tool invocations adhere to:

1. **JCS RFC 8785 Deterministic Canonicalization**: Execution proofs undergo strict JSON Canonicalization Scheme transformations prior to digest generation.
2. **Ed25519 Digital Signatures**: Proofs are signed using RFC 8032 Ed25519 keys (`key-vortex-2026-prod`). Signatures are verifiable offline and independently without contacting the origin gateway.
3. **Proof Over Prose Invariant**:
   - `output_hash` is computed over the genuine, serialized execution result (not mock or generic templates).
   - `duration_ms` and `[started_at, completed_at]` bounds must reflect true elapsed execution time without temporal drift (> 1000ms drift is cryptographically rejected).
4. **GOS3 Session Bounds**: Mutable and governed operations require active GOS3 cryptographic session tokens.
5. **Anti-Replay Nonce Enforcement**: Replayed `request_id` values within the temporal nonce cache are rejected with `REPLAY_ATTACK_DETECTED`.
6. **Isolated Sandbox Enclosure**: Path traversal prevention, boundary verification, and memory caps protect the host runtime.

## Reporting a Vulnerability

If you discover a security vulnerability, sandbox escape, signature verification flaw, or policy bypass in Vortex MCP or VUA:

1. **Do not create public GitHub issues** for zero-day vulnerabilities.
2. Please report the vulnerability privately with:
   - A description of the vulnerability and attack vector.
   - Minimal reproduction script or MCP payload.
   - Relevant `execution_proof` or canonical JCS payload if applicable.
3. **Response Timeline**:
   - **Initial Acknowledgement**: Within 24 hours.
   - **Triage & Status Assessment**: Within 48 hours.
   - **Patch Release & Security Advisory**: Within 7 business days for critical vulnerabilities.

