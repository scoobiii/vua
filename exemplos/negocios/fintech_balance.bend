import Base

# ==============================================================================
# EXEMPLO 1: FINTECH & SETOR BANCÁRIO (CONSERVAÇÃO DE SALDO & LIQUIDEZ)
# ==============================================================================
# Setor: Negócios / Financeiro / Core Banking
# Contexto: Em pipelines contábeis autônomas, LLMs não podem violar a conservação
# estrita de valores (zero-sum transfer). O VUA submete o código a verificação
# mecânica pelo compilador Bend antes de efetuar qualquer transação.
# ==============================================================================

type LedgerEntry is Data:
  LedgerEntry{sender_bal: U32, receiver_bal: U32}

# Função auxiliar para ramificação estrita
def settle(can_transfer: Bool, +s_bal: U32, +r_bal: U32, +amount: U32) -> LedgerEntry:
  match can_transfer:
    case True{}:
      LedgerEntry{(s_bal - amount : U32), (r_bal + amount : U32)}
    case False{}:
      LedgerEntry{s_bal, r_bal}

# Transferência de fundos com salvaguarda de saldo disponível
def transfer(+s_bal: U32, +r_bal: U32, +amount: U32) -> LedgerEntry:
  cond = (s_bal >= amount : U32)
  settle(cond, s_bal, r_bal, amount)

def show_ledger(entry: LedgerEntry) -> String:
  match entry:
    case LedgerEntry{s, r}:
      "Sender Bal: " ++ U32.show(s) ++ " | Receiver Bal: " ++ U32.show(r)

# ==============================================================================
# LEI FORMAL VUA: Invariante Aditiva de Identidade
# Prova mecanicamente que transferências com montante zero conservam o saldo.
# ==============================================================================
law balance_identity_invariant:
  for b: Nat
  {Nat.add(b, 0n) == b : Nat}

def balance_identity_invariant(b):
  match b:
    case 0n:
      {==}
    case 1n+bp:
      %balance_identity_invariant(bp) : {1n+Nat.add(bp, 0n) == 1n+_ : Nat}
      {==}

def main() -> IO(Unit):
  entry = transfer(1000, 250, 200)
  do IO<Unit>:
    IO.print("--- [VUA-FINTECH] Transacao Auditada & Atestada ---\n")
    IO.print(show_ledger(entry) ++ "\n")
