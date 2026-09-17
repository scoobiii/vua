# VUA — Product Status & Market Scope

**Status date:** 2026-09-17  
**Repository:** `scoobiii/vua`  
**Package identity:** `@vortexfoundation/vua`  
**Scope:** engineering/product status, not a commercial certification.

## 1. What exists today

VUA is an executable software product composed of:

- **CLI:** `vua` command exposed through the npm `bin` field.
- **Core runtime:** Vortex pipeline with governed execution and `ExecutionProof`.
- **Cryptographic verification:** Ed25519 signatures, RFC 8785/JCS canonicalization, SHA-256 hashes and independent proof verification.
- **MCP interface:** JSON-RPC over the local MCP endpoint and stdio MCP mode.
- **OS adapters:** Linux, Android, Windows and GitHub adapters in the repository.
- **LLM integration:** governed local/cloud LLM execution paths.
- **Benchmarking:** local crypto benchmark, semantic oracle benchmark and MCP E2E benchmark.

The npm package metadata is configured as `@vortexfoundation/vua` with a `vua` executable entry point. This proves **package configuration**, not publication availability on the public npm registry. Public publication must be verified separately at release time.

## 2. Evidence closed on 2026-09-17

The audited Alpine Linux ARM64 MCP run established:

| Gate | Evidence |
|---|---|
| MCP `tools/list` | PASS, 314.5 req/s, p50 2.74 ms |
| `vortex.inspect` | PASS, 47.2 req/s, p50 21.77 ms |
| `vortex.verify` valid | PASS, 244.2 req/s, p50 3.82 ms |
| `vortex.verify` tampered | PASS, 268.8 req/s, p50 3.49 ms |
| inspect → verify E2E | PASS, 36.6 req/s, p50 26.65 ms |
| E2E concurrency 1/5/10/20 | 0.0% observed errors |
| Server RSS | 16.61 MB initial → 27.50 MB after load |
| Explicit MCP `request_id` | PASS in the audited benchmark |
| Semantic oracle | 24/30 accepted; 6 rejected/needs capability |
| Local crypto benchmark | 200/200 Ed25519 validations |

These figures characterize one ARM64/Alpine environment and are **not** a universal SLA.

## 3. Product boundary

VUA should currently be described as an **engineering-ready governance/runtime product**, not as a finished enterprise SaaS, OS distribution or compliance certification.

Still-open release gates include:

1. restart/recovery regression;
2. proof-hash tamper regression and independent recomputation;
3. complete package-build verification from a clean checkout;
4. npm registry publication verification;
5. Linux service/package integration if system-level installation is required;
6. repeatable CI evidence for the release candidate.

## 4. Market/application domains

VUA has a technically relevant fit for several markets without assuming that any one market is the exclusive target:

### AI agent governance

- governed tool execution;
- independent verification of execution artifacts;
- audit trails for agent actions;
- policy enforcement around tool use.

### MCP infrastructure

- local MCP gateways;
- governance layers between LLM clients and tools;
- verification of MCP-originated execution artifacts;
- developer and enterprise agent platforms.

### DevSecOps / software supply chain

- signed execution evidence;
- repository automation with bounded permissions;
- CI/CD governance;
- provenance and audit evidence for automated changes.

### Edge AI / local AI

- ARM64 devices;
- Linux edge gateways;
- Termux/Android development environments;
- offline or constrained environments where a lightweight runtime matters.

### Infrastructure and operations

- governed filesystem/runtime actions;
- infrastructure agents;
- controlled administrative automation;
- evidence generation for operational workflows.

### Regulated or auditable workflows

The cryptographic evidence model can be applied where an organization needs an independently verifiable record of what an automated component executed. Actual regulatory suitability depends on the applicable regulation, controls, deployment architecture and organizational processes; VUA itself is not a regulatory certification.

## 5. Linux positioning

Current Linux support is **runtime-native at the CLI/application level**: VUA runs directly under Node.js on Linux and exposes Linux-specific adapters. It is not yet an ELF-native standalone executable and the repository does not, by itself, establish a complete Debian/RPM/APK/systemd distribution.

The intended progression is:

```text
npm package + CLI
        ↓
Linux adapters + MCP stdio/HTTP
        ↓
reproducible package build
        ↓
optional systemd service / Debian-RPM-APK packaging
        ↓
enterprise Linux distribution
```

Do not describe the current repository as a native Linux OS package until the corresponding packaging/service artifacts are implemented and tested.

## 6. Product statement

> **VUA is a lightweight execution-governance runtime for AI agents and MCP systems, providing bounded execution, cryptographically signed execution evidence and independent verification across local and edge environments.**

That statement is supported by the current repository architecture and the 2026-09-17 MCP evidence; performance and market claims must remain environment-specific and evidence-backed.
