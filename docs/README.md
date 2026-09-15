# ⚡ Documentação Oficial do VUA (Vortex Universal Connector)

Bem-vindo à documentação técnica do **VUA (Vortex Universal Connector)** — motor universal de governança, conformidade criptográfica (Ed25519 + RFC 8785) e gateway para agentes, LLMs e sistemas operacionais.

---

## 📚 Índice dos Guias Práticos

| Guia | Descrição | Tópicos Cobertos |
| :--- | :--- | :--- |
| [**01. Visão Geral e CLI**](./01-visao-geral-e-instalacao.md) | Instalação, CLI `vua`, biblioteca npm e diagnósticos | Instalação local, comandos do CLI, biblioteca npm TypeScript, verificação de integridade |
| [**02. Mobile APK Sem GitHub (Passo 2)**](./02-mobile-apk-sem-github.md) | App Android APK autônomo e isolado | Package `com.vortex.foundation.vua`, Capacitor, Termux nativo, isolamento SELinux, Scoped Storage, zero chamadas ao GitHub |
| [**03. LLM no Browser, Qwen Coder e Gemini (Passo 3)**](./03-llm-browser-e-qwen-gemini.md) | Modelos locais offline e nuvem segura | Qwen 2.5 Coder 0.5B (Ollama / WebGPU / Llama.cpp), Gemini API Key segura no backend, prova Ed25519 |
| [**04. Termux, Alpine PRoot e Benchmark**](./04-termux-e-alpine-proot.md) | Execução em ambientes ultra-leves e testes | Setup no Termux (Android), Alpine Linux (PRoot/Docker), benchmark local (throughput, latência, RAM) |
| [**05. GitHub App Remota vs Adaptadores Locais**](./05-adapters-local-vs-github-remoto.md) | Integração remota e adaptadores para apps locais | GitHub App Remota (.pem, JWT, tokens), Linux/Android/Windows adapters, MCP Server (Cursor, Claude, VSCode), SDK local |
| [**06. Agent Patch Arena CI Gate**](./06-agent-patch-arena-ci.md) | Arena Darwiniana e governança de patches | Pipeline de benchmark estatístico, critérios PASS_SUPERIOR (CV <= 10%, Delta >= +5%), isolamento pull_request_target |
| [**07. Conectores e Adaptadores Disponíveis**](./07-conectores-e-adaptadores.md) | Catálogo técnico de Conectores e Adaptadores | Conectores de infraestrutura (filesystem, runtime, MCP, LLM) e adaptadores de SO (github, linux, android, windows, canary) |
| [**08. Conectar ao Claude App**](./08-conectar-ao-claude-app.md) | Guia passo a passo para o Claude (Mobile/Desktop) | Configuração do conector personalizado, preenchimento de campos e uso das ferramentas |
| [**09. Governança: Baseline Dinâmica e Tolerância**](./governance/BASELINE-TOLERANCE-REPORT.md) | Baseline por fingerprint de hardware e tolerância | Eliminação de ruído estatístico em ARM64/Termux, separação entre indução e autorização em runtime, 14 gates 100% verdes |

---

## 🎯 Resumo Rápido de Comandos

```bash
# Diagnóstico do sistema (CPU, RAM, ambiente)
npm run vua status

# Lista de adaptadores locais e remotos
npm run vua adapters

# Testar ação no Android local (SELinux)
npm run vua invoke android check_selinux

# Benchmark de latência e assinatura Ed25519
npm run bench

# Testar LLM offline com Qwen 2.5 Coder 0.5B
npm run vua llm -- --provider ollama --model qwen2.5-coder:0.5b --prompt "console.log('hello')"

# Iniciar servidor MCP local para Cursor / Claude Desktop / VSCode
npm run vua mcp
```
