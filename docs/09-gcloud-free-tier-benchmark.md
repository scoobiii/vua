# ☁️ 09. Guia de Benchmark Automático: VUA Local vs Google Cloud Free Tier

Este documento detalha como executar o **Benchmark Comparativo Automático** entre o nó local do VUA (Termux / Alpine / Desktop) e o **Google Cloud Run (Free Tier Perpétuo)**, integrando a autenticação de conta Google e a tese de monetização de infraestrutura da Vortex Foundation.

---

## 1. Arquitetura da Solução & Resumo Executivo

| Componente | Função | Dependência de CLI |
| :--- | :--- | :--- |
| **VUA GCloud Adapter** (`gcloud`) | Conector normatizado integrado ao registro universal do VUA. | **Zero** — Usa engine HTTP nativa em Node/TypeScript. |
| **CLI `vua gcloud`** | Comandos dedicados para consulta de cotas, sondagem de proxy e benchmark. | Nenhuma instalação de Python ou SDK proprietário. |
| **NPM Script `npm run bench:gcloud`** | Execução rápida de baseline local + probe comparativo na nuvem. | Invocável via npm/npx padrão. |
| **REST API `/api/vua/gcloud/*`** | Endpoints governados expostos no backend Express. | Acessível pelo frontend e por ferramentas de teste (k6, curl). |

---

## 2. Google Cloud Run: Free Tier Perpétuo (Custo $0,00)

O Google Cloud Platform fornece cotas gratuitas mensais renováveis perpetuamente:
- **2.000.000 de requisições / mês**
- **360.000 GiB-segundos de memória / mês**
- **180.000 vCPU-segundos / mês**
- **1 GiB de tráfego de saída (egress) / mês**

### Deploy Recomendado com Scale-to-Zero

Para subir o VUA no Cloud Run Free Tier garantindo custo zero quando inativo:

```bash
gcloud run deploy vua-server \
  --source . \
  --region us-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 2 \
  --port 3000
```

> **Aviso de URL**: O Cloud Run nativo produz uma URL terminada em `*.a.run.app` (ex: `https://vua-server-xyz-uw.a.run.app`). Essa URL aceita conexões diretas sem o desafio do navegador `/__cookie_check.html`.

---

## 3. Como Executar os Benchmarks

### A. Via CLI do VUA
```bash
# 1. Consultar limites e cotas do Free Tier:
vua gcloud limits

# 2. Sondar se a URL configurada é Cloud Run Nativa ou Proxy AI Studio:
vua gcloud probe https://sua-url-nativa.a.run.app

# 3. Rodar benchmark comparativo Local (Termux) vs Nuvem:
vua gcloud bench 50

# 4. Rodar pelo comando padrão com flag --cloud:
vua bench --cloud --url https://sua-url-nativa.a.run.app
```

### B. Via NPM Script
```bash
npm run bench:gcloud
```

### C. Via API REST
```bash
# Executar benchmark comparativo
curl -X POST http://localhost:3000/api/vua/gcloud/bench \
  -H "Content-Type: application/json" \
  -d '{"iterations": 20, "cloud_url": "https://sua-url.a.run.app"}'

# Consultar limites do Free Tier
curl http://localhost:3000/api/vua/gcloud/free-tier
```

---

## 4. Tese de Monetização da Vortex Foundation

O VUA valida formalmente que a execução de governança em dispositivos de borda (Termux em smartphones, workstations locais, SBCs) entrega latências na faixa de microssegundos (< 1 ms), eliminando 100% dos custos de rede e infraestrutura para 90% das tarefas cotidianas do usuário.

A **Vortex Foundation** monetiza o ecossistema fornecendo:
1. **Infraestrutura Corporativa sob Demanda**: Conectores para clusters Cloud Run, VMs GPU e modelos de linguagem massivos apenas quando o hardware local atinge saturação.
2. **Relatórios de Auditoria e Certificados de Prova (ExecutionProof v1)**: Assinatura de conformidade contínua para empresas.
3. **Multi-Cloud Broker**: Roteamento automático de carga para o provedor com menor custo ou menor latência validada por testes k6 automatizados.
