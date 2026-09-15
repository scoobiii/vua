# 📱 08. Como Conectar o VUA como Conector Personalizado no Claude App

Este guia prático ensina passo a passo como configurar o **VUA (Vortex Universal Connector)** como conector MCP (Model Context Protocol) diretamente no aplicativo móvel ou desktop do **Claude (Anthropic)**, utilizando as telas de configuração nativas do Claude.

---

## 1. Dados para Preenchimento

Na tela **"Adicionar conector personalizado"** do Claude:

| Campo na Tela do Claude | O que Preencher / Configurar |
| :--- | :--- |
| **Nome** | `VUA Protocol` *(ou `Vortex Universal Connector`)* |
| **URL do servidor MCP** | `https://ais-pre-apgga6bc4qb3ko4kofub3t-30357252941.us-west1.run.app/sse`<br>*(ou `/mcp`)* |
| **Requer início de sessão** | **DESATIVADO (Desligado / Cinza)** ⚪ |
| **ID de cliente OAuth** | *(Deixar vazio — não é necessário)* |
| **Segredo do cliente OAuth**| *(Deixar vazio — não é necessário)* |

> 💡 **Importante sobre a chave "Requer início de sessão"**:
> Conforme ilustrado nas suas capturas de tela:
> - **Desative o interruptor** (modo desligado / cinza, igual à imagem com o aviso vermelho da Anthropic).
> - O VUA implementa autenticação e governança criptográfica nativa (RFC 8785 JCS + Ed25519), portanto **não exige provedor OAuth externo** para descoberta de ferramentas.

---

## 2. Passo a Passo Ilustrado

### Passo 1: Acessar a Área de Conectores no Claude
1. Abra o aplicativo **Claude**.
2. Vá em **Configurações** (ou toque no ícone do perfil).
3. Selecione **Conectores** (ou *Connectors*).
4. No canto superior direito, toque no botão **`+`** para adicionar um conector personalizado.

### Passo 2: Preencher o Formulário
1. No campo **Nome**, digite: `VUA Protocol`.
2. No campo **URL do servidor MCP**, cole exatamente:
   ```text
   https://ais-pre-apgga6bc4qb3ko4kofub3t-30357252941.us-west1.run.app/sse
   ```
3. No botão seletor **Requer início de sessão**:
   - **Mantenha desligado**.
   - O aviso de segurança da Anthropic aparecerá informando para usar apenas conectores de desenvolvedores em quem você confia.
4. Toque no botão **Adicionar**.

---

## 3. Como o Claude se Comunica com o VUA

O servidor VUA suporta o protocolo MCP completo da Anthropic:
1. **Transporte SSE (Server-Sent Events)**: O Claude conecta na URL `/sse` ou `/mcp` e estabelece um canal de streaming bidirecional em tempo real.
2. **Descoberta de Ferramentas (`tools/list`)**: O Claude detecta automaticamente as 8 ferramentas governadas expostas pelo gateway.
3. **Execução Segura**: Toda vez que o Claude utiliza uma ferramenta (ex: inspecionar arquivos ou chamar um adaptador), o VUA executa o sandbox e emite a prova criptográfica `ExecutionProof v1`.

---

## 4. Ferramentas Disponíveis no Claude

Assim que o conector for salvo, o Claude terá acesso às seguintes ferramentas:

| Ferramenta MCP | Finalidade no Claude |
| :--- | :--- |
| `vortex.inspect` | Leitura e observação segura de repositórios, branches, arquivos e políticas. |
| `vortex.propose` | Geração determinística de propostas e patches (sem efeitos colaterais). |
| `vortex.verify` | Validação matemática de hashes SHA-256 e assinaturas Ed25519. |
| `vortex.execute` | Execução governada com limites de memória, tempo e isolamento de sandbox. |
| `vortex.branch.write` | Criação de commits e modificação de branches com token de aprovação. |
| `vortex.llm.invoke` | Chamada governada a modelos LLM (Gemini Cloud ou Ollama Local). |
| `vua.adapters.list` | Listagem dos adaptadores disponíveis (GitHub, Linux, Android, Windows). |
| `vua.adapter.invoke` | Invocação de comandos nos adaptadores de plataforma. |

---

## 5. Exemplos de Comandos para Pedir ao Claude no Chat

Com o conector ativado, você pode conversar naturalmente com o Claude no app:

- *"Claude, liste os adaptadores do VUA disponíveis usando o conector."*
- *"Use a ferramenta vortex.inspect para verificar a integridade da sandbox."*
- *"Inspecione o repositório no GitHub através do adaptador do VUA."*
- *"Verifique a assinatura da última execução realizada no VUA."*

---

## 6. Teste de Conexão Manual (Opcional)

Se desejar testar a URL antes de salvar no Claude, execute no seu terminal ou Termux:

```bash
# Testar descoberta do MCP Server
curl -s https://ais-pre-apgga6bc4qb3ko4kofub3t-30357252941.us-west1.run.app/mcp

# Testar stream SSE
curl -m 2 -H "Accept: text/event-stream" https://ais-pre-apgga6bc4qb3ko4kofub3t-30357252941.us-west1.run.app/sse
```
