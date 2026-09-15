#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

required=(
  "scripts/vua-baseline-attest.mjs"
  "scripts/verify-performance-baseline.mjs"
  "scripts/capture-performance-metrics.mjs"
  ".github/workflows/quality-gates.yml"
  ".github/workflows/refresh-baseline.yml"
)

printf '%s\n' "== VUA CI preparation ==" "Repository: $PWD"

if ! git rev-parse --show-toplevel >/dev/null 2>&1; then
  echo "ERROR: not a Git repository" >&2
  exit 2
fi

if git diff --quiet -- package-lock.json; then
  echo "package-lock.json: clean"
else
  echo "package-lock.json: modified"
  if [[ "${VUA_RESTORE_LOCKFILE:-}" == "yes" ]]; then
    git restore -- package-lock.json
    echo "package-lock.json: restored from HEAD"
  else
    echo "ACTION REQUIRED: review package-lock.json; set VUA_RESTORE_LOCKFILE=yes to restore it" >&2
    exit 3
  fi
fi

mkdir -p ci/keys ci/baselines

echo "Required repository files:"
missing=0
for file in "${required[@]}"; do
  if [[ "$file" == "scripts/capture-performance-metrics.mjs" && ! -s "$file" && -n "${VUA_CAPTURE_SOURCE:-}" && -s "$VUA_CAPTURE_SOURCE" ]]; then
    install -m 0755 "$VUA_CAPTURE_SOURCE" "$file"
    echo "  INSTALLED $file from $VUA_CAPTURE_SOURCE"
  fi
  if [[ -s "$file" ]]; then
    echo "  OK      $file"
  else
    echo "  MISSING $file"
    missing=1
  fi
done

if [[ ! -s ci/keys/baseline-public.pem ]]; then
  if [[ -n "${VUA_BASELINE_PRIVATE_KEY_FILE:-}" && -s "$VUA_BASELINE_PRIVATE_KEY_FILE" ]]; then
    umask 077
    openssl pkey -in "$VUA_BASELINE_PRIVATE_KEY_FILE" -pubout -out ci/keys/baseline-public.pem
    chmod 0644 ci/keys/baseline-public.pem
    echo "Generated ci/keys/baseline-public.pem from the supplied private key"
  else
    echo "MISSING ci/keys/baseline-public.pem"
    echo "Set VUA_BASELINE_PRIVATE_KEY_FILE to generate it, or add the public key manually."
    missing=1
  fi
else
  echo "  OK      ci/keys/baseline-public.pem"
fi

if [[ ! -s scripts/capture-performance-metrics.mjs ]]; then
  echo "MISSING scripts/capture-performance-metrics.mjs"
  echo "Refusing to fabricate benchmark data; implement it against the real VUA benchmark."
  missing=1
fi

GITHUB_VM_BASELINE="ci/baselines/vua-github-vm-x86_64.json"
RUNNER_PROFILE="${VUA_RUNNER_PROFILE:-github-vm}"

if [[ ! -s "$GITHUB_VM_BASELINE" ]]; then
  echo "MISSING $GITHUB_VM_BASELINE"
  if [[ -s scripts/capture-performance-metrics.mjs && -n "${VUA_BASELINE_PRIVATE_KEY_FILE:-}" && -s "$VUA_BASELINE_PRIVATE_KEY_FILE" ]]; then
    if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
      echo "Refusing to generate a GitHub VM baseline outside GitHub Actions."
      echo "Run this step on the ubuntu-24.04 GitHub runner, not on Mobile/Termux/Alpine."
      missing=1
    elif [[ "$RUNNER_PROFILE" != "github-vm" ]]; then
      echo "Refusing unexpected runner profile: $RUNNER_PROFILE"
      missing=1
    else
      echo "Capturing a real GitHub VM baseline from the configured benchmark..."
    node scripts/capture-performance-metrics.mjs \
      --output /tmp/vua-github-vm-metrics.json \
      --profile github-vm \
      --sample-size "${VUA_SAMPLE_SIZE:-200}"
    node scripts/vua-baseline-attest.mjs capture \
      --metrics /tmp/vua-github-vm-metrics.json \
      --key "$VUA_BASELINE_PRIVATE_KEY_FILE" \
      --out "$GITHUB_VM_BASELINE" \
      --profile github-vm
    node scripts/vua-baseline-attest.mjs verify \
      --baseline "$GITHUB_VM_BASELINE" \
      --key ci/keys/baseline-public.pem \
      --profile github-vm
    echo "  GENERATED $GITHUB_VM_BASELINE"
    fi
  else
    echo "Generate it only after the real capture script produces measured metrics."
    echo "Set VUA_BASELINE_PRIVATE_KEY_FILE to enable signed generation."
    missing=1
  fi
else
  echo "  OK      $GITHUB_VM_BASELINE"
fi

node --check scripts/vua-baseline-attest.mjs
node --check scripts/verify-performance-baseline.mjs

echo
git diff --check
printf '%s\n' "== Git status =="
git status --short

if (( missing )); then
  echo
echo "CI preparation incomplete: missing required files." >&2
  exit 4
fi

echo
echo "CI preparation complete. No commit or push was performed."
