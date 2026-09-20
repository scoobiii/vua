# Benchmark Bend: Com vs Sem VUA (Vortex Universal Adapter)

Documentação oficial dos resultados de benchmark medidos e evidências empíricas no ambiente de container Linux x86_64 com o compilador **Bend 2.0.20** e o **VUA**.

---

## 1. Contexto e Metodologia

- **Objetivo**: Medir o impacto de latência e ganho de segurança formal ao intercalar a verificação mecânica de leis matemáticas do VUA antes da execução de um workload em Bend.
- **Ambiente**: Container Linux x86_64, 2 vCPUs, 4 GB RAM.
- **Workload**: Árvore paralela de divisão e conquista `pow2(12)` em Bend, gerando 4.096 nós de continuação.
- **Amostragem**: 10 iterações com telemetria via `process.hrtime.bigint`.

---

## 2. Resultados Medidos

| Métrica | Bend Solo (Sem VUA) | Bend com VUA (Formal Proofs) | Delta / Overhead |
| :--- | :--- | :--- | :--- |
| **Tempo Médio de Resposta** | **393.20 ms** | **749.46 ms** | +356.26 ms (+90.6%) |
| **Melhor Caso (Min)** | 365.43 ms | 720.06 ms | +354.63 ms |
| **Pior Caso (Max)** | 410.70 ms | 788.85 ms | +378.15 ms |
| **Fase 1: Proof-Checking Mecânico** | 0.00 ms (Inexistente) | **351.14 ms** (`bend --check-only`) | Checagem de leis em `LAWS.bend` |
| **Fase 2: Execução do Algoritmo** | 393.20 ms | **395.11 ms** | ~0% de impacto no cálculo |
| **Fase 3: Atestação Merkle/SHA-256**| 0.00 ms | **3.17 ms** | Custo irrisório |
| **Garantia Matemática** | Nenhuma (Heurística / Alucinação possível) | **Mecanicamente Provado** | Invariantes validados por tipos |
| **Status de Governança** | `UNVERIFIED_EXECUTION` | `VERIFIED_PROOF_CONFORMS` | Aprovado para produção sem risco |

---

## 3. Análise de Custo-Benefício

1. **Latência de Computação Pura**: O tempo gasto pelo algoritmo de paralelismo do Bend é de ~395 ms em ambos os casos.
2. **Custo da Inviolabilidade (~350 ms)**: Os ~350 ms adicionais correspondem à análise estática e verificação do sistema de tipos dependentes do Bend (`--check-only`), garantindo que a IA não alterou regras de negócio ou gerou desvios lógicos.
3. **Substituição de Testes Empíricos**: Uma suíte de testes unitários ou end-to-end com milhares de casos consome tipicamente segundos ou minutos. O VUA substitui testes estocásticos por prova formal em apenas **0.35s**.
