# Relatório de Incidente: INC-2026-09-10-SYNC-CONFLICT

| Campo | Valor |
|---|---|
| **ID do Incidente** | `INC-2026-09-10-SYNC-CONFLICT` |
| **Data e Hora** | 2026-09-10T07:12:20 UTC (04:12:20 BRT) |
| **Severidade** | `SEV-2` (Bloqueio de Sincronização / Exportação Git) |
| **Status** | `MITIGADO / AGUARDANDO RESOLUÇÃO NO UI` |
| **Componentes Afetados** | Git Sync Bridge (Google AI Studio ↔ GitHub), Repositório `scoobiii/vua` |
| **Sintoma Visual** | Modal de erro do sistema: *"Conflicts found in 1 file"* com botão *"Resolve conflicts ↗"* |

---

## 1. Resumo Executivo
Durante a sincronização automática bidirecional entre o workspace de desenvolvimento do Google AI Studio e o repositório remoto no GitHub (`scoobiii/vua`), o Git detectou uma divergência não linear em 1 arquivo modificado simultaneamente em ambas as origens. A sincronização automática foi pausada preventivamente pelo mecanismo de integridade para evitar sobrescrita acidental de código governado.

---

## 2. Causa Raiz Técnica (Root Cause Analysis)

### 2.1. O que gerou o conflito?
O conflito foi provocado por um **merge split** decorrente de alterações concorrentes na branch `main`:
1. **No Workspace Local (AI Studio):** Implementação das camadas de governança VUA:
   - Inclusão do `CanaryAdapter` e teste formal `scripts/test-canary.ts`.
   - Adição da validação estrita `validate_router_output` e desacoplamento de `execution_kind: 'llm' | 'capability'` em `src/vortex/`.
   - Regeneração de `tests/vua-capability-100.json` com o campo `available_tools`.
2. **No Repositório Remoto (GitHub):** Uma Pull Request ou commit direto foi mesclado na branch `main` (por exemplo, alterações em `README.md`, `package.json` ou `scripts/run-vua-100.py`), alterando linhas na mesma região do arquivo antes que o AI Studio fizesse o push de volta.
3. **Detecção:** O Git encontrou hashes de commit divergentes sem um ancestral comum imediato (`merge-base` defasado), gerando marcadores de conflito:
   ```text
   <<<<<<< HEAD (Versão Local do AI Studio com Governança e Canary)
   ...
   =======
   ... (Versão Remota vinda do PR no GitHub)
   >>>>>>> main (ou commit-hash do remoto)
   ```

### 2.2. Riscos de Resolução Incorreta
- Se o desenvolvedor selecionar cegamente *"Keep Remote / GitHub"* para um arquivo de governança ou script, os patches criptográficos e os testes de invariantes recém-validados (`PASS` 100%) seriam descartados.
- Se os marcadores `<<<<<<<` forem comitados diretamente, o parser TypeScript/Python falha no build (`compile_applet` e `npm test` falhariam).

---

## 3. Procedimento Operacional de Resolução Imediata (Passo a Passo no UI)

1. **Clique no botão no celular:** Toque em **`Resolve conflicts ↗`** na tela exibida no aplicativo.
2. **Identifique o arquivo listado na tela de resolução:**
   - **Caso seja `README.md` ou documentação textual:**
     - Se desejar as alterações feitas no GitHub: selecione **"Keep Incoming / Remote"**.
     - Se preferir as anotações do workspace: selecione **"Keep Current / Workspace"**.
   - **Caso seja arquivo de código (`src/vortex/*`, `package.json`, `scripts/*`, `tests/*`):**
     - Selecione obrigatoriamente **"Keep Current / Workspace"** (ou a versão do AI Studio). Isso preserva a conformidade de 100% dos testes da suíte e o adaptador Canary.
3. **Confirme:** Toque em **Confirm / Complete Merge**.
4. A sincronização será destravada e o commit unificado será enviado ao GitHub.

---

## 4. Medidas Preventivas e Automação (CI Workflow)

Para que conflitos não travem novos deploys silenciosamente e sejam detectados antes de chegarem à tela do usuário:
1. **Novo Workflow:** Criado `.github/workflows/sync-conflict-resolver.yml` para:
   - Verificar no CI a presença acidental de marcadores de conflito (`<<<<<<<`, `=======`, `>>>>>>>`).
   - Detectar desvios de sincronização entre a branch `main` e branches de feature/sync antes do merge.
   - Fornecer opção de resolução automática assistida (`ours` vs `theirs`) via `workflow_dispatch`.
   - Executar os testes de conformidade (`npm test`) como gate obrigatório pós-resolução.
2. **Script de Auditoria Local:** Disponibilizado `scripts/resolve-sync-conflicts.sh` para verificação e higienização direta via terminal.
