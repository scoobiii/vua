# 🛡️ Manual de Segurança e Governança Criptográfica — VUA (Vortex Universal Adapter)
**Versão:** 1.0.0 | **Data:** Setembro/2026 | **Classificação:** Normativo / Produção  
**Autor:** Vortex Open Protocol Foundation  
**Tese:** $\text{Safety} = \text{Authorization} + \text{Bounded Execution} + \text{Accountability} + \text{Independent Verification} + \text{Identity}$

---

## 1. Visão Geral da Arquitetura de Segurança

O **VUA (Vortex Universal Adapter)** opera sob o princípio de **Fail-Closed** e desconfiança mútua. Em sistemas onde agentes de IA (LLMs) executam código, interagem com sistemas operacionais e realizam mutações em repositórios Git, a saída do modelo é tratada como **input não confiável**.

O VUA introduz uma camada de governança determinística interposta entre o Agente e o Ambiente Operacional, garantindo que:
1. Nenhuma ação com efeito colateral ocorra sem política pré-autorizada.
2. Nenhuma prova de execução seja aceita sem assinatura criptográfica assimétrica (**Ed25519**).
3. Todas as estruturas de dados sejam verificáveis de forma determinística (**RFC 8785 JCS**).
4. As credenciais e segredos jamais persistam em disco, logs ou payloads auditáveis (**Zero-Leakage**).

---

## 2. Gestão Segura de Segredos e PAT (Personal Access Token)

### 2.1 Isolamento Estrito em Memória Volátil
O VUA impõe uma política rígida de **Zero-Disk-Persistence** para segredos de alta sensibilidade, especialmente GitHub Personal Access Tokens (PATs) e chaves de API:
- **Residência em Memória**: O token informado no `GitHubRepoManager` reside exclusivamente no estado React (`useState`) e em variáveis de escopo em memória RAM da sessão do usuário.
- **Proibição de Persistência Local**: É estritamente proibido salvar PATs em `localStorage`, `sessionStorage`, `IndexedDB` ou cookies do navegador.
- **Zero Gravação em Logs**: A camada de rede e o despachante de comandos aplicam expressões regulares de sanitização (`/ghp_[a-zA-Z0-9]{36,}/g` e `Bearer [A-Za-z0-9._-]+`) para mascarar qualquer credencial antes de registrar eventos no console ou no ledger.

### 2.2 Controle de Escopo Granular (Princípio do Menor Privilégio)
Ao configurar um PAT no VUA, configure apenas os escopos estritamente necessários para a ação pretendida:
- **Apenas Leitura / Mapeamento**: `read:org`, `repo:status`, `public_repo` (para repositórios de código aberto).
- **Proposta e Escrita de PRs**: `repo` (necessário para criar branches de feature e pull requests).
- **Workflows e CI**: `workflow` (apenas se o agente precisar acionar rotinas de build remoto).
- **Escopos Proibidos**: Nunca conceda escopos `admin:org`, `delete_repo`, ou privilégios de deleção total para agentes autônomos.

---

## 3. Criptografia Assimétrica Ed25519 & Identidade de Agente

### 3.1 Chaves Assimétricas e Verificação Independente
Diferente de sistemas legados que usam segredos compartilhados (HMAC) ou certificados X.509 de alta sobrecarga:
- Cada instância ou agente do VUA possui ou gera um par de chaves **Ed25519** nativo (curva elíptica Curve25519 Edwards-curve Digital Signature Algorithm).
- A chave privada permanece isolada no ambiente de execução do VUA.
- A chave pública é compartilhada no endpoint `/.well-known/vortex-keys` para descoberta canônica por qualquer verificador externo.
- **Assinatura de Prova**: Toda operação executada gera uma estrutura `ExecutionProof v1`, onde o payload serializado é assinado com a chave privada e verificável por qualquer auditor utilizando apenas a chave pública.

---

## 4. Canonicalização Determinística RFC 8785 (JCS)

