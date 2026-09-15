#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Vortex Foundation: Git Sync Conflict Auditor & Resolution Helper
# ==============================================================================

STRATEGY="${1:---audit}"

echo "🔍 [SYNC-AUDITOR] Verificando integridade e marcadores reais de conflito Git..."

# Busca por marcadores reais de conflito Git (^<<<<<<<, ^=======$, ^>>>>>>>)
CONFLICT_MARKERS=$(grep -rn \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=.git \
  --exclude-dir=docs \
  --exclude="resolve-sync-conflicts.sh" \
  --exclude="sync-conflict-resolver.yml" \
  -E '^<{7}|^={7}$|^>{7}' . || true)

if [ -n "$CONFLICT_MARKERS" ]; then
  echo "⚠️  [CONFLITO ENCONTRADO] Marcadores de merge conflict detectados nos arquivos:"
  echo "$CONFLICT_MARKERS"
  
  if [ "$STRATEGY" == "--ours" ] || [ "$STRATEGY" == "--keep-workspace" ]; then
    echo "⚙️  Aplicando estratégia: PRIORIZAR WORKSPACE LOCAL (ours)..."
    while IFS= read -r line; do
      FILE=$(echo "$line" | cut -d: -f1)
      if [ -f "$FILE" ]; then
        echo "   -> Higienizando e preservando versão superior em $FILE"
        awk '/^<{7}/{flag=1;next}/^={7}$/{flag=0;skip=1;next}/^>{7}/{skip=0;next}!skip' "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"
      fi
    done <<< "$CONFLICT_MARKERS"
  elif [ "$STRATEGY" == "--theirs" ] || [ "$STRATEGY" == "--keep-remote" ]; then
    echo "⚙️  Aplicando estratégia: PRIORIZAR REMOTO / GITHUB (theirs)..."
    while IFS= read -r line; do
      FILE=$(echo "$line" | cut -d: -f1)
      if [ -f "$FILE" ]; then
        echo "   -> Higienizando e aplicando versão remota em $FILE"
        awk '/^<{7}/{skip=1;next}/^={7}$/{skip=0;next}/^>{7}/{next}!skip' "$FILE" > "${FILE}.tmp" && mv "${FILE}.tmp" "$FILE"
      fi
    done <<< "$CONFLICT_MARKERS"
  else
    echo "❌ Conflito não resolvido. Use '--ours' para priorizar workspace ou resolva manualmente."
    exit 1
  fi
else
  echo "✅ Nenhum marcador de conflito Git encontrado na árvore de trabalho."
fi

# Validação de segurança pós-resolução
echo "🧪 [SYNC-AUDITOR] Executando validação pós-resolução..."
if command -v npm >/dev/null 2>&1; then
  npm run lint
  npx tsx scripts/test-canary.ts
  echo "✅ Validação de integridade concluída com sucesso! Árvore íntegra."
else
  echo "ℹ️  npm não disponível neste subshell; pulando execução de testes."
fi
