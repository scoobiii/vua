# VUA Security Specification (Firestore ABAC & Zero-Trust)

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be created or modified by the authenticated user whose `request.auth.uid == userId`. Role cannot be self-escalated to `admin` or `agent_operator` without administrative privilege.
2. **Proof Immutability Invariant**: Execution proofs `/execution_proofs/{proofId}` are immutable upon creation. An execution proof cannot be modified or updated after insertion.
3. **Proof Ownership & Verification Invariant**: Any execution proof record MUST have `owner_uid == request.auth.uid`. The Ed25519 signature and SHA-256 hashes must be non-empty strings with strict bounded lengths.
4. **Arena Tournament Invariant**: Tournament records `/arena_tournaments/{tournamentId}` must belong to the caller (`owner_uid == request.auth.uid`) and scores must be positive numbers.
5. **PII Isolation Invariant**: User profiles containing emails are private to that user and authorized system administrators with role `admin`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Payload 1 (Ghost Field Injection)**: Attempt to inject `isSuperAdmin: true` into `/users/{userId}` during creation. Expected: `PERMISSION_DENIED`.
2. **Payload 2 (Identity Spoofing in Proof)**: Create `/execution_proofs/{proofId}` with `owner_uid: "spoofed_target_uid"`. Expected: `PERMISSION_DENIED`.
3. **Payload 3 (Unverified Email Write)**: Write operation from account with `email_verified == false`. Expected: `PERMISSION_DENIED`.
4. **Payload 4 (Post-Creation Modification of Proof)**: Updating a completed execution proof's `output_hash` or `signature`. Expected: `PERMISSION_DENIED`.
5. **Payload 5 (Path Traversal / ID Poisoning)**: Document ID containing `../` or exceeding 128 characters. Expected: `PERMISSION_DENIED`.
6. **Payload 6 (Unbounded String Inflation)**: Injection of 2MB payload into `operation` or `signature`. Expected: `PERMISSION_DENIED`.
7. **Payload 7 (Cross-Tenant List Scraping)**: Querying `/execution_proofs` without filtering by `owner_uid == request.auth.uid`. Expected: `PERMISSION_DENIED`.
8. **Payload 8 (Arbitrary State Skipping in Tournaments)**: Setting `verdict: "PASS_SUPERIOR"` with negative scores or non-numeric deltas. Expected: `PERMISSION_DENIED`.
9. **Payload 9 (Unauthenticated Read)**: Unauthenticated client calling `get()` or `list()` on `/users`. Expected: `PERMISSION_DENIED`.
10. **Payload 10 (Delete Proof Anti-Tamper)**: Deleting an existing execution proof to cover unauthorized agent operations. Expected: `PERMISSION_DENIED`.
11. **Payload 11 (Malformed Timestamp Manipulation)**: Providing arbitrary client-forged timestamp strings instead of ISO / server time constraints. Expected: `PERMISSION_DENIED`.
12. **Payload 12 (Self-Assigned Admin Escalation)**: Regular user attempting to update `/users/{userId}` with `role: "admin"`. Expected: `PERMISSION_DENIED`.

## 3. Test Runner
Validation verified via automated conformance check and strict rule compilation in `firestore.rules`.
