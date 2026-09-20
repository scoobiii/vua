import Base

# ==============================================================================
# Vortex Universal Adapter (VUA) - Formal Governance Laws & Invariants
# ==============================================================================
# Model of the VUA Policy Decision Logic:
# Actions are classified as mutable (True{}) or read-only (False{}).
# Approvals are represented as valid (True{}) or missing/expired (False{}).
#
# Core Policy Specification:
# - An action is ALLOWED (True{}) if it is read-only.
# - An action is ALLOWED (True{}) if it is mutable AND has a valid approval token.
# - An action is DENIED (False{}) if it is mutable AND lacks a valid approval token.

def policy_eval(is_mutable: Bool, has_approval: Bool) -> Bool:
  match is_mutable:
    case False{}:
      True{}
    case True{}:
      match has_approval:
        case False{}:
          False{}
        case True{}:
          True{}

# Law 1: Non-repudiation / No unapproved mutation
# Any mutable action lacking approval MUST be strictly denied (False{}).
law policy_denies_unapproved_mutation:
  for u: Unit
  {policy_eval(True{}, False{}) == False{} : Bool}

def policy_denies_unapproved_mutation(u):
  match u:
    case Unit{}:
      {==}

# Law 2: Read-only access preservation
# Any read-only action is always permitted regardless of approval token state.
law policy_allows_read_only:
  for approval: Bool
  {policy_eval(False{}, approval) == True{} : Bool}

def policy_allows_read_only(approval):
  match approval:
    case True{}:
      {==}
    case False{}:
      {==}

# Law 3: Authorized mutation compliance
# Any mutable action accompanied by a verified approval token is permitted.
law policy_allows_approved_mutation:
  for u: Unit
  {policy_eval(True{}, True{}) == True{} : Bool}

def policy_allows_approved_mutation(u):
  match u:
    case Unit{}:
      {==}

# ==============================================================================
# Mathematical Invariants (Foundation)
# ==============================================================================

# Law 4: Nat Addition with Zero (Additive identity invariant)
law nat_add_zero:
  for x: Nat
  {Nat.add(x, 0n) == x : Nat}

def nat_add_zero(x):
  match x:
    case 0n:
      {==}
    case 1n+xp:
      %nat_add_zero(xp) : {1n+Nat.add(xp, 0n) == 1n+_ : Nat}
      {==}

# Law 5: Boolean double negation invariant
law bool_not_not:
  for b: Bool
  {Bool.not(Bool.not(b)) == b : Bool}

def bool_not_not(b):
  match b:
    case True{}:
      {==}
    case False{}:
      {==}
