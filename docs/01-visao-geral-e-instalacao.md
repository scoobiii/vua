# 📦 01. Visão Geral, Instalação e Uso como CLI / Biblioteca

O **VUA (Vortex Universal Connector)** foi projetado para operar com dupla personalidade:
1. **Headless / CLI / Lib**: Código limpo, zero dependências pesadas de UI, ideal para scripts, servidores, Termux e Alpine.
2. **GUI Web em Tempo Real**: Dashboard interativo React + Tailwind com visualizador de logs, adaptadores e atestações.

---

## 1. Instalação Local

### A. Clonar e Instalar Dependências
```bash
# Entrar na pasta do projeto
cd vua-connector

# Instalar dependências (Node.js 18+ ou 20+ recomendado)
npm install
```

### B. Binário Global ou Link Simbólico Local
Para usar o comando `vua` em qualquer lugar do seu terminal:
```bash
npm link
# Agora o comando 'vua' está disponível globalmente:
vua status
```
Ou execute via npm scripts locais:
```bash
npm run vua status
npm run vua adapters
npm run vua bench
```

---

## 2. Comandos Disponíveis no CLI (`vua`)

| Comando | Descrição | Exemplo de Execução |
| :--- | :--- | :--- |
| `vua status` | Exibe diagnóstico de hardware, memória livre, arquitetura e status de chaves | `vua status` |
| `vua adapters` | Lista os 4 adaptadores ativos (GitHub, Linux, Android, Windows) e suas ações | `vua adapters` |
| `vua invoke <adapter> <action> [payload]` | Dispara uma ação governada com carimbo e assinatura Ed25519 | `vua invoke linux check_sandbox` |
| `vua bench [--iterations N]` | Mede latência, throughput (ops/seg) de RFC 8785 e Ed25519 | `vua bench --iterations 500` |
| `vua conformance` | Executa bateria de conformidade 100% nos adaptadores | `vua conformance` |
| `vua llm [opções]` | Executa inferência com prova criptográfica em LLMs locais ou Cloud | `vua llm --provider gemini --prompt "Olá"` |
| `vua mcp` | Inicia o servidor MCP (JSON-RPC 2.0 via stdio) para Cursor, Claude, etc. | `vua mcp` |
| `vua verify <proof.json>` | Realiza auditoria matemática independente de um `ExecutionProof v1` | `vua verify proof.json` |

---

## 3. Uso como Biblioteca TypeScript / Node.js

Você pode importar o VUA diretamente no seu código backend, agente ou script:

```typescript
import {
  executeVortexPipeline,
  vuaRegistry,
  verifyExecutionProof,
  canonicalizeRFC8785,
  signProofPayload
} from './src/vortex/index.js';

// 1. Invocar um adaptador local (ex: Android ou Linux)
const result = await vuaRegistry.invoke({
  adapterId: 'android',
  action: 'check_selinux',
  target: { device: 'local' },
  payload: {}
});

console.log('Sucesso:', result.success);
console.log('Assinatura Ed25519:', result.execution_proof?.signature);
console.log('Validação da prova:', result.verification?.valid);

// 2. Executar uma operação sob pipeline governado
const pipelineOutput = await executeVortexPipeline({
  requestId: 'req-001',
  operation: 'fs.read_restricted',
  target: { path: '/etc/os-release' },
  input: { format: 'json' }
});

console.log('Output Hash:', pipelineOutput.proof.output_hash);
```

---

## 4. Estrutura do Pacote (`package.json`)

O projeto está configurado com ponto de entrada limpo tanto para módulo ECMAScript quanto para CLI:
- `"main"`: `./src/vortex/index.ts`
- `"bin"`: `{ "vua": "./bin/vua.js" }`
- `"type"`: `"module"` (ESM nativo)
