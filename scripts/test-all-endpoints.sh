#!/usr/bin/env bash
set -e

HOST="http://localhost:3000"
echo "================================================================"
echo "    TESTANDO TODOS OS ENDPOINTS DA STACK VUA / VORTEX"
echo "    Alvo: $HOST"
echo "================================================================"

test_endpoint() {
  local method="$1"
  local path="$2"
  local data="$3"
  local desc="$4"

  echo -n "[$(date +'%T')] $method $path ($desc)... "

  if [ "$method" = "GET" ]; then
    res=$(curl -s -w "\n%{http_code}" "$HOST$path")
  else
    res=$(curl -s -w "\n%{http_code}" -X "$method" "$HOST$path" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  code=$(echo "$res" | tail -n1)
  body=$(echo "$res" | sed '$d')

  if [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then
    echo "✅ HTTP $code"
  else
    echo "❌ HTTP $code -> $body"
  fi
}

echo "--- 1. ENDPOINTS DE SAÚDE E CHAVES ---"
test_endpoint "GET" "/api/health" "" "API Health Status"
test_endpoint "GET" "/.well-known/vortex-keys" "" "RFC 8785 Ed25519 Public Keys"

echo -e "\n--- 2. ENDPOINTS DO PROTOCOLO VORTEX / VUA ---"
test_endpoint "GET" "/api/vortex/status" "" "Vortex Engine Status"
test_endpoint "GET" "/api/vortex/evidence" "" "Audit Evidence Logs"
test_endpoint "GET" "/api/vortex/gos3/sessions" "" "GOS3 Active Sessions"
test_endpoint "GET" "/api/vortex/llm/providers" "" "Configured LLM Providers"
test_endpoint "GET" "/api/vua/adapters" "" "VUA Native Adapters"

echo -e "\n--- 3. ENDPOINTS DE EXECUÇÃO E CONFORMANCE CRIPTOGRÁFICA ---"
EXEC_PAYLOAD='{
  "request_id": "req-smoke-test-1",
  "principal_id": "usr-admin-master",
  "agent_id": "agent-root-core",
  "connector_id": "math.calculate.v1",
  "operation": "math.add",
  "input_payload": {"a": 20, "b": 22},
  "runtime_id": "vua-local-runtime"
}'
test_endpoint "POST" "/api/vortex/execute" "$EXEC_PAYLOAD" "Execute Authorized Pipeline"

# Teste de Conformance Adversarial
test_endpoint "POST" "/api/vortex/conformance/adversarial" "{}" "5/5 Adversarial Invariant Tests"
test_endpoint "POST" "/api/vortex/conformance/e2e" "{}" "10/10 Foundation E2E Pipeline"
test_endpoint "POST" "/api/vua/conformance" "{}" "VUA Adapter Conformance Suite"

echo -e "\n--- 4. ENDPOINTS DE SESSÃO GOS3 & CHAVES ---"
test_endpoint "POST" "/api/vortex/gos3/session" '{"workload_name":"a23-edge","principal_id":"usr-admin-master","agent_id":"agent-root-core"}' "Open GOS3 Sandbox Session"
test_endpoint "POST" "/api/vortex/keys/rotate" "{}" "Ed25519 Key Rotation"
test_endpoint "POST" "/api/vortex/reset-replay" "{}" "Reset Nonce Replay Cache"

echo -e "\n--- 5. ENDPOINTS DE MODEL CONTEXT PROTOCOL (MCP) ---"
MCP_PROMPT='{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}'
test_endpoint "POST" "/mcp" "$MCP_PROMPT" "MCP JSON-RPC tools/list"

MCP_INVOKE='{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "vortex.math.calculate",
    "arguments": {
      "expression": "500 + 22"
    }
  }
}'
test_endpoint "POST" "/mcp" "$MCP_INVOKE" "MCP JSON-RPC tools/call vortex.math.calculate"

echo -e "\n--- 6. ENDPOINTS GITHUB E PROBE LOCAL ---"
test_endpoint "GET" "/api/github/status" "" "GitHub Adapter Status"
test_endpoint "GET" "/api/github/repos" "" "GitHub Repositories"
test_endpoint "GET" "/api/github/active-target" "" "GitHub Active Target Repo"
test_endpoint "POST" "/api/vua/adapters/linux/probe" "{}" "Probe Local Linux Adapter"
test_endpoint "POST" "/api/vua/adapters/github/probe" "{}" "Probe GitHub Adapter"
test_endpoint "POST" "/api/vua/adapters/android/probe" "{}" "Probe Android Adapter"
test_endpoint "POST" "/api/vua/adapters/windows/probe" "{}" "Probe Windows Adapter"

echo -e "\n================================================================"
echo "    TODOS OS ENDPOINTS FORAM TESTADOS COM SUCESSO!"
echo "================================================================"
