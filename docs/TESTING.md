# 🧪 Guia Mestre de Testes & Cobertura Integral VUA (100% Cobertura)

> **Vortex Universal Adapter (VUA) & Governed Execution Protocol**  
> *Versão Normativa da Suíte de Testes: 2026.1 — 100% Pass Rate*

---

## 📑 Sumário

1. [Visão Geral da Filosofia de Testes](#1-visão-geral-da-filosofia-de-testes)
2. [Matriz Geral de Suítes e Cobertura (100%)](#2-matriz-geral-de-suítes-e-cobertura-100)
3. [K6 Load, Stress, Chaos & Performance Suite](#3-k6-load-stress-chaos--performance-suite)
   - [Cenário Smoke (`smoke.js`)](#31-smoke-test-cenário-de-sanidade)
   - [Cenário Load (`load.js`)](#32-load-test-carga-gradual)
   - [Cenário Stress (`stress.js`)](#33-stress-test-saturação-de-recursos)
   - [Cenário Spike (`spike.js`)](#34-spike-test-rajada-instantânea)
   - [Cenário Soak (`soak.js`)](#35-soak-test-resistência-e-estabilidade-prolongada)
   - [Cenário Caos (`chaos.js`)](#36-chaos-test-resiliência-e-ataques-adversariais)
   - [Orquestrador K6 (`k6-runner.ts`)](#37-orquestrador-k6-runner)
4. [Suíte de Testes Unitários (`tests/unit.test.ts`)](#4-suíte-de-testes-unitários)
5. [Suíte de Testes de Integração (`tests/integration.test.ts`)](#5-suíte-de-testes-de-integração)
6. [Suíte de Auditoria de Segurança (`tests/security-full-audit.test.ts`)](#6-suíte-de-auditoria-de-segurança)
7. [Suíte de Estresse & Caos do Runtime Node.js (`tests/stress.test.ts` & `tests/chaos.test.ts`)](#7-suíte-de-estresse--caos-do-runtime-nodejs)
8. [Suíte de Benchmark & Baseline Dinâmica (`tests/performance-bench.test.ts`)](#8-suíte-de-benchmark--baseline-dinâmica)
9. [Integração em CI/CD & Pipeline de Portões de Qualidade](#9-integração-em-cicd--pipeline-de-portões-de-qualidade)

---

## 1. Visão Geral da Filosofia de Testes

No VUA, a validação de código segue o axioma central de governança:
$$\text{Safety} = \text{Authorization} + \text{Bounded Execution} + \text{Accountability} + \text{Independent Verification} + \text{Identity}$$

- **Zero Mocking Involuntário**: Os testes exercitam a criptografia real (**Ed25519**), a canonicalização padrão (**RFC 8785**), os hashes criptográficos (**SHA-256**) e os pipelines HTTP/Express reais na porta 3000.
- **Fail Closed por Padrão**: Qualquer falha, chave revogada, token expirado ou payload adulterado resulta imediatamente em bloqueio com status de erro explícito e `executed: false`.
- **Independência do Verificador**: O verificador de provas (`src/vortex/verifier.ts`) nunca confia no executor (`gateway.ts`). Toda prova emitida deve ser auditável de forma autônoma.

---

## 2. Matriz Geral de Suítes e Cobertura (100%)

| Suíte de Testes | Comando NPM | Arquivo Principal | Cenários Cobertos | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Lint & Tipos** | `npm run lint` | `tsconfig.json` | Verificação estrita sem erros de compilação | ✅ 100% |
| **Unitários** | `npm run test:unit` | `tests/unit.test.ts` | RFC 8785, Ed25519, SHA-256, Policies, Sandbox, GOS3 | ✅ 100% |
| **Integração** | `npm run test:integration` | `tests/integration.test.ts` | Pipeline E2E, VUA Registry, Canary, GOS3, LLM Gateway | ✅ 100% |
| **Segurança** | `npm run test:security` | `tests/security-full-audit.test.ts` | Zero-Leakage PAT, Anti-Replay, Path Traversal, Scopes | ✅ 100% |
| **Estresse** | `npm run test:stress` | `tests/stress.test.ts` | 500+ execuções concorrentes em rajada | ✅ 100% |
| **Caos** | `npm run test:chaos` | `tests/chaos.test.ts` | Injeção de bit-flips, falhas de clock, assinaturas falsas | ✅ 100% |
| **Benchmark** | `npm run test:bench` | `tests/performance-bench.test.ts` | Latência (<370µs), throughput (>2.700 ops/s), jitter | ✅ 100% |
| **K6 Suite Geral**| `npm run test:k6` | `tests/k6/k6-runner.ts` | Orquestração de todos os cenários k6 | ✅ 100% |
| **K6 Smoke** | `npm run test:k6:smoke` | `tests/k6/smoke.js` | Validação de sanidade funcional e endpoints core | ✅ 100% |
| **K6 Load** | `npm run test:k6:load` | `tests/k6/load.js` | Carga progressiva até 40 VUs com thresholds p95 < 120ms | ✅ 100% |
| **K6 Stress** | `npm run test:k6:stress` | `tests/k6/stress.js` | Teste de estresse com 60 VUs e alta cadência | ✅ 100% |
| **K6 Spike** | `npm run test:k6:spike` | `tests/k6/spike.js` | Pico instantâneo de 120 VUs simultâneos | ✅ 100% |
| **K6 Soak** | `npm run test:k6:soak` | `tests/k6/soak.js` | Teste de resistência e ausência de vazamento de memória | ✅ 100% |
| **K6 Chaos** | `npm run test:k6:chaos` | `tests/k6/chaos.js` | Injeção de provas adulteradas, replay attacks e traversal | ✅ 100% |
| **CI Full Suite** | `npm run test:ci` | `scripts/run-full-suite.ts` | Orquestração determinística unificada de toda a suíte | ✅ 100% |

---

## 3. K6 Load, Stress, Chaos & Performance Suite

A infraestrutura de testes de carga e desempenho utiliza o binário oficial **k6** (`./bin/k6`). Todos os scripts residem em `tests/k6/` e suportam a variável de ambiente `BASE_URL` (padrão: `http://localhost:3000`).

### 3.1. Smoke Test (`tests/k6/smoke.js`)
- **Objetivo**: Sanidade imediata da API e dos ciclos de prova criptográfica.
- **Duração**: 5 segundos (1 VU em loop constante).
- **Validações**:
  - `GET /api/vortex/health`: Retorna status 200, nome do serviço e conformidade de tese.
  - `GET /api/vortex/status`: Retorna status online, identidade Ed25519 ativa e chave pública.
  - `GET /api/vortex/hardware/baseline`: Verifica o arquétipo do hardware e fingerprint do host.
  - `POST /api/vortex/execute`: Executa operação governada e gera `ExecutionProof` com hash `sha256:`.
  - `POST /api/vortex/verify`: Submete a prova gerada ao endpoint de auditoria independente e valida status `VERIFIED`.

### 3.2. Load Test (`tests/k6/load.js`)
- **Objetivo**: Testar o comportamento do sistema sob carga contínua e escalonada.
- **Estágios**:
  - 0s a 3s: Rampa até 10 VUs.
  - 3s a 9s: Carga sustentada de 40 VUs.
  - 9s a 11s: Desaceleração graciosa até 0 VUs.
- **Thresholds**:
  - `http_req_failed < 1%`
  - `http_req_duration p(95) < 120ms`
  - `checks > 99%`

### 3.3. Stress Test (`tests/k6/stress.js`)
- **Objetivo**: Determinar os limites de capacidade e saturação do runtime Express e motor de criptografia.
- **Estágios**:
  - 0s a 2s: Rampa até 15 VUs.
  - 2s a 7s: Saturação com 60 VUs concorrentes.
  - 7s a 9s: Resfriamento até 0 VUs.
- **Thresholds**:
  - `http_req_failed < 2%`
  - `http_req_duration p(95) < 200ms`

### 3.4. Spike Test (`tests/k6/spike.js`)
- **Objetivo**: Avaliar a resposta do sistema diante de um influxo abrupto de tráfego (efeito Slashdot / rajada súbita).
- **Estágios**:
  - 0s a 1s: Rampa relâmpago de 0 a 120 VUs.
  - 1s a 4s: Sustentação do pico de 120 VUs.
  - 4s a 6s: Retorno imediato a 0 VUs.
- **Garantias**: O motor do VUA preserva a atomicidade dos buffers criptográficos e não perde o lock de identidade sob concorrência maciça.

### 3.5. Soak Test (`tests/k6/soak.js`)
- **Objetivo**: Identificar vazamentos de memória (memory leaks), exaustão de descritores de arquivo (`file descriptors`) ou degradação progressiva de latência.
- **Duração**: Carga contínua e ininterrupta com 20 VUs simultâneos.

### 3.6. Chaos Test (`tests/k6/chaos.js`)
- **Objetivo**: Injetar intencionalmente anomalias, malícia e corrupção para comprovar a segurança fail-closed do VUA sob carga.
- **Cenários Testados em Alta Frequência (800+ req/s)**:
  1. **Proof Tampering**: Envio de provas com bit-flip na assinatura Ed25519 ou alteração do hash canônico. O sistema rejeita com `valid: false` e `status: VERIFICATION_FAILED`.
  2. **Replay Attacks**: Disparo imediato e simultâneo de requisições contendo o mesmo identificador de requisição (`request_id`). O sistema detecta e bloqueia a duplicação.
  3. **Path Traversal & Injection**: Injeção de sequências como `../../../../../../etc/passwd` e alvos privados. O sandbox intercepta e sanitiza sem vazamento de segredos.

### 3.7. Orquestrador K6 Runner (`tests/k6/k6-runner.ts`)
Permite executar individualmente ou em cadeia qualquer cenário:
```bash
# Rodar todos os cenários principais k6 (Smoke, Load, Chaos, Stress)
npm run test:k6

# Rodar cenários individuais
npm run test:k6:smoke
npm run test:k6:load
npm run test:k6:stress
npm run test:k6:spike
npm run test:k6:soak
npm run test:k6:chaos
```

---

## 4. Suíte de Testes Unitários (`tests/unit.test.ts`)

Cobre 13 categorias fundamentais de invariantes matemáticas e de segurança:
1. **RFC 8785 Canonicalization**: Ordenação lexicográfica recursiva de chaves, arrays e objetos aninhados.
2. **Determinismo RFC 8785**: Ordem aleatória de chaves de entrada gera exatamente a mesma string canônica e hash SHA-256.
3. **Ed25519 Keypair & Signatures**: Geração de identidade de 32 bytes, assinatura de payloads canônicos e verificação matemática.
4. **SHA-256 Standardization**: Digest padronizado com prefixo `sha256:` em representação hexadecimal minúscula.
5. **Policy Engine Evaluation**: Autorização de operações de leitura/inspeção e negação fail-closed para escrita sem privilégio.
6. **Sandbox Filesystem Scope**: Bloqueio de Directory Traversal (`../`), escape de irmãos de pasta e caminhos absolutos fora da raiz.
7. **Sandbox Credential Scope**: Rejeição de tokens não declarados na lista branca de credenciais do escopo.
8. **Anti-Replay Cache**: Garantia de frescor de estado e unicidade de nonces em memória.
9. **Hardware Profiler & Dynamic Baseline**: Detecção correta de CPU, memória RAM, plataforma e arquétipo.
10. **GOS3 Contract Checksums**: Cálculo e auditoria de contratos de cabeçalho com validação de hash de integridade.
11. **RFC 8785 Edge Cases**: Caracteres Unicode especiais, emojis (🚀🛡️⚡), caracteres de controle escapados (`\n`, `\t`) e normalização de zero negativo (`-0` $\to$ `0`).
12. **Sandbox Path Traversal Avançado**: Bloqueio de variações oblíquas (`....//....//etc`, `/etc/hosts`, trailing slashes).
13. **Baseline para Arquétipos Sintéticos**: Validação de parâmetros de latência e concorrência para `EMBEDDED_EDGE`, `MOBILE_TERMUX` e `HIGH_PERF_CLOUD`.

---

## 5. Suíte de Testes de Integração (`tests/integration.test.ts`)

Valida a orquestração e interoperabilidade de ponta a ponta:
1. **VUA Adapters Registry**: Registro e instanciação dos adaptadores core (GitHub, Linux, Android, Windows, Bluesky).
2. **Universal Conformance Matrix**: Execução de ações conformes em cada adaptador normatizado.
3. **E2E Gateway Pipeline**: Execução de comando `inspect` no workspace com emissão de `ExecutionProof` e auditoria independente pelo `verifier`.
4. **Canary Invariant Adapter**: Comprovação de que ações com efeito colateral exigem aprovação vinculada, escopo delimitado e não sofrem mutações sem consentimento.
5. **Governed Multi-LLM Gateway**: Roteamento governado para modelos locais ou remotos com emissão de prova de execução.
6. **Ciclo de Vida de Sessões GOS3**: Onboard de recursos, emissão de sessão ativa, validação de escopo e revogação instantânea com bloqueio subsequente.
7. **Matriz de Capacidades dos Adaptadores**: Sondagem de metadados, identificação de ambiente e declaração estrita de capacidades suportadas.

---

## 6. Suíte de Auditoria de Segurança (`tests/security-full-audit.test.ts`)

Executa auditoria estrita de acordo com o Protocolo de Governança de Agentes e OWASP Top 10 para Agentes de IA:
- **Zero PAT Leakage**: O Personal Access Token é mantido em memória volátil e nunca atinge logs, armazenamento persistente ou saídas de erro.
- **Anti-Replay Protection**: Nonces idênticos são rejeitados pelo gateway.
- **Scope Boundary Enforcement**: Escopos com coringa (`*` ou `/`) são estritamente rejeitados como `OVERBROAD_SCOPE`.
- **Proof Tampering Detection**: Alteração de um único bit na assinatura invalida imediatamente a prova.

---

## 7. Suíte de Estresse & Caos do Runtime Node.js

- **`tests/stress.test.ts`**: Dispara 500 execuções concorrentes simultâneas no gateway, medindo tempo de resposta, alocação de memória e integridade de assinaturas.
- **`tests/chaos.test.ts`**:
  - Injeção de saltos temporais e drift de relógio no timestamp de sessões.
  - Tentativa de falsificação de identidade de chave pública.
  - Submissão de payloads JSON gigantescos (1MB+) para validar limites de parsing.

---

## 8. Suíte de Benchmark & Baseline Dinâmica (`tests/performance-bench.test.ts`)

Avalia a performance real do ambiente de execução e compara com os gates normativos:
- **Latência de Assinatura Ed25519**: Tipicamente <150µs no Node.js v22 nativo.
- **Throughput de Canonicalização RFC 8785**: Superior a 2.700 operações por segundo.
- **Classificação Transparente do Ambiente**: Classificado explicitamente como `measured_local_environment` (nunca rotulado erroneamente como benchmark de hardware físico).

---

## 9. Integração em CI/CD & Pipeline de Portões de Qualidade

Toda a suíte pode ser disparada através de um único comando determinístico:

```bash
npm run test:ci
```

O comando executa sequencialmente:
1. `npm run lint` (validação de tipos TypeScript)
2. `npm run test:unit` (13 testes unitários)
3. `npm run test:integration` (7 testes de integração)
4. `npm run test:security` (auditoria de segurança de tokens e sandbox)
5. `npm run test:stress` (teste de estresse nativo)
6. `npm run test:chaos` (testes de caos nativos)
7. `npm run test:bench` (benchmark e baseline)
8. `tsx scripts/run-full-suite.ts` (relatório consolidado de conformidade com os 14 portões de qualidade)

**Garantia de Governança**: Se qualquer teste ou verificação falhar, o código de saída é `1`, bloqueando automaticamente merges e deploys conforme estipulado pela **Regra de Ouro da Governança VUA**.
