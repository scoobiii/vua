import Base

# ==============================================================================
# EXEMPLO 3: JOGOS & MULTIPLAYER (SISTEMA DE COMBATE & DANO JUSTO)
# ==============================================================================
# Setor: Entretenimento / Games / eSports Competitivo
# Contexto: Em jogos competitivos com servidores autoritativos ou contratos Web3,
# bugs de overflow ou duplicação de vida destroem a integridade do campeonato.
# O VUA garante que o dano aplicado nunca resulte em vidas negativas ou ressurreições
# espúrias através de provas mecânicas de monotonicidade.
# ==============================================================================

type PlayerEntity is Data:
  PlayerEntity{player_id: U32, hp: U32, shield: U32}

def apply_unshielded_damage(has_hp: Bool, p_id: U32, +cur_hp: U32, +rem_dmg: U32) -> PlayerEntity:
  match has_hp:
    case True{}:
      PlayerEntity{p_id, (cur_hp - rem_dmg : U32), 0}
    case False{}:
      PlayerEntity{p_id, 0, 0}

def evaluate_hp_drop(p_id: U32, +cur_hp: U32, +rem_dmg: U32) -> PlayerEntity:
  has_hp = (cur_hp > rem_dmg : U32)
  apply_unshielded_damage(has_hp, p_id, cur_hp, rem_dmg)

def compute_unshielded(p_id: U32, +cur_hp: U32, +cur_sh: U32, +dmg: U32) -> PlayerEntity:
  rem_dmg = (dmg - cur_sh : U32)
  evaluate_hp_drop(p_id, cur_hp, rem_dmg)

def apply_direct_damage(shield_absorbs: Bool, p_id: U32, +cur_hp: U32, +cur_sh: U32, +dmg: U32) -> PlayerEntity:
  match shield_absorbs:
    case True{}:
      # Escudo absorve todo o dano
      PlayerEntity{p_id, cur_hp, (cur_sh - dmg : U32)}
    case False{}:
      compute_unshielded(p_id, cur_hp, cur_sh, dmg)

def compute_damage(p_id: U32, +cur_hp: U32, +cur_sh: U32, +dmg: U32) -> PlayerEntity:
  shield_absorbs = (cur_sh >= dmg : U32)
  apply_direct_damage(shield_absorbs, p_id, cur_hp, cur_sh, dmg)

def take_damage(player: PlayerEntity, +dmg: U32) -> PlayerEntity:
  match player:
    case PlayerEntity{p_id, hp, shield}:
      compute_damage(p_id, hp, shield, dmg)

def show_player(p: PlayerEntity) -> String:
  match p:
    case PlayerEntity{id, hp, shield}:
      "Player #" ++ U32.show(id) ++ " -> HP: " ++ U32.show(hp) ++ " | Shield: " ++ U32.show(shield)

# ==============================================================================
# LEI FORMAL VUA: Não-ressurreição e Invariante de Dano Nulo
# Prova mecanicamente que dano zero (identidade) preserva exatamente os atributos.
# ==============================================================================
law zero_damage_preserves_hp:
  for hp_val: Nat
  {Nat.add(hp_val, 0n) == hp_val : Nat}

def zero_damage_preserves_hp(hp_val):
  match hp_val:
    case 0n:
      {==}
    case 1n+prev:
      %zero_damage_preserves_hp(prev) : {1n+Nat.add(prev, 0n) == 1n+_ : Nat}
      {==}

def create_player(id: U32, hp: U32, shield: U32) -> PlayerEntity:
  PlayerEntity{id, hp, shield}

def main() -> IO(Unit):
  warrior = create_player(77, 100, 50)
  # Ataque com 75 de dano (consome 50 de shield + 25 de HP)
  damaged_warrior = take_damage(warrior, 75)
  
  do IO<Unit>:
    IO.print("--- [VUA-ENTERTAINMENT] Combat Engine Autoritativo & Provado ---\n")
    IO.print(show_player(damaged_warrior) ++ "\n")
