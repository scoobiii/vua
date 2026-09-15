#!/usr/bin/env node

const fs = require("node:fs");
const crypto = require("node:crypto");

function argument(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const file = argument("--file");
const expectedBaseSha = argument("--base-sha", "");
const expectedHeadSha = argument("--head-sha");
const minGain = Number(argument("--min-gain", "0"));

if (!file || !expectedHeadSha) {
  throw new Error("Usage: --file FILE --head-sha SHA [--base-sha SHA] [--min-gain N]");
}

const result = JSON.parse(fs.readFileSync(file, "utf8"));

const required = [
  "schema",
  "base_sha",
  "head_sha",
  "verdict",
  "baseline_score",
  "candidate_score",
  "gain",
  "quality"
];

for (const field of required) {
  if (!(field in result)) {
    throw new Error(`Missing evidence field: ${field}`);
  }
}

if (result.schema !== "vortex.patch-arena.v1") {
  throw new Error("Unsupported Arena evidence schema");
}

if (result.head_sha !== expectedHeadSha) {
  throw new Error("Arena head SHA does not match the tested commit");
}

if (expectedBaseSha && result.base_sha !== expectedBaseSha) {
  throw new Error("Arena base SHA does not match the PR base");
}

if (!Number.isFinite(result.baseline_score)) {
  throw new Error("Invalid baseline score");
}

if (!Number.isFinite(result.candidate_score)) {
  throw new Error("Invalid candidate score");
}

if (!Number.isFinite(result.gain)) {
  throw new Error("Invalid gain");
}

const calculatedGain = result.candidate_score - result.baseline_score;

if (Math.abs(calculatedGain - result.gain) > 1e-9) {
  throw new Error("Reported gain does not match score difference");
}

if (result.gain < minGain) {
  throw new Error(
    `Gain ${result.gain} is below required threshold ${minGain}`
  );
}

if (result.quality?.passed !== true) {
  throw new Error("Absolute quality gates did not pass");
}

const allowedVerdicts = [
  "PASS_SUPERIOR",
  "PASS_SECURITY",
  "PASS_GOVERNANCE",
  "PASS_CORRECTNESS",
  "FAIL"
];

if (!allowedVerdicts.includes(result.verdict)) {
  throw new Error(`Unsupported verdict: ${result.verdict}`);
}

const digest = crypto
  .createHash("sha256")
  .update(fs.readFileSync(file))
  .digest("hex");

console.log(JSON.stringify({
  valid: true,
  schema: result.schema,
  verdict: result.verdict,
  base_sha: result.base_sha,
  head_sha: result.head_sha,
  gain: result.gain,
  evidence_sha256: digest
}, null, 2));
