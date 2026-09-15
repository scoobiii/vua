# Vortex Universal Authority Specification v2 (VUA-SPEC-v2)

> **Status:** Normativo / Em Vigor  
> **Autoridade:** Vortex Open Governance Foundation  
> **Schema:** `vortex-governance-spec/v2.1`  
> **Hash de Integridade:** RFC 8785 JCS + Ed25519

---

## 1. Modelo de Capacidade Formal

Toda ação, execução ou mutação no ecossistema VUA deve satisfazer a equação de composição determinística:

$$\text{CAPABILITY} = \text{MODEL} + \text{ROUTER} + \text{TOOLS} + \text{AUTHORIZATION} + \text{EVIDENCE} + \text{SEMANTIC\_VERIFICATION} + \text{RECOVERY}$$

1. **MODEL:** Provedor de inferência (Gemini, Claude, Qwen, Ollama local) sem autoridade direta de execução.
2. **ROUTER:** Desacoplador estrito entre intenções de linguagem (`llm`) e chamadas a adaptadores (`capability`), sob validação de esquema JSON canônico.
3. **TOOLS:** Interfaces concretas com o sistema operacional (Linux, Android, Windows, GitHub).
4. **AUTHORIZATION:** Avaliação de política de menor privilégio (sem wildcards não autenticados, com escopos estritos de caminho e repositório).
5. **EVIDENCE:** Prova criptográfica inalterável emitida pós-execução, assinada com chave Ed25519 e carimbo temporal canônico.
6. **SEMANTIC_VERIFICATION:** Oráculo semântico que audita a resposta e impede alucinações de capabilities.
7. **RECOVERY:** Mecanismo de isolamento seguro contra falhas e timeout sem vazamento de estado.

---

## 2. Cláusula de Sujeição Universal ao CI (Universal CI Subjection Rule)

> **Regra Primária de Governança:**  
> *Todo e qualquer proponente de código, patch, branch ou pull request está estritamente sujeito aos gates do CI. Nenhuma entidade possui privilégio de bypass.*

1. **Isomrfismo de Proponentes:**  
   Agentes de IA autônomos (Gemini, Claude, Codex, Qwen, bots de automação) e engenheiros humanos estão sob os mesmíssimos critérios de validação.
2. **Impossibilidade de Bypass Manual:**  
   Nenhum mantenedor, administrador ou chave de API pode realizar merge na branch `main` sem a aprovação explícita e criptograficamente comprovada emitida pelo pipeline de CI.
3. **Invariantes Invioláveis (Canary Zero-Tolerance):**  
   Qualquer violação dos seguintes 5 invariantes resulta em **Desqualificação Imediata (Score = 0)**:
   - Tentativa de mutação de estado sem aprovação explícita (`missing_approval -> sideEffects == 0`).
   - Escopo de wildcard irrestrito (`policy_denied -> sideEffects == 0`).
   - Tentativa de adulteração de hash de prova de execução (`tamper_rejected`).
   - Violação de confinamento de sandbox / escape de caminho (`sandbox_denied`).
   - Desvio de contrato do schema de saída do roteador.

---

## 3. Algoritmo de Medição de Ganho de Benchmark Base (Baseline Gain Comparator)

O CI implementa inteligência analítica comparativa que contrapõe o desempenho e acurácia do patch candidato contra as métricas consolidadas da branch `main` (**Baseline**).

### 3.1. Vetores de Medição

$$\text{Métricas Avaliadas} = \{ \text{RPS}, p_{50}, p_{95}, p_{99}, \text{ErrorRate}, \text{TimeoutRate}, \text{MemoryEfficiency}, \text{VUA\_Accuracy}, \text{DiffChurn} \}$$

### 3.2. Cálculo do Escore Composto da Baseline e do Candidato

Para cada execução, o escore de aptidão é calculado:

$$\text{Score} = (W_{\text{canary}} \times 35) + (W_{\text{accuracy}} \times 35) + (W_{\text{perf}} \times 15) + (W_{\text{hygiene}} \times 15)$$

Onde o ganho relativo ($\Delta_{\text{gain}}$) é mensurado por:

$$\Delta_{\text{gain}} = \text{Score}_{\text{candidato}} - \text{Score}_{\text{baseline}}$$

$$\Delta_{\text{RPS}} = \frac{\text{RPS}_{\text{candidato}} - \text{RPS}_{\text{baseline}}}{\text{RPS}_{\text{baseline}}} \times 100\%$$

$$\Delta_{\text{latência}} = \frac{p95_{\text{baseline}} - p95_{\text{candidato}}}{p95_{\text{baseline}}} \times 100\%$$

---

## 4. Condição Normativa de Aprovação de Merge (`PASS_SUPERIOR`)

O CI só aprova e realiza o merge automático de um patch se e somente se o veredito for **`PASS_SUPERIOR`**:

| Veredito | Critério | Ação do CI |
|---|---|---|
| **`PASS_SUPERIOR`** | • Todos os 5 testes Canary passaram (100%)<br>• $\Delta_{\text{gain}} > 0$ (Superou a Baseline consolidada)<br>• Sem regressão de acurácia VUA nem vazamento de memória | **APROVADO:** Qualificado para Auto-Merge (*Fast-Forward*) na `main`. |
| **`PASS_ACCEPTABLE`** | • Invariantes passaram, mas $\Delta_{\text{gain}} \approx 0$ (desempenho idêntico à base sem ganho mensurável) | **CONGELADO:** Aguarda revisão humana; não sofre auto-merge autônomo. |
| **`FAIL_REGRESSION`** | • $\Delta_{\text{gain}} < 0$ (piora de latência, queda de RPS ou aumento de erros) | **REJEITADO:** Bloqueio imediato de merge com relatório de regressão. |
| **`DISQUALIFIED / BLOCKED`** | • Falha em qualquer teste Canary, quebra de contrato ou marcadores residuais | **ELIMINADO:** Proibição de merge e descarte seguro do patch. |

---

## 5. Arquivamento e Evidência Auditável

Ao final da avaliação, o CI gera um artefato `vortex-execution-evidence/v1` contendo:
- Hash canônico RFC 8785 do diff do patch.
- Tabela comparativa de deltas ($\Delta_{\text{gain}}$, $\Delta_{\text{RPS}}$, $\Delta_{\text{latência}}$).
- Assinatura digital do robô árbitro do CI.
- Prova de que a base `main` foi testada sob os mesmos parâmetros de hardware e carga.
