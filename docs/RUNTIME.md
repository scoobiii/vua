# VUA Runtime Architecture Specification

## 1. Contexto & Filosofia Arquitetural

O **VUA (Vortex Universal Adapter)** é a camada intermediária de isolamento, prova criptográfica e conformidade de execução para sistemas de software autônomos e assistidos.

Ele opera sob a diretriz cardeal do **Vortex Agent Governance Contract (`AGENTS.md`)**:
> **"Agent output is untrusted input."** (Toda saída de agente é tratada como entrada não-confiável).

---

## 2. Relação Tríplice: Registry (`vua-llms.json`) ↔ MCP Adapter (`bin/mcp-server.js`) ↔ LLM Providers

A espinha dorsal do runtime do VUA é a relação tripartite desacoplada:

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Registry Loader                        │
                  │                (`vua-llms.json`)                       │
                  │   - Provider IDs (gemini, openai, local-ollama)        │
                  │   - Capabilities (text, code, multimodal, offline)     │
                  │   - Endpoints, Auth Schemes & Context Windows          │
                  └───────────────────────────┬────────────────────────────┘
                                              │ Single Source of Truth
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │           VUA MCP Adapter Server Engine                │
                  │                (`bin/mcp-server.js`)                   │
                  │   - JSON-RPC 2.0 via stdio                             │
                  │   - Mapeamento dinâmico de ferramentas:                │
                  │       * llm.query     * llm.validate                   │
                  │       * llm.execute   * llm.summarize                  │
                  │   - Assinatura Criptográfica Ed25519 & RFC 8785        │
                  └───────────┬──────────────────┬─────────────────────────┘
                              │                  │
               Cloud Gateway  │                  │  Local Subprocess / Shell
                              ▼                  ▼
              ┌────────────────────────┐        ┌──────────────────────────┐
              │  Cloud LLM Providers   │        │   Local LLM Provider     │
              │  - Google Gemini 3.8   │        │   - Ollama Qwen 2.5      │
              │  - OpenAI GPT-4o       │        │     (Termux / Offline)   │
              └────────────────────────┘        └──────────────────────────┘
```

### Papéis na Arquitetura:
1. **Registry (`vua-llms.json`)**:
   - Atua como a **Única Fonte da Verdade (SSOT)**.
   - Declara explicitamente a tipagem de provedor (`cloud_api` vs `local_shell`), esquema de autenticação (`api_key`, `bearer_token`, `none`), janelas de contexto e capacidades suportadas.
2. **MCP Adapter (`bin/mcp-server.js`)**:
   - É o **mediador determinístico**.
   - Lê o registro via `loadRegistry()` e resolve qualquer requisição de ferramenta (`llm.query`, `llm.execute`, etc.) para as credenciais e parâmetros corretos.
   - Aplica a canonicalização RFC 8785 (JCS) antes de enviar qualquer payload ou calcular hashes.
   - Emite e valida a **Execution Proof** contendo o ID da prova, hash canônico, tempo de execução e atestação.
3. **Provedores LLM Conectados**:
   - **Google Gemini**: Provedor padrão com suporte multimodal e geração de código de alta velocidade (`gemini-3.8-flash`).
   - **OpenAI**: Provedor secundário para cross-evaluation e oráculo semântico (`gpt-4o`).
   - **Local Ollama**: Provedor estritamente offline para execução sem dependência de nuvem, adequado para nós locais e dispositivos móveis (`qwen2.5-coder:0.5b`).

---

## 3. Estados de Efeito Externo (`ExternalEffect`)

O runtime categoriza qualquer ação em quatro estados mutuamente exclusivos:

| Estado | Descrição | Comportamento Fail-Closed |
| :--- | :--- | :--- |
| `none` | Nenhuma mutação tentada ou autorizada | Acionado automaticamente quando tokens estão ausentes ou expirados. |
| `local_only` | Transformação em sandbox ou runner efêmero | Sem alteração no disco permanente ou em APIs externas. |
| `remote_confirmed` | Mutação validada e confirmada pela API remota | Exige prova de atestação remota e aprovação criptográfica válida. |
| `remote_failed` | Tentativa rejeitada pelo provedor externo | Falha no provedor remoto registrada sem estado ambíguo. |

---

## 4. Pipeline de Execução do Runtime

1. **Classificação de Intenção (`Intent Classification`)**:
   - Analisa se a ação é somente leitura, preparatória local ou mutação remota.
2. **Avaliação de Políticas (`Policy Sandbox Engine`)**:
   - Rejeita escopos curinga (`wildcard` como `*/*` ou `owner/*`).
   - Verifica integridade do payload e tokens de aprovação GOS3.
3. **Serialização Canônica RFC 8785 (JCS)**:
   - Todo payload, diff e metadado passa por canonicalização RFC 8785 determinística antes de qualquer hash ou assinatura.
4. **Execução Governação & Prova**:
   - Assinatura criptográfica Ed25519 anexada à evidência de execução (`vortex-execution-evidence/v1`).
5. **Verificação Independente**:
   - Oráculo e verificador desacoplado auditam a prova antes de marcar qualquer gate como `PASS`.

---

## 5. Ferramentas do Runtime Suite (TAO-1)

- **`vua:llms` (`scripts/vua-llm-resolve.ts`)**: Resolução estruturada e tipada dos provedores de LLM definidos em `vua-llms.json`.
- **`vua:prove` (`scripts/vua-prove-equivalent.ts`)**: Prova diferencial RFC 8785 determinística comprovando equivalência estrita antes/depois de refatorações.
- **`tao:compare` (`scripts/tao-compare.ts`)**: Comparador estrito de regressão entre baseline congelada e candidatos (RPS, latência p95/p99, taxa de erro).
- **`mcp` (`bin/mcp-server.js`)**: Servidor MCP stdio para consumo por agentes com ferramentas `llm.*` e `vortex.*`.
