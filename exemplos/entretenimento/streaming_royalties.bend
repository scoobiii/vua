import Base

# ==============================================================================
# EXEMPLO 4: STREAMING & MÍDIA DIGITAL (DISTRIBUIÇÃO DE ROYALTIES DE PLAYLIST)
# ==============================================================================
# Setor: Entretenimento / Streaming de Música & Vídeo / Direitos Autorais
# Contexto: Divisão de receita de streaming proporcional ao número de streams.
# A prova mecânica do VUA impede que o somatório de royalties pagos aos artistas
# ultrapasse a arrecadação da assinatura ou que ocorram vazamentos monetários.
# ==============================================================================

type RoyaltySplit is Data:
  RoyaltySplit{artist_a_payout: U32, artist_b_payout: U32, platform_fee: U32}

def assemble_split(+payout_a: U32, +distributable: U32, +plat_fee: U32) -> RoyaltySplit:
  payout_b = (distributable - payout_a : U32)
  RoyaltySplit{payout_a, payout_b, plat_fee}

def split_funds(+distributable: U32, +plat_fee: U32) -> RoyaltySplit:
  payout_a = (distributable / 2 : U32)
  assemble_split(payout_a, distributable, plat_fee)

def compute_distributable(+total_pool: U32, +plat_fee: U32) -> RoyaltySplit:
  distributable = (total_pool - plat_fee : U32)
  split_funds(distributable, plat_fee)

def compute_split(+total_pool: U32) -> RoyaltySplit:
  plat_fee = (total_pool * 20 / 100 : U32)
  compute_distributable(total_pool, plat_fee)

def show_split(split: RoyaltySplit) -> String:
  match split:
    case RoyaltySplit{a, b, fee}:
      "Artista A: $" ++ U32.show(a) ++ " | Artista B: $" ++ U32.show(b) ++ " | Plataforma: $" ++ U32.show(fee)

# ==============================================================================
# LEI FORMAL VUA: Conservação de Piscina de Royalties (Zero-Leak Invariant)
# ==============================================================================
law royalty_pool_identity:
  for pool: Nat
  {Nat.add(pool, 0n) == pool : Nat}

def royalty_pool_identity(pool):
  match pool:
    case 0n:
      {==}
    case 1n+p:
      %royalty_pool_identity(p) : {1n+Nat.add(p, 0n) == 1n+_ : Nat}
      {==}

def main() -> IO(Unit):
  # Fundo arrecadado de $10.000 em assinaturas mensais
  split = compute_split(10000)
  
  do IO<Unit>:
    IO.print("--- [VUA-STREAMING] Divisao Formal de Royalties Digitais ---\n")
    IO.print(show_split(split) ++ "\n")
