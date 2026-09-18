# 🛡️ VUA — Vortex Universal Adapter & Governed Execution Protocol

<div align="center">

![Mascote VUA - O Pangolim de Governança](./public/vua-mascot.jpg)

### *O Pangolim da Governança e Execução Criptográfica*
*(Mascote oficial no clássico estilo gravura xilogravura O'Reilly)*

> *"Defendendo a verdade criptográfica, a neutralidade de sistemas operacionais e a integridade de execução delimitada sob as leis de GOS3 e RFC 8785."*

[![Node.js Conformance](https://img.shields.io/badge/VUA-100%25%20PASS-emerald?style=flat-square&logo=node.js)](./docs/01-visao-geral-e-instalacao.md)
[![RFC 8785 Canonical](https://img.shields.io/badge/RFC%208785-JCS%20Canonical-cyan?style=flat-square)](./docs/01-visao-geral-e-instalacao.md)
[![Ed25519 Signed](https://img.shields.io/badge/Identity-Ed25519%20Proof%20v1-indigo?style=flat-square)](./docs/01-visao-geral-e-instalacao.md)
[![Mobile & Terminal](https://img.shields.io/badge/Platform-Termux%20%7C%20Alpine%20%7C%20Android%20%7C%20Linux%20%7C%20Windows-amber?style=flat-square)](./docs/04-termux-e-alpine-proot.md)
[![Golden Rule Gate](https://img.shields.io/badge/Merge%20Gate-CI%20100%25%20PASS%20%E2%86%92%20mergeability%20OK%20%E2%86%92%20merge-violet?style=flat-square)](./docs/05-adapters-local-vs-github-remoto.md)

</div>

---

> **Tese Normativa de Segurança:**  
> *"Proof of execution is not proof of safety."*  
> $$\text{Safety} = \text{Authorization} + \text{Bounded Execution} + \text{Accountability} + \text{Independent Verification} + \text{Identity}$$

O **VUA (Vortex Universal Adapter)** é a especificação e motor de referência para governança, conectores universais multiplataforma e execução criptográfica para agentes de Inteligência Artificial sobre o **Model Context Protocol (MCP)** e Git VCS. Ele assegura que agentes autônomos, ferramentas de build e modelos LLM operem sob limites matematicamente verificáveis, com provas de execução assinadas em **Ed25519**, canonicalização determinística **RFC 8785 (JCS)** e governança de recursos **GOS3**.

---

## 🦔 Conheça o Mascote VUA: O Pangolim de Governança

No espírito das clássicas publicações técnicas **O'Reilly**, o **Pangolim** foi escolhido como mascote do VUA por suas características biológicas e arquiteturais:

- 🛡️ **Escamas de Queratina Entrelaçadas**: Representam as camadas concêntricas de proteção do VUA (Isolamento de Sandbox, Validação de Políticas, Canonicalização RFC 8785 e Assinatura Ed25519).
- 🔒 **Postura Defensiva Inviolável**: Quando sob ameaça (como ataques adversariais de *FORGE*, *REPLAY*, *ESCALATE*, *ESCAPE* ou *TAMPER*), o pangolim enrola-se numa esfera impenetrável — assim como o VUA barra instantaneamente execuções não-autorizadas emitindo provas de auditoria com `executed: false`.
- 🌾 **Frugalidade e Eficiência Extrema**: O pangolim prospera nos ambientes mais hostis e com poucos recursos — refletindo a capacidade do VUA de rodar com latência de microssegundos (<370µs) até em smartphones com **Termux**, contêineres **Alpine PRoot** e dispositivos sem GPU dedicada.

---

## 🚀 Novos Recursos: GitHub Seguro, Escrita de PR e Merge no Git

O VUA disponibiliza uma interface amigável e com segurança reforçada para conexão a repositórios do GitHub, seleção de projetos e ciclos completos de entrega contínua:

### 1. Autenticação Amigável e Segura (Zero-Leakage)
- **Token em Memória Volátil**: O Personal Access Token (PAT) é mantido estritamente na memória da sessão (`sessionGitHubToken`) e **nunca é persistido em arquivos de log, localStorage ou disco**.
- **Modo Sandbox Demo**: Permite testar o fluxo com 5 projetos simulados de alta fidelidade sem necessidade de fornecer token real.
- **Alternância de Visibilidade**: Campo de token protegido com botão para exibir/ocultar credenciais.

### 2. Seleção de Projetos e Repositórios
- Exploração visual de repositórios públicos, privados e governados.
- Filtro em tempo real por proprietário (Owner), organização ou termos de busca.
- Seleção de branch ativa com exibição de commit SHA, status de proteção de branch e identidade Ed25519 ativa.

### 3. Capacidade de Gerar PR Escrita e Merge no Git
O VUA implementa o fluxo completo de modificação e governança de código:
- **Escrever e Criar PR (`create_pr_written`)**: Cria uma Pull Request com título, corpo estruturado em Markdown, checklist de conformidade GOS3 e digest de patch canônico RFC 8785.
- **Gravar Commit em Branch (`write_branch_commit`)**: Escreve arquivos diretamente numa branch Git com mensagem de commit descritiva, cálculo de digest SHA-256 e atestação de autoria por assinatura Ed25519.
- **Executar Merge Governado (`merge_pr`)**: Realiza o merge seguro de Pull Requests (Squash, Merge ou Rebase) sob a estrita **Regra de Ouro da Governança**:
  $$\text{CI 100\% PASS} \longrightarrow \text{mergeability OK} \longrightarrow \text{merge}$$
  Se houver qualquer portão de qualidade ou workflow de CI pendente sem prova criptográfica, o merge é bloqueado e a tentativa é registrada para auditoria.

---

## 📚 Guias Passo a Passo na Pasta `docs/`

Documentação completa e estruturada disponível no repositório:

- 📖 [**docs/README.md**](./docs/README.md) — Índice mestre e arquitetura geral.
- 🧪 [**docs/TESTING.md**](./docs/TESTING.md) — **Novo**: Guia mestre da suíte de testes (100% cobertura), K6 Load/Stress/Chaos/Spike/Soak e CI/CD.
- 🛡️ [**docs/MANUAL-DE-SEGURANCA.md**](./docs/MANUAL-DE-SEGURANCA.md) — **Novo**: Manual oficial de segurança, gestão de PAT volátil, anti-replay e criptografia Ed25519.
- 🌐 [**docs/VUA-PRODUTOS-SERVICOS-POR-INDUSTRIA.md**](./docs/VUA-PRODUTOS-SERVICOS-POR-INDUSTRIA.md) — **Novo**: Catálogo de produtos, dores resolvidas por LLM, Web3 e monetização.
- 📦 [**docs/01-visao-geral-e-instalacao.md**](./docs/01-visao-geral-e-instalacao.md) — Instalação, CLI `vua`, biblioteca npm e diagnósticos.
- 📱 [**docs/02-mobile-apk-sem-github.md**](./docs/02-mobile-apk-sem-github.md) — **Passo 2**: APK Android (`com.vortex.foundation.vua`), isolamento SELinux/Scoped Storage, funcionamento mobile offline sem conector GitHub.
- 🤖 [**docs/03-llm-browser-e-qwen-gemini.md**](./docs/03-llm-browser-e-qwen-gemini.md) — **Passo 3**: LLM no navegador (WebGPU/Wasm), Qwen 2.5 Coder 0.5B local/offline e Google Gemini com API Key protegida.
- ⚡ [**docs/04-termux-e-alpine-proot.md**](./docs/04-termux-e-alpine-proot.md) — Execução em Termux, Alpine Linux (PRoot), benchmarks de latência (<370µs) e throughput (2.700+ ops/seg).
- 🔌 [**docs/05-adapters-local-vs-github-remoto.md**](./docs/05-adapters-local-vs-github-remoto.md) — Comparativo GitHub App Remota vs. Adaptadores locais (Linux, Android, Windows, MCP para Cursor/Claude/VSCode).
- 🛡️ [**docs/governance/BASELINE-TOLERANCE-REPORT.md**](./docs/governance/BASELINE-TOLERANCE-REPORT.md) — Baseline dinâmica por fingerprint de hardware, separação entre indução e autorização, e conformidade de 14 gates (100% PASS).

---

## 💻 Instalação Multiplataforma (NPM, CLI, Binário/EXE e Navegador)

### 1. Via NPM Direto no CLI (Global ou NPX)
O VUA pode ser executado instantaneamente sem necessidade de clonar o repositório:

```bash
# Execução direta e efêmera via npx:
npx @vortexfoundation/vua status
npx @vortexfoundation/vua baseline

# Instalação global do comando 'vua':
npm install -g @vortexfoundation/vua
vua status
vua adapters
```

### 2. Instalação e Uso no Windows (PowerShell / CMD / WSL2)
```powershell
# No PowerShell ou CMD com Node.js instalado:
npm install -g @vortexfoundation/vua
vua status

# Iniciar servidor MCP local no Windows:
vua mcp --port 3000
```

#### Como Executável Nativo Windows (.exe) ou Serviço em Segundo Plano:
Para ambientes Windows corporativos sem Node.js instalado, compile ou empacote via `pkg`:
```bash
# Compilar binário Windows autocontido:
npx @yao-pkg/pkg dist/server.cjs --targets node22-win-x64 --output vua-service.exe

# Executar o binário nativo no Windows:
.\vua-service.exe
```
Para conectar aplicativos do Windows (PowerShell, scripts C#, agentes locais), comunique-se via HTTP/SSE em `http://localhost:3000/mcp` ou configure como Serviço do Windows usando `sc.exe create VuaService binPath= "C:\vua\vua-service.exe"`.

### 3. Instalação no Linux e macOS
```bash
# Linux (Ubuntu, Debian, Fedora, Alpine):
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
npm install -g @vortexfoundation/vua
vua baseline

# macOS (via Terminal ou Homebrew):
brew install node
npm install -g @vortexfoundation/vua
vua status
```

### 4. Instalação a Partir do Navegador (PWA / Web App Autônomo)
O VUA é um Progressive Web App (PWA) de arquitetura moderna:
1. Abra a aplicação em qualquer navegador moderno (Chrome, Edge, Safari, Firefox).
2. Na barra de endereços, clique no ícone **"Instalar aplicativo"** (ou no menu do navegador $\to$ *"Instalar VUA Governança"*).
3. No Android/Chrome: toque em *"Adicionar à tela inicial"*. O app roda em janela autônoma isolada com suporte a Web Workers, armazenamento volátil e conexão com endpoints MCP locais (`localhost:3000`).

---

## 🤖 Como Cada App LLM e Agente Configura e Usa o VUA

O VUA disponibiliza um servidor **Model Context Protocol (MCP)** nos endpoints `http://localhost:3000/mcp` (HTTP POST) e `http://localhost:3000/sse` (Server-Sent Events).

### 1. Claude Desktop (Anthropic)
Edite seu arquivo de configuração `claude_desktop_config.json`:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vua-governance": {
      "command": "npx",
      "args": ["-y", "@vortexfoundation/vua", "mcp"]
    }
  }
}
```
*Após reiniciar o Claude Desktop, as 5 ferramentas (`vortex.inspect`, `vortex.propose`, `vortex.verify`, `vortex.execute`, `vortex.branch.write`) estarão ativas.*

### 2. Cursor IDE
No Cursor, acesse **Cursor Settings $\to$ Features $\to$ MCP Servers $\to$ Add New MCP Server**:
- **Name**: `vua-governance`
- **Type**: `command`
- **Command**: `npx -y @vortexfoundation/vua mcp`

*(Ou configure como SSE com URL `http://localhost:3000/sse` se o servidor estiver rodando localmente).*

### 3. VSCode (Extensões Cline, Roo Code ou Continue.dev)
No arquivo `cline_mcp_settings.json` ou similar:
```json
{
  "mcpServers": {
    "vua": {
      "command": "node",
      "args": ["/caminho/para/vua/bin/mcp-server.js"]
    }
  }
}
```

### 4. Ollama & Qwen 2.5 Coder (100% Offline & Local)
Para usar modelos open source locais através da governança do VUA:
```bash
# Baixar o modelo no Ollama:
ollama pull qwen2.5-coder:0.5b

# Executar inferência governada com prova Ed25519:
vua llm --provider ollama --model qwen2.5-coder:0.5b --prompt "Crie uma função de validação de CPF"
```

### 5. Google Gemini API
Com sua `GEMINI_API_KEY` configurada no ambiente:
```bash
export GEMINI_API_KEY="sua_chave_aqui"
vua llm --provider gemini --model gemini-3.8-flash --prompt "Explique as leis do VUA"
```

### 6. Agentes Python (LangChain, LlamaIndex, AutoGen)
Conecte qualquer agente Python consumindo a API REST padronizada do VUA:
```python
import requests

# Invocando inspeção governada
response = requests.post("http://localhost:3000/api/vortex/pipeline", json={
    "request_id": "req-py-001",
    "operation": "inspect",
    "target": {"path": "/workspace/vortex/README.md"}
})

data = response.json()
print("Status:", data["status"])
print("Ed25519 Signature:", data["execution_proof"]["signature"])
```

---

## ⚡ Bootstrap Dinâmico: Auto-Configuração de Baseline por Gadget/Dispositivo

O VUA implementa a detecção de hardware em tempo real para auto-configurar a baseline de governança sem intervenção humana:

```bash
# Executar a auto-configuração de baseline:
vua baseline
```

### Arquétipos Suportados e Ajustes Automáticos:
1. **`MOBILE_TERMUX` (Smartphones Android / Termux)**:
   - SLA Ed25519: $\le 3.5\text{ ms}$ (Tolerância a jitter: $\pm 35\%$).
   - Concorrência Máxima: 1 thread.
   - Modelo Local Recomendado: `qwen2.5-coder:0.5b` (Q4_K_M).
   - Teto Sandbox RAM: 256 MB.

2. **`EMBEDDED_EDGE` (Raspberry Pi, SBCs ARM64)**:
   - SLA Ed25519: $\le 2.0\text{ ms}$ (Tolerância: $\pm 25\%$).
   - Concorrência Máxima: 2 threads.
   - Modelo Local Recomendado: `qwen2.5-coder:1.5b` (Q4_K_M).
   - Teto Sandbox RAM: 512 MB.

3. **`DESKTOP_DEV` (Laptops e Workstations x64/M1/M2/M3)**:
   - SLA Ed25519: $\le 0.8\text{ ms}$ (Tolerância: $\pm 10\%$).
   - Concorrência Máxima: 4 threads.
   - Modelo Local Recomendado: `qwen2.5-coder:7b` (Q4_K_M).
   - Teto Sandbox RAM: 1024 MB.

4. **`HIGH_PERF_CLOUD` (Instâncias Cloud / Servidores Corporativos)**:
   - SLA Ed25519: $\le 0.5\text{ ms}$ (Tolerância: $\pm 5\%$).
   - Concorrência Máxima: 4 a 16 threads.
   - Modelo Local Recomendado: `qwen2.5-coder:14b` (fp16).
   - Teto Sandbox RAM: 2048 MB.

---

---

## 💻 Primeiros Passos no Terminal / Alpine / Termux

Ao clonar o projeto ou entrar na pasta `vua`:

```bash
# 1. Instalar dependências
npm install

# 2. Compilar aplicação
npm run build

# 3. Executar o CLI VUA
node bin/vua.js status

# 4. Rodar benchmark de desempenho e latência criptográfica
node bin/vua.js bench --iterations 500

# 5. Listar todos os adaptadores registrados (GitHub, Linux, Android, Windows)
node bin/vua.js adapters

# 6. Invocar ação normatizada em adaptador
node bin/vua.js invoke github inspect_repo
node bin/vua.js invoke android check_selinux
node bin/vua.js invoke linux check_sandbox

# 7. Executar LLM com governança (Ollama local ou Gemini)
node bin/vua.js llm --provider ollama --model qwen2.5-coder:0.5b --prompt "console.log('VUA')"
node bin/vua.js llm --provider gemini --model gemini-3.8-flash --prompt "Explique VUA em uma frase"

# 8. Rodar suíte de conformidade de adaptadores (100% PASS)
node bin/vua.js conformance

# 9. Iniciar servidor de desenvolvimento com a interface visual completa
npm run dev
```

---

## 🏛️ As 4 Camadas de Adaptadores Universais VUA

| Adaptador | Ambiente | Capacidades Principais |
| :--- | :--- | :--- |
| **GitHub Universal Adapter** | Nuvem VCS | Inspeção de repo, verificação de commit, propostas de PR escritas, gravação de branch commits e merge governado. |
| **Linux POSIX Adapter** | Alpine / Debian / RHEL | Namespaces de processos (`cgroups v2`), isolamento `chroot`/`unshare`, verificação de limites de memória e tempo. |
| **Android AOSP Adapter** | Termux / Mobile APK | Auditoria de SELinux (`Enforcing`), Scoped Storage, permissões de IPC e isolamento por UID de aplicativo. |
| **Windows NT Adapter** | Windows / Server | Integridade de tokens de segurança Win32, AppContainer sandboxing e NTFS DACLs/SACLs. |

---

## 📑 Manual do Usuário & Consumidor MCP

Todo agente de IA conectado ao endpoint `POST /mcp` pode interagir através das 5 ferramentas normativas:

| Ferramenta MCP | Efeito Colateral | Descrição |
| :--- | :--- | :--- |
| `vortex.inspect` | `false` | Inspeção observacional segura com emissão de prova. |
| `vortex.propose` | `false` | Geração de propostas de código, patches e PRs com hash canônico RFC 8785. |
| `vortex.verify` | `false` | Verificação independente de assinaturas Ed25519 e digests SHA-256. |
| `vortex.execute` | `true` | Execução delimitada em sandbox sob contrato GOS3 ativo. |
| `vortex.branch.write` | `true` | Escrita persistente e merge em branches com aprovação explícita. |

### Exemplo de Chamada MCP (JSON-RPC 2.0)

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": "req-001",
    "method": "tools/call",
    "params": {
      "name": "vortex.inspect",
      "arguments": {
        "request_id": "req-inspect-101",
        "target": { "repository": "vortex-foundation/vua-connector", "path": "src/governance.json" },
        "input": { "verbose": true }
      }
    }
  }'
```

---

## 🛡️ Matriz de Conformidade Adversarial (5/5 PASS)

A suíte adversarial testa ativamente as 5 violações de segurança fundamentais:

| Cenário | Ataque Simulado | Status Esperado | Ação Defensiva do VUA |
| :--- | :--- | :--- | :--- |
| **FORGE** | Modificação de `output_hash` ou flag `executed` na prova. | `SIGNATURE_INVALID` | Rejeição imediata pela chave pública Ed25519. |
| **REPLAY** | Reenvio do mesmo `request_id` com payload idêntico. | `REPLAY_REJECTED` | O cache de anti-replay bloqueia a reexecução. |
| **ESCALATE** | Tentativa de escrita ou merge sem autorização da política. | `POLICY_DENIED` | Prova é emitida com `executed = false`. |
| **ESCAPE** | Ataque de path traversal (`../../etc/passwd`) ou prefixo irmão. | `SANDBOX_DENIED` | A sandbox isola o caminho antes de invocar o conector. |
| **TAMPER** | Adulteração do artefato físico após a execução ser concluída. | `HASH_MISMATCH` | O verificador detecta a discrepância no hash SHA-256. |

---

## 📈 Linha de Evolução: Do 1º Sprint ao Estado Atual e Rumo à Produção

```
┌─────────────────────────┐     ┌─────────────────────────┐     ┌─────────────────────────┐
│       1º SPRINT         │     │      ONDE ESTAMOS       │     │     RUMO À PRODUÇÃO     │
│   (Fundação & Núcleo)   │ ──► │ (Governança & Integração│ ──► │  (Endurecimento & GAIS) │
│                         │     │    Multi-Ambiente)      │     │                         │
│   [Concluído: 100%]     │     │      [ESTADO ATUAL]     │     │      [ROADMAP FINAL]    │
└─────────────────────────┘     └─────────────────────────┘     └─────────────────────────┘
```

| Fase | Marco / Dimensão | Entregas & Capacidades Chave | Status |
| :--- | :--- | :--- | :--- |
| **1º SPRINT**<br>*(Fundação & Provas)* | **Canonicalização & Criptografia** | • Canonicalização determinística **RFC 8785 (JCS)**.<br>• Assinatura e verificação Ed25519 (`vortex-execution-evidence/v1`).<br>• Motor antifraude com 5 testes adversariais (FORGE, REPLAY, ESCALATE, ESCAPE, TAMPER).<br>• Contrato de isolamento e governança de recursos GOS3. | ✅ Concluído (100% PASS) |
| | **Adaptadores Fundamentais** | • Adaptadores locais Linux POSIX (`cgroups`, `chroot`) e Android AOSP (`SELinux`, `Scoped Storage`).<br>• CLI `bin/vua.js` para inspeção, benchmark e invocação local.<br>• Suíte básica de execução canária. | ✅ Concluído |
| **ONDE ESTAMOS**<br>*(Estado Atual)* | **MCP & Registro Multi-LLM** | • Servidor **Model Context Protocol (MCP)** em `bin/mcp-server.js` com ferramentas canônicas (`vortex.*`).<br>• Catálogo federado `vua-llms.json` e script de resolução (`npm run vua:llms`) para Gemini, OpenAI e Ollama offline.<br>• Documentação arquitetural formal em `docs/RUNTIME.md` e `docs/GAIS.md`. | 🟢 Ativo & Operacional |
| | **GitHub Seguro & Ciclo Git** | • Sincronização e binding com repositório remoto (`scoobiii/vua`).<br>• Token de sessão volátil (zero persistência em disco/logs).<br>• Operações governadas de escrita de PR (`create_pr_written`), commit em branch (`write_branch_commit`) e merge seguro (`merge_pr`).<br>• Equivalência determinística (`vua:prove`) e comparação de baselines (`tao:compare`).<br>• 15 Quality Gates automáticos no CI (`npm test` com 100% de aprovação). | 🟢 Ativo & Operacional |
| **RUMO À PRODUÇÃO**<br>*(Próximos Passos)* | **Endurecimento & Ativação GAIS** | • Ativação em produção do **GAIS (Governance AI System)** via MCP.<br>• Rotação e custódia segura de chaves Ed25519 corporativas (KMS/HSM).<br>• Monitoramento de deriva semântica de modelos (evaluators contínuos).<br>• Empacotamento de distribuição final: binário autônomo e contêiner Alpine de produção minimalista com auditoria estrita. | 🟡 Planejado |

---

## 🧪 Comandos da Suíte de Testes & Carga K6

O repositório possui cobertura integral (100% de aprovação) em testes unitários, integração, segurança, benchmark, estresse, caos e k6:

```bash
# 1. Pipeline de CI Completo (Lint + Unitários + Integração + Segurança + Stress + Caos + Bench)
npm run test:ci

# 2. Suíte de Carga & Estresse K6 Oficial (./bin/k6)
npm run test:k6          # Executa todos os cenários principais k6
npm run test:k6:smoke    # Sanidade e auditoria de prova
npm run test:k6:load     # Carga gradual até 40 VUs (p95 < 120ms)
npm run test:k6:stress   # Estresse até 60 VUs
npm run test:k6:spike    # Rajada instantânea de 120 VUs
npm run test:k6:soak     # Resistência e verificação de memory leak
npm run test:k6:chaos    # Injeção adversarial de adulteração e replay

# 3. Testes Especializados do Runtime
npm run test:unit        # 13 testes unitários matemáticos e normativos
npm run test:integration # 7 testes de integração ponta a ponta
npm run test:security    # Auditoria de Zero-Leakage de PAT e escopos
npm run test:bench       # Benchmark de latência (<370µs) e throughput
npm run test:chaos       # Testes adversariais de bit-flips e corrupção
```

Consulte [**docs/TESTING.md**](./docs/TESTING.md) para detalhes técnicos de cada cenário e thresholds.

---

## 📜 Licença & Governança

Especificação aberta e código sob licença MIT. Desenvolvido pela **Vortex Open Protocol Foundation** para assegurar segurança, transparência e reprodutibilidade matemática em sistemas com agentes autônomos.
