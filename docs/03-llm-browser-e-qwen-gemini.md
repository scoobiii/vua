# 🤖 03. LLM no Browser, Qwen Coder 0.5B e Google Gemini (Passo 3 Detalhado)

Este guia explica detalhadamente a arquitetura de inteligência artificial do **VUA**, dividida entre **modelos locais offline ultraleves (Qwen Coder 0.5B)** e **modelos em nuvem de alta capacidade (Google Gemini)** com governança criptográfica Ed25519.

---

## 1. Arquitetura Híbrida: Navegador vs. Gateway Seguro

O VUA adota o princípio de **Zero-Leakage de Credenciais** e **Governança Criptográfica Obrigatória**:

```
┌────────────────────────────────────────────────────────┐
│             NAVEGADOR / APP FRONTEND                   │
│                                                        │
│  Opção 1: WebGPU / Wasm (Qwen Coder 0.5B Offline)     │
│  Opção 2: Chamada Governamental para o Gateway         │
└───────────────────────────┬────────────────────────────┘
                            │ POST /api/vortex/llm/generate
                            ▼
┌────────────────────────────────────────────────────────┐
│             VUA GATEWAY (BACKEND SEGURO)               │
│                                                        │
│  • Canonicalização RFC 8785 dos Parâmetros             │
│  • Conexão Privada (GEMINI_API_KEY nunca sai do server)│
│  • Emissão de ExecutionProof v1 com Assinatura Ed25519 │
└───────────────────────────┬────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
  [ Google Gemini 3.8 Flash ]    [ Ollama / Llama.cpp Local ]
  (Nuvem Segura)                 (Qwen 2.5 Coder 0.5B Offline)
```

---

## 2. Como Rodar o Qwen 2.5 Coder 0.5B Localmente (100% Offline)

O **Qwen 2.5 Coder 0.5B** é um dos modelos mais eficientes do mundo para dispositivos restritos (consome menos de 400 MB de VRAM/RAM), tornando-o perfeito para rodar dentro do **Termux**, **Alpine Linux** ou computadores sem GPU dedicada.

### Opção A: Via Ollama (Mais Simples)
1. Instale o Ollama em sua máquina ou servidor local:
   ```bash
   curl -fsSL https://ollama.com/install.sh | sh
   ```
2. Baixe e inicie o modelo Qwen Coder 0.5B:
   ```bash
   ollama run qwen2.5-coder:0.5b
   ```
   *(O Ollama abrirá uma API HTTP REST padrão na porta `http://localhost:11434`)*

3. Conecte o VUA ao Qwen Coder usando o CLI:
   ```bash
   npm run vua llm -- --provider ollama --model qwen2.5-coder:0.5b --prompt "Crie uma funcao TypeScript para calcular SHA-256"
   ```

### Opção B: Via llama.cpp / llama-server (Ideal para Termux no Celular)
No Termux ou Alpine, você pode compilar o `llama.cpp` nativamente em C++ e rodar o binário do Qwen quantizado em GGUF:
```bash
# Baixar o modelo quantizado Q4_K_M (~350 MB)
wget https://huggingface.co/Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF/resolve/main/qwen2.5-coder-0.5b-instruct-q4_k_m.gguf

# Iniciar o servidor local compatível com OpenAI/Ollama
./llama-server -m qwen2.5-coder-0.5b-instruct-q4_k_m.gguf -c 2048 --port 11434 --host 127.0.0.1
```

O VUA se comunica diretamente com `http://localhost:11434` emitindo a prova de execução assinada para cada inferência gerada.

### Opção C: Diretamente no Navegador via WebGPU / ONNX
O frontend do VUA está preparado para instanciar modelos usando **WebGPU** e `@huggingface/transformers` (`transformers.js` v3):
- Carrega o arquivo ONNX (`onnx-community/Qwen2.5-Coder-0.5B-Instruct-ONNX`) em cache local do IndexedDB.
- Não faz nenhuma requisição HTTP externa após o primeiro download.
- As inferências ocorrem na GPU do dispositivo do usuário com latência ultrabaixa.

---

## 3. Como Usar o Google Gemini com Segurança

Quando tarefas mais complexas exigem modelos avançados (`gemini-3.8-flash`), o VUA utiliza a API oficial do Google com total blindagem:

### Regra Crítica de Segurança:
- **A chave nunca é enviada ao navegador**: Arquivos do frontend (`src/App.tsx`, etc.) não possuem referências à chave.
- O backend (`server.ts`) lê `process.env.GEMINI_API_KEY`.

### Passo a Passo de Configuração:
1. Obtenha sua chave gratuita no [Google AI Studio](https://aistudio.google.com/).
2. Adicione no seu arquivo `.env`:
   ```env
   GEMINI_API_KEY=AIzaSySuaChaveAqui...
   ```
3. Teste a conexão e a emissão de governança pelo CLI:
   ```bash
   npm run vua llm -- --provider gemini --model gemini-3.8-flash --prompt "Explique o VUA em duas frases"
   ```
4. Exemplo de Saída com Prova Criptográfica:
   ```
   🤖 Invocando LLM com Governança VUA:
      • Provedor: gemini
      • Modelo  : gemini-3.8-flash
      • Prompt  : "Explique o VUA em duas frases"

   📝 RESPOSTA DO MODELO:
   O VUA (Vortex Universal Connector) é um motor de governança e ponte de execução universal...

   ─────────────────────────────────────────────────────────────
   🛡️ PROVA DE GOVERNANÇA EMITIDA:
      • Duração      : 1419 ms
      • Prova Ed25519: ✅ 100% VÁLIDA
      • Output Hash  : sha256:26c75942321717c31a6d34d70...
      • Input Hash   : sha256:072ad281bbfe9ff0f3534c7a8...
   ```

---

## 4. Validação da Prova no Verificador Independente

Toda resposta gerada (seja por Qwen local ou Gemini Cloud) vem acompanhada do objeto `execution_proof`. Você pode salvar esse JSON e validá-lo com o comando:
```bash
npm run vua verify caminho/da/prova.json
```
O verificador recalculerá o hash RFC 8785 da entrada e saída e auditará matematicamente a assinatura Ed25519 da identidade governada.
