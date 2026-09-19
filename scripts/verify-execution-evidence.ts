/**
 * Offline ExecutionEvidence verifier.
 *
 * Deliberately does NOT import KEY_REGISTRY or verifyExecutionProof().
 * It validates the persisted evidence using Node's Ed25519 implementation,
 * the public key embedded in each proof, and RFC 8785 canonicalization.
 */
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import { canonicalize } from '../src/vortex/canonicalize.js';

type Proof = {
  executed: boolean;
  status: string;
  proof_hash?: string;
  signature: string;
  identity: { key_id: string; algorithm: 'Ed25519'; public_key?: string };
  [key: string]: unknown;
};

type Evidence = { results: Array<{ test_id: string; execution_proof?: Proof; proof_verification?: { valid: boolean } }> };

const evidence = JSON.parse(readFileSync('reports/execution-evidence/summary.json', 'utf8')) as Evidence;
const failures: string[] = [];

for (const result of evidence.results ?? []) {
  const proof = result.execution_proof;
  if (!proof) { failures.push(result.test_id + ': missing ExecutionProof'); continue; }
  if (!proof.executed) failures.push(result.test_id + ': executed=false');
  if (!proof.identity?.public_key) failures.push(result.test_id + ': embedded public key missing');
  if (proof.identity?.algorithm !== 'Ed25519') failures.push(result.test_id + ': algorithm is not Ed25519');

  const { signature, proof_hash, ...unsigned } = proof;
  const canonical = canonicalize(unsigned);
  const expectedHash = 'sha256:' + crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  if (proof_hash !== expectedHash) failures.push(result.test_id + ': proof_hash mismatch');

  try {
    const publicKey = crypto.createPublicKey(proof.identity.public_key!);
    const valid = crypto.verify(null, Buffer.from(canonical, 'utf8'), publicKey, Buffer.from(signature, 'base64'));
    if (!valid) failures.push(result.test_id + ': Ed25519 signature invalid');
  } catch (error) {
    failures.push(result.test_id + ': public key/signature parse failure: ' + String(error));
  }
}

const output = {
  schema: 'vua.execution-evidence-independent-verification.v1',
  proofs_checked: evidence.results?.length ?? 0,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
};
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
