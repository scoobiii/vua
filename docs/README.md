# VUA — Documentação Oficial

**Vortex Universal Adapter / Governed Execution Runtime**

## Status atual — 2026-09-17

VUA já é um **produto de software executável**: possui core de governança, CLI `vua`, biblioteca TypeScript/Node.js, adaptadores, MCP e verificação criptográfica de `ExecutionProof`.

O pacote está configurado para npm como `@vortexfoundation/vua` e expõe o comando `vua` pelo campo `bin`. Isso comprova a configuração do pacote; publicação no registry é um gate separado.

A integração Linux atual é **nativa em nível de userspace/CLI**: o runtime executa diretamente em Linux e possui adaptador Linux. Ainda não é um binário ELF independente nem uma distribuição `.deb/.rpm/.apk`.

### Evidência MCP auditada em 2026-09-17

- `tools/list`: 314,5 req/s; p50 2,74 ms; erro 0%
- `vortex.inspect`: 47,2 req/s; p50 21,77 ms; erro 0%
- `vortex.verify` válido: 244,2 req/s; p50 3,82 ms; erro 0%
- `vortex.verify` adulterado: 268,8 req/s; p50 3,49 ms; erro 0%
- E2E inspect → verify: 36,6 req/s; p50 26,65 ms; erro 0%
- carga concorrente C1/C5/C10/C20: erro observado 0%
- RSS do servidor: 16,61 MB inicial → 27,50 MB após carga

Esses números caracterizam o ambiente de teste ARM64/Alpine; não são SLA universal.

## Índice

| Guia | Conteúdo |
|---|---|
| [01. Visão Geral e CLI](./01-visao-geral-e-instalacao.md) | instalação, CLI, biblioteca e pacote npm |
| [02. Mobile APK](./02-mobile-apk-sem-github.md) | arquitetura mobile |
| [03. LLM](./03-llm-browser-e-qwen-gemini.md) | integração local/cloud |
| [04. Termux e Alpine](./04-termux-e-alpine-proot.md) | execução ARM64 e benchmarks |
| [05. Adapters](./05-adapters-local-vs-github-remoto.md) | GitHub, Linux, Android, Windows e MCP |
| [06. Agent Patch Arena](./06-agent-patch-arena-ci.md) | gates de patches |
| [07. Conectores](./07-conectores-e-adaptadores.md) | catálogo técnico |
| [08. Claude App](./08-conectar-ao-claude-app.md) | integração MCP |
| [09. Baseline](./governance/BASELINE-TOLERANCE-REPORT.md) | baseline dinâmica |
| [Product Status](./PRODUCT-STATUS-2026-09-17.md) | produto, mercados, evidências e gates de release |
| [Linux Native CLI Status](./LINUX-NATIVE-CLI-STATUS.md) | limites atuais da integração Linux |
| [Produtos por Indústria](./VUA-PRODUTOS-SERVICOS-POR-INDUSTRIA.md) | aplicações e modelos de oferta |

## CLI

```bash
npm install
npm link
vua status
vua adapters
vua bench
vua verify proof.json
vua mcp
```

## npm

```bash
npx @vortexfoundation/vua status
npm install -g @vortexfoundation/vua
vua status
```

**Nota:** os comandos acima dependem da publicação/instalação efetiva do pacote no registry. Em desenvolvimento, `npm link` executa diretamente o checkout local.
