import Base

# ==============================================================================
# VORTEX UNIVERSAL ADAPTER (VUA) - FORMAL GOVERNANCE & ACTION AUTHORIZATION
# ==============================================================================
# Specification: VUA Formal Policy for Action Authorization
# Compliant with: Vortex Agent Governance Contract (RFC 8785 / Ed25519)
#
# Core Principles:
# 1. Read-only actions (Inspect, Verify, Propose) are non-mutating and authorized.
# 2. Mutating actions (BranchWrite, ExecuteCommand) require explicit human approval tokens.
# 3. Actions with insufficient permissions are rejected regardless of approval tokens.
# 4. Prohibited actions (MergeMain, Publish) are categorically rejected under all conditions.
# ==============================================================================

# ------------------------------------------------------------------------------
# 1. Type Definitions: Permission & Action
# ------------------------------------------------------------------------------

# Permission levels granted to an agent or principal
type Permission is Data:
  Read{}
  Write{}
  Admin{}

# Governed actions modeled after VUA operations
type Action is Data:
  Inspect{}
  Verify{}
  Propose{}
  BranchWrite{}
  ExecuteCommand{}
  MergeMain{}
  Publish{}

# ------------------------------------------------------------------------------
# 2. Authorization Logic: check_approval
# ------------------------------------------------------------------------------
# Evaluates whether an Action requested under a given Permission and approval state
# is allowed (True{}) or denied (False{}).
#
# Corresponds to TypeScript: evaluatePolicy(operation, target, authContext, approvalToken)

def check_approval(act: Action, perm: Permission, has_token: Bool) -> Bool:
  match act:
    case Inspect{}:
      # Read-only inspection: permitted across all permissions without approval
      True{}
    case Verify{}:
      # Read-only verification: permitted across all permissions without approval
      True{}
    case Propose{}:
      # Side-effect free proposal: permitted across all permissions without approval
      True{}
    case MergeMain{}:
      # Direct merge to main branch is strictly prohibited by policy
      False{}
    case Publish{}:
      # Direct publish operation is strictly prohibited by policy
      False{}
    case BranchWrite{}:
      # Branch mutation: requires Write or Admin permission AND human approval token
      match perm:
        case Read{}:
          False{}
        case Write{}:
          has_token
        case Admin{}:
          has_token
    case ExecuteCommand{}:
      # Command execution: requires Write or Admin permission AND human approval token
      match perm:
        case Read{}:
          False{}
        case Write{}:
          has_token
        case Admin{}:
          has_token

# ------------------------------------------------------------------------------
# 3. Mechanical Laws & Formal Proofs (Verification at Compile Time)
# ------------------------------------------------------------------------------

# Law 1: Non-repudiation / Unapproved mutation rejection
# BranchWrite without an approval token MUST be strictly denied under any permission.
law law_unapproved_write_denied:
  for p: Permission
  {check_approval(BranchWrite{}, p, False{}) == False{} : Bool}

def law_unapproved_write_denied(p):
  match p:
    case Read{}:
      {==}
    case Write{}:
      {==}
    case Admin{}:
      {==}

# Law 2: Read-only access preservation
# Inspect action is always allowed regardless of permission level or token state.
law law_inspect_always_allowed:
  for p: Permission
  for t: Bool
  {check_approval(Inspect{}, p, t) == True{} : Bool}

def law_inspect_always_allowed(p, t):
  match p:
    case Read{}:
      {==}
    case Write{}:
      {==}
    case Admin{}:
      {==}

# Law 3: Read-only permission cannot mutate
# A Read-only permission can NEVER authorize a BranchWrite, even if a token is present.
law law_read_permission_cannot_mutate:
  for t: Bool
  {check_approval(BranchWrite{}, Read{}, t) == False{} : Bool}

def law_read_permission_cannot_mutate(t):
  match t:
    case True{}:
      {==}
    case False{}:
      {==}

# Law 4: Approved mutation compliance
# BranchWrite with Write permission and valid approval token is always permitted.
law law_approved_write_allowed:
  for u: Unit
  {check_approval(BranchWrite{}, Write{}, True{}) == True{} : Bool}

def law_approved_write_allowed(u):
  match u:
    case Unit{}:
      {==}

# Law 5: Merge to Main branch prohibition
# MergeMain is categorically denied for any permission level and token state.
law law_merge_main_strictly_prohibited:
  for p: Permission
  for t: Bool
  {check_approval(MergeMain{}, p, t) == False{} : Bool}

def law_merge_main_strictly_prohibited(p, t):
  match p:
    case Read{}:
      {==}
    case Write{}:
      {==}
    case Admin{}:
      {==}

