# ⚡ 04. Guia Termux, Alpine Linux (PRoot) e Benchmarks de Desempenho

O **VUA** foi intencionalmente projetado com **zero dependências nativas binárias pesadas** no seu núcleo de governança criptográfica, permitindo que ele rode com máxima velocidade em ambientes restritos como **Termux (Android)**, **Alpine Linux (Docker/PRoot)** e dispositivos embarcados ARM64/x86_64.

---

## 1. Passo a Passo no Termux (Android)

### Pré-requisitos
- Dispositivo Android (versão 8.0 até Android 15).
- Aplicativo Termux instalado (preferencialmente via **F-Droid**).

### Comandos de Instalação no Termux:
```bash
# 1. Atualizar repositórios e pacotes básicos
pkg update -y && pkg upgrade -y

# 2. Instalar Node.js LTS e Git
pkg install nodejs git -y

# 3. Verificar versões
node -v # Deve ser >= 18.x
npm -v

# 4. Clonar o projeto VUA
git clone https://github.com/vortex-foundation/vua-connector.git
cd vua-connector

# 5. Instalar dependências leves do projeto
npm install

# 6. Testar o status do ambiente
npm run vua status
```

### O que o VUA detecta no Termux:
O comando `vua status` reconhecerá automaticamente:
- Ambiente: `📱 Android Termux`
- Arquitetura: `arm64`
- Memória livre disponível
- Adaptadores disponíveis para inspeção de dispositivo e SELinux

---

## 2. Passo a Passo no Alpine Linux (Docker ou PRoot)

O Alpine Linux utiliza a biblioteca C ultraleve `musl`. O VUA funciona de forma 100% nativa no Alpine:

### Via Docker:
```bash
# Iniciar contêiner Alpine mínimo
docker run -it --rm -v $(pwd):/app -w /app alpine:latest sh

# Dentro do Alpine:
apk add --no-cache nodejs npm git

# Instalar e rodar:
npm install
npm run vua status
npm run bench
```

### Via PRoot (dentro do Termux para emular Alpine puro):
```bash
pkg install proot-distro
proot-distro install alpine
proot-distro login alpine
apk add nodejs npm git
cd /root && git clone ...
npm install
npm run vua status
```

---

## 3. Como Rodar o Benchmark de Desempenho Local

O VUA inclui um utilitário de benchmark embutido que afere a velocidade das três operações fundamentais do padrão Vortex:
1. **Canonicalização JSON (RFC 8785 / JCS)**.
2. **Hasteamento Criptográfico SHA-256**.
3. **Assinatura e Validação Ed25519** em lote.

### Executando o Benchmark Padrão (200 iterações):
```bash
npm run bench
```

### Executando Benchmark com Parâmetro Personalizado (Ex: 1.000 iterações):
```bash
npx tsx bin/vua.js bench --iterations 1000
```

### Resultados Reais do Benchmark:
```
┌─────────────────────────────────────────────────────────────┐
│  ⚡ VUA: Vortex Universal Connector & Governance Engine      │
│  Architecture: x64 | Platform: linux | Node: v22.23.2       │
└─────────────────────────────────────────────────────────────┘
🚀 Iniciando Benchmark Local do VUA (500 iterações sequenciais)...
   Alvo: Canonicalização RFC 8785 + Assinatura Ed25519 + Validação Criptográfica
═════════════════════════════════════════════════════════════
📊 RESULTADOS DO BENCHMARK LOCAL:
   • Total de Operações   : 500
   • Duração Total        : 187 ms
   • Throughput           : 2,674 ops/seg
   • Latência Média       : 374.0 µs / operação
   • Validações Ed25519   : 500/500 (100% Aprovadas)
   • Consumo de Memória   : 114.7 MB
═════════════════════════════════════════════════════════════
✅ O motor VUA está ultra-otimizado para dispositivos ARM64 / Termux / Alpine.
```

---

## 4. Bateria de Conformidade e Quality Gates

Para garantir que nenhuma regressão ocorra em qualquer sistema operacional, execute a bateria completa de 10 quality gates:

```bash
# Executa todos os 10 gates (Criptografia, Sandbox, 10 E2Es, Adversarial, Stress, Latência, Degradação, Chaos, GOS3, Multi-LLM):
npm test

# Validação estrita dos contratos de governança GOS3:
npm run verify:gos3

# Bateria de conformidade direta nos 4 adaptadores universais:
npm run vua conformance
```
Todas as suítes rodam com 100% de aprovação em frações de segundo.
