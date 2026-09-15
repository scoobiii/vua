# GAIS (Governance AI System) Integration Manual

## 1. Visão Geral da Integração

O **GAIS (Governance AI System / Google AI Studio)** opera sobre o repositório sob a supervisão do protocolo VUA. Esta arquitetura assegura que agentes de inteligência artificial operem com restrições invioláveis de segurança, determinismo e auditoria de estado.

---

## 2. Injeção de Políticas (`AGENTS.md`)

O arquivo `/AGENTS.md` na raiz do repositório é automaticamente injetado no contexto do agente. Ele estabelece as regras primárias de conduta:

- **Proibição de Afirmações Não Verificadas**:
  O agente é terminantemente proibido de alegar que realizou `git push`, abriu Pull Request ou executou testes sem a evidência literal de saída do ambiente.
- **Fail-Closed Mandatório**:
  Se qualquer credencial (`GITHUB_TOKEN`, chaves de API) estiver ausente ou inválida, o sistema deve abortar imediatamente reportando:
  - `success`: `false`
  - `external_effect`: `"none"`
  - `error_code`: `CREDENTIAL_MISSING` (ou `CREDENTIAL_INVALID`)
- **Proibição de Síntese**:
  É estritamente proibido sintetizar URLs de Pull Request, números de issue, valores arbitrários de RPS ou identidades de hardware físico.

---

## 3. Arquitetura de Conexão: Registry ↔ MCP Adapter ↔ LLM Providers

A integração entre o GAIS e os provedores de inferência é mediada exclusivamente através do **VUA MCP Adapter (`bin/mcp-server.js`)**, orientado pelas declarações do **Registry (`vua-llms.json`)**:

```
                       Google AI Studio Agent
                                  │
                  ┌───────────────┴───────────────┐
                  ▼                               ▼
       Direct Workspace Inspection         MCP Tool Calling (stdio)
          (Files, git, build)                     │
                                                  ▼
                                      ┌───────────────────────┐
                                      │   bin/mcp-server.js   │
                                      └───────────┬───────────┘
                                                  │ Reads
                                                  ▼
                                      ┌───────────────────────┐
                                      │     vua-llms.json     │
                                      │   (Registry SSOT)     │
                                      └───────────┬───────────┘
                                                  │ Routes To
                     ┌────────────────────────────┼────────────────────────────┐
                     ▼                            ▼                            ▼
          ┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
          │     gemini-flash    │      │       gpt-4o        │      │   local-ollama      │
          │ (Google Gen AI SDK) │      │  (OpenAI REST API)  │      │ (Local Subprocess)  │
          └─────────────────────┘      └─────────────────────┘      └─────────────────────┘
```

### Detalhes do Fluxo:
1. **Descoberta Dinâmica**:
   O MCP Server inicializa lendo `vua-llms.json`. O agente descobre dinamicamente os provedores suportados e suas capacidades através da ferramenta `llm.query` ou consultando o registro.
2. **Desacoplamento de Segredos**:
   O agente não lida diretamente com URLs ou segredos de API na camada de visualização. O MCP Server consulta a variável de ambiente referenciada em `env_key` (`GEMINI_API_KEY`, `OPENAI_API_KEY`), garantindo conformidade com a política de chaves em camadas seguras.
3. **Mapeamento de Ferramentas Primárias**:
   - `llm.query`: Conecta aos provedores do registro, aplica a temperatura padrão configurada e retorna o texto com a prova de execução assinada.
   - `llm.validate`: Permite ao GAIS auditar qualquer payload com a especificação RFC 8785 (JCS), prevenindo inconsistências de formatação.
   - `llm.execute`: Encaminha solicitações de código estritamente ao modelo adequado com prompt de sistema voltado à determinação e sem prosa.
   - `llm.summarize`: Reduz artefatos grandes ou relatórios de teste a resumos técnicos para o agente sem poluir a janela de contexto.

---

## 4. Invariantes de Verificação Antes de Afirmações

Sob o protocolo VUA no GAIS, nenhuma afirmação de existência de arquivo ou passagem de testes pode ser feita sem execução de ferramenta prévia:

```bash
# Verificação de existência real no disco
ls -la <path>

# Verificação de conformidade de testes e exit code
npm test > /tmp/t.log 2>&1; echo "exit=$?"; tail -30 /tmp/t.log
```
