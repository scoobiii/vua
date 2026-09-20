# Exemplos de Aplicação Bend + VUA: Negócios e Entretenimento

Esta pasta reúne casos de uso práticos da linguagem **Bend** integrada à governança do **VUA (Vortex Universal Adapter)**, demonstrando como leis formais mecânicas (`law`) eliminam alucinações de modelos de linguagem e garantem integridade crítica em tempo de compilação.

---

## Estrutura da Pasta `exemplos/`

```tree
exemplos/
├── README.md
├── negocios/
│   ├── fintech_balance.bend         # Core Banking & Conservação de Saldos
│   └── logistica_inventory.bend     # Supply Chain & Anti-Overselling
└── entretenimento/
    ├── game_combat_damage.bend      # Games/eSports: Combate Autoritativo & HP Justo
    └── streaming_royalties.bend      # Mídia Digital: Divisão Zero-Leak de Royalties
```

---

## 1. Segmento de Negócios

### 1.1 `negocios/fintech_balance.bend` (Fintech & Core Banking)
- **Problema de Negócio**: Agentes autônomos ou microserviços não podem gerar dinheiro artificial ou duplicar saldos durante transferências interbancárias.
- **Solução Bend + VUA**:
  - Implementa um motor de liquidação contábil estrita.
  - Prova indutiva `balance_identity_invariant`: Garante conservação aditiva e invariância de liquidez.
- **Comando de Teste**:
  ```bash
  bend exemplos/negocios/fintech_balance.bend --check-only
  bend exemplos/negocios/fintech_balance.bend
  ```

### 1.2 `negocios/logistica_inventory.bend` (Supply Chain & Logística)
- **Problema de Negócio**: Separação de pedidos em e-commerce gerando *overselling* (vender mercadorias indisponíveis) devido a condições de corrida.
- **Solução Bend + VUA**:
  - Motor de alocação de lotes (`StockBatch`) com verificação formal de não-negatividade.
  - Lei `stock_conservation_law`: Prova mecânica de que unidades despachadas + reservadas + remanescentes equivalem ao lote físico.
- **Comando de Teste**:
  ```bash
  bend exemplos/negocios/logistica_inventory.bend --check-only
  bend exemplos/negocios/logistica_inventory.bend
  ```

---

## 2. Segmento de Entretenimento

### 2.1 `entretenimento/game_combat_damage.bend` (Games & eSports Competitivo)
- **Problema**: Em jogos multiplayer com economia real ou apostas competitivas, falhas de lógica podem causar ressurreições espúrias, duplicação de escudos ou HP negativo.
- **Solução Bend + VUA**:
  - Pipeline autoritativo de dano (`shield` -> `hp` -> `death`).
  - Lei `zero_damage_preserves_hp`: Prova que nenhuma perda de estado ou mutação ocorre sob estímulo nulo, garantindo monotonicidade estrita.
- **Comando de Teste**:
  ```bash
  bend exemplos/entretenimento/game_combat_damage.bend --check-only
  bend exemplos/entretenimento/game_combat_damage.bend
  ```

### 2.2 `entretenimento/streaming_royalties.bend` (Streaming de Música & Vídeo)
- **Problema**: Repasse de direitos autorais e royalties de streaming sujeitos a desvios decimais e vazamento financeiro de receita da assinatura.
- **Solução Bend + VUA**:
  - Divisão proporcional do fundo de assinantes (`RoyaltySplit`) entre criadores e plataforma.
  - Lei `royalty_pool_identity`: Prova formal de conservação do *pool* de royalties (`Zero-Leak Invariant`).
- **Comando de Teste**:
  ```bash
  bend exemplos/entretenimento/streaming_royalties.bend --check-only
  bend exemplos/entretenimento/streaming_royalties.bend
  ```

---

## Como Executar Todos os Exemplos

Execute o script de verificação global:
```bash
for f in exemplos/negocios/*.bend exemplos/entretenimento/*.bend; do
  echo "==> Verificando provas formais de $f..."
  bend "$f" --check-only
  echo "==> Executando $f..."
  bend "$f"
  echo ""
done
```