# Law 6: Publish prohibition
# Publish is categorically denied for any permission level and token state.
law law_publish_strictly_prohibited:
  for p: Permission
  for t: Bool
  {check_approval(Publish{}, p, t) == False{} : Bool}

def law_publish_strictly_prohibited(p, t):
  match p:
    case Read{}:
      {==}
    case Write{}:
      {==}
    case Admin{}:
      {==}

# ------------------------------------------------------------------------------
# 4. Differential Test Suite (10 Canonical Vectors vs TypeScript evaluatePolicy)
# ------------------------------------------------------------------------------
# Test vectors evaluate identical scenarios against the TypeScript policy engine:

# Vector 1: Read-only inspection without approval token
# TS: evaluatePolicy('inspect', undefined, undefined, undefined) -> allowed: true
def vector_1_inspect_read() -> Bool:
  check_approval(Inspect{}, Read{}, False{})

# Vector 2: Read-only verification without approval token
# TS: evaluatePolicy('verify', undefined, undefined, undefined) -> allowed: true
def vector_2_verify_read() -> Bool:
  check_approval(Verify{}, Read{}, False{})

# Vector 3: Safe proposal without approval token
# TS: evaluatePolicy('propose', undefined, undefined, undefined) -> allowed: true
def vector_3_propose_read() -> Bool:
  check_approval(Propose{}, Read{}, False{})

# Vector 4: Branch write without approval token
# TS: evaluatePolicy('branch.write', { branch: 'feat/x' }, authContext, undefined) -> allowed: false
def vector_4_branch_write_unapproved() -> Bool:
  check_approval(BranchWrite{}, Write{}, False{})

# Vector 5: Branch write with verified human approval token
# TS: evaluatePolicy('branch.write', { branch: 'feat/x' }, authContext, 'vortex-approved-human') -> allowed: true
def vector_5_branch_write_approved() -> Bool:
  check_approval(BranchWrite{}, Write{}, True{})

# Vector 6: Branch write attempted with read-only permission (token present)
# TS: evaluatePolicy with capability 'repository.read' -> allowed: false (not granted)
def vector_6_branch_write_read_permission() -> Bool:
  check_approval(BranchWrite{}, Read{}, True{})

# Vector 7: Execute command with Admin permission and approval token
# TS: evaluatePolicy with capability 'vua.adapter.execute' and approval -> allowed: true
def vector_7_execute_admin_approved() -> Bool:
  check_approval(ExecuteCommand{}, Admin{}, True{})

# Vector 8: Execute command with Read permission and no token
# TS: evaluatePolicy without approval and read capability -> allowed: false
def vector_8_execute_read_unapproved() -> Bool:
  check_approval(ExecuteCommand{}, Read{}, False{})

# Vector 9: Merge to main branch with Admin permission and token
# TS: evaluatePolicy('branch.write', { branch: 'main' }, authContext, token) -> allowed: false (prohibited)
def vector_9_merge_main_prohibited() -> Bool:
  check_approval(MergeMain{}, Admin{}, True{})

# Vector 10: Publish with Admin permission and token
# TS: policy.prohibited_operations includes 'repository.publish' -> allowed: false (prohibited)
def vector_10_publish_prohibited() -> Bool:
  check_approval(Publish{}, Admin{}, True{})

# Evaluator for individual vector expectations:
# Computes True{} if all 10 vectors match their expected Boolean outcome.
def run_differential_suite() -> Bool:
  v1 = vector_1_inspect_read()                # Expected: True{}
  v2 = vector_2_verify_read()                 # Expected: True{}
  v3 = vector_3_propose_read()                # Expected: True{}
  v4 = vector_4_branch_write_unapproved()     # Expected: False{}
  v5 = vector_5_branch_write_approved()       # Expected: True{}
  v6 = vector_6_branch_write_read_permission()# Expected: False{}
  v7 = vector_7_execute_admin_approved()      # Expected: True{}
  v8 = vector_8_execute_read_unapproved()     # Expected: False{}
  v9 = vector_9_merge_main_prohibited()       # Expected: False{}
  v10 = vector_10_publish_prohibited()        # Expected: False{}

  pass1 = v1
  pass2 = v2
  pass3 = v3
  pass4 = Bool.not(v4)
  pass5 = v5
  pass6 = Bool.not(v6)
  pass7 = v7
  pass8 = Bool.not(v8)
  pass9 = Bool.not(v9)
  pass10 = Bool.not(v10)

  Bool.and(pass1,
    Bool.and(pass2,
      Bool.and(pass3,
        Bool.and(pass4,
          Bool.and(pass5,
            Bool.and(pass6,
              Bool.and(pass7,
                Bool.and(pass8,
                  Bool.and(pass9, pass10)))))))))

# Main entry point: runs the differential test suite and returns True{} on 100% parity
def main() -> Bool:
  run_differential_suite()