Para evitar ataques de mutação de formato e discrepâncias de hashing entre linguagens (Node.js, Go, Python, Rust):
1. **Ordenação Lexicográfica**: Todas as chaves JSON são ordenadas estritamente de acordo com seus code points UTF-16.
2. **Normalização Numérica**: Números de ponto flutuante são serializados de acordo com as regras ECMAScript / IEEE 754 sem zeros à esquerda ou expoentes desnecessários.
3. **Ausência de Espaçamento Inútil**: Nenhum caractere de espaço em branco (`\r`, `\n`, `\t`, ` `) existe fora de literais de string.
4. **Resistência a Adulteração**: Um único caractere alterado no payload resulta em falha de hash SHA-256 e invalidação imediata da assinatura Ed25519.

---

## 5. Matriz de Defesa Contra Ataques Adversariais (100% Coberta)

| Vetor de Ataque | Mecanismo de Exploração | Resposta do VUA | Status de Auditoria |
| :--- | :--- | :--- | :--- |
| **FORGE** | Tentativa de fabricar uma prova com `executed: true` sem executar de fato. | Falha de assinatura Ed25519. Verificador rejeita (`SIGNATURE_INVALID`). | ✅ PASS |
| **REPLAY** | Captura de requisição legítima anterior e reenvio para duplicar efeitos colaterais. | Cache de `request_id` (Nonce) detecta duplicação e rejeita (`REPLAY_REJECTED`). | ✅ PASS |
| **ESCALATE** | Agente tenta invocar `branch.write` ou `git.push` sem política ou aprovação humana. | O avaliador de política bloqueia a ação (`POLICY_DENIED`), emitindo prova com `executed: false`. | ✅ PASS |
| **ESCAPE** | Ataque de escape de diretório (`../../etc/shadow` ou links simbólicos). | O subsistema de Sandbox analisa o caminho canônico (`realpath`) e bloqueia (`SANDBOX_DENIED`). | ✅ PASS |
| **TAMPER** | Modificação dos arquivos no disco após a emissão da prova criptográfica. | O `output_hash` diverge do estado real do arquivo, gerando alerta de integridade (`HASH_MISMATCH`). | ✅ PASS |

---

## 6. Sandboxing e Limites Operacionais (GOS3 Engine)

O motor de governança de recursos GOS3 impõe tetos rígidos para qualquer processo gerado:
- **Timeout Máximo**: 10.000 ms por operação de conector padrão (ajustável por política).
- **Limite de Memória RAM**: 512 MB a 2048 MB (conforme baseline de hardware).
- **Sistema de Arquivos Restrito**: Somente diretórios aprovados (`/workspace/vortex`, `/tmp/vortex-sandbox` e o diretório de trabalho corrente).
- **Rede Delimitada**: Conexões externas restritas a endpoints declarados (ex.: `api.github.com`, serviços autorizados).

---

## 7. Baseline Dinâmica de Hardware (Gadget Auto-Config)

Para garantir que a segurança não degrade o desempenho em hardware modesto:
1. O VUA detecta a arquitetura de execução (`MOBILE_TERMUX`, `EMBEDDED_EDGE`, `DESKTOP_DEV`, `HIGH_PERF_CLOUD`).
2. Ajusta as tolerâncias de jitter de latência criptográfica (±5% na nuvem até ±35% no Termux).
3. Calcula a concorrência segura de threads para evitar esgotamento de memória (OOM).
4. Emite um certificado assinado em Ed25519 via `vua baseline` ou `GET /api/vua/baseline/hardware`.

---

## 8. Procedimento de Auditoria de Provas

Para auditar qualquer prova emitida pelo VUA:
```bash
# Via CLI local
npx tsx bin/vua.js verify --proof path/to/proof.json

# Via Teste Automatizado de Segurança
npm run test:security
```

Toda auditoria executará:
1. Validação de esquema JSON Schema v1.
2. Canonicalização do payload sem campos de assinatura.
3. Resolução da chave pública e verificação criptográfica Ed25519.
4. Verificação de hash de entrada e saída (SHA-256).
5. Checagem de integridade temporal (`started_at <= completed_at`).
