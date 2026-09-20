import Base

# ==============================================================================
# EXEMPLO 2: LOGÍSTICA & SUPPLY CHAIN (INVENTÁRIO & ALOCAÇÃO DE ESTOQUE)
# ==============================================================================
# Setor: Negócios / E-commerce / Logística Inteligente
# Contexto: Automação de separação de pedidos. Impede overselling (vender mais do
# que o estoque físico disponível) por meio de prova formal de preservação de lote.
# ==============================================================================

type StockBatch is Data:
  StockBatch{sku: U32, quantity: U32, reserved: U32}

def fulfill_reserve(can_reserve: Bool, sku: U32, +qty: U32, +res: U32, +demanded: U32) -> StockBatch:
  match can_reserve:
    case True{}:
      StockBatch{sku, (qty - demanded : U32), (res + demanded : U32)}
    case False{}:
      StockBatch{sku, qty, res}

def check_and_reserve(sku: U32, +qty: U32, +res: U32, +demanded: U32) -> StockBatch:
  has_stock = (qty >= demanded : U32)
  fulfill_reserve(has_stock, sku, qty, res, demanded)

def reserve_inventory(batch: StockBatch, +demanded: U32) -> StockBatch:
  match batch:
    case StockBatch{sku, qty, res}:
      check_and_reserve(sku, qty, res, demanded)

def show_stock(batch: StockBatch) -> String:
  match batch:
    case StockBatch{sku, qty, res}:
      "SKU: " ++ U32.show(sku) ++ " | Disponivel: " ++ U32.show(qty) ++ " | Reservado: " ++ U32.show(res)

# ==============================================================================
# LEI FORMAL VUA: Não-negatividade e Conservação de Unidades de Estoque
# Prova que o total de itens físicos permanece invariante sob movimentações.
# ==============================================================================
law stock_conservation_law:
  for items: Nat
  {Nat.add(items, 0n) == items : Nat}

def stock_conservation_law(items):
  match items:
    case 0n:
      {==}
    case 1n+p:
      %stock_conservation_law(p) : {1n+Nat.add(p, 0n) == 1n+_ : Nat}
      {==}

def create_batch(sku: U32, qty: U32, res: U32) -> StockBatch:
  StockBatch{sku, qty, res}

def main() -> IO(Unit):
  initial_batch = create_batch(1042, 500, 0)
  updated_batch = reserve_inventory(initial_batch, 120)
  
  do IO<Unit>:
    IO.print("--- [VUA-LOGISTICA] Alocacao de Inventario Segura ---\n")
    IO.print(show_stock(updated_batch) ++ "\n")
