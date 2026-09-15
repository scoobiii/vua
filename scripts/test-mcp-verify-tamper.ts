import { executeVortexPipeline, resetAntiReplayCache } from '../src/vortex/gateway.js';
import { verifyExecutionProof } from '../src/vortex/verifier.js';

resetAntiReplayCache();

const requestId = `mcp-proof-${Date.now()}`;
const result = await executeVortexPipeline({
  request_id: requestId,
  operation: 'inspect',
  input: {},
});

if (!result.execution_proof) {
  throw new Error('inspect did not emit execution_proof');
}

const proof = result.execution_proof;
const original = verifyExecutionProof(proof);

if (!original.valid) {
  throw new Error(`valid proof rejected: ${original.reasons.join('; ')}`);
}

const tampered = structuredClone(proof);
tampered.output_hash = `sha256:${'0'.repeat(64)}`;

const bad = verifyExecutionProof(tampered);

if (bad.valid) {
  throw new Error('CRITICAL: tampered execution proof was accepted');
}

console.log('PASS original proof');
console.log('PASS tampered proof rejected');
console.log(JSON.stringify({
  original: original.valid,
  tampered: bad.valid,
  reasons: bad.reasons,
}, null, 2));
