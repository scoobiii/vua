# Bend × VUA × GOS3 — 10 Vetores de Governança via MCP

**GOS3 CONTRACT HEADER**  
**document:** `docs/BEND-VUA-GOS3-MCP-THREAD.md`  
**version:** 1.0.0  
**status:** PR / review required  
**author:** GOS3  
**date:** 2026-09-21  
**scope:** Bend specification × VUA MCP governance × execution evidence

## Objetivo

Documentar os dez vetores usados para explicar e testar a fronteira entre:

- **Bend:** especificação/prova de propriedades;
- **VUA:** governança e execução verificável;
- **GOS3:** identidade, autorização e evidência auditável.

A propriedade central é:

```text
Bend rule
   ↓
VUA policy
   ↓
MCP operation
   ↓
execution/evidence
   ↓
verification
```

## MCP contract observado

O servidor MCP do VUA expõe atualmente:

- `vortex.inspect`
- `vortex.prepare_patch`
- `vortex.push_branch`
- `vortex.create_pull_request`
- `llm.execute`
- `llm.validate`
- `llm.query`
- `llm.summarize`

As operações de escrita exigem credenciais e, quando aplicável, approval token; o servidor falha fechado quando `GITHUB_TOKEN` não está disponível.

## Dez vetores

| # | Vetor | Operação MCP / política | Esperado |
|---:|---|---|---|
| 1 | Inspect somente leitura | `vortex.inspect` | **ALLOW** |
| 2 | Preparação de patch | `vortex.prepare_patch` | **ALLOW**, sem mutação remota |
| 3 | Proposta sem execução | `prepare_patch` + digest | **ALLOW** |
| 4 | Write sem aprovação | `vortex.push_branch` sem token | **DENY** |
| 5 | Write aprovado | `vortex.push_branch` com approval válido | **ALLOW**, sujeito à policy |
| 6 | Capability inadequada | write usando escopo de leitura | **DENY** |
| 7 | Execução governada | `llm.execute` | **ALLOW** somente dentro do escopo |
| 8 | Execução com read-only | execute sob capability de leitura | **DENY** |
| 9 | Escrita direta em `main` | branch protection / policy | **DENY** |
| 10 | Publicação proibida | `publish` fora da policy | **DENY** |

## Vetor 1 — Inspect

Chamada:

```json
{
  "method": "tools/call",
  "params": {
    "name": "vortex.inspect",
    "arguments": {
      "owner": "scoobiii",
      "repo": "vua"
    }
  }
}
```

Invariante:

```text
inspect → read-only → no remote mutation
```

## Vetor 2 — Prepare patch

```json
{
  "method": "tools/call",
  "params": {
    "name": "vortex.prepare_patch",
    "arguments": {
      "branch": "feat/bend-governance",
      "head_sha": "<HEAD_SHA>",
      "changed_files": [
        "src/vortex/policy.ts"
      ]
    }
  }
}
```

Invariante:

```text
prepare_patch → deterministic diff/digest → no remote mutation
```

## Vetor 3 — Propose sem executar

A proposta deve produzir um artefato/digest verificável sem transformar a proposta em escrita remota.

```text
proposal ≠ execution
```

Esse é o primeiro ponto de integração conceitual com Bend: a regra pode ser especificada formalmente antes de permitir o efeito colateral.

## Vetor 4 — Write sem aprovação

```json
{
  "method": "tools/call",
  "params": {
    "name": "vortex.push_branch",
    "arguments": {
      "owner": "scoobiii",
      "repo": "vua",
      "branch": "feat/unauthorized-test"
    }
  }
}
```

Esperado:

```text
DENY
credential/approval missing
```

## Vetor 5 — Write aprovado

A operação equivalente com approval válido deve satisfazer:

```text
valid credential
+
valid approval
+
allowed target
+
allowed operation
→ ALLOW
```

Approval não deve ser interpretado como permissão universal.

## Vetor 6 — Capability inadequada

```text
repository.read
      ≠
repository.write
```

Mesmo que exista um token, uma capability de leitura não deve autorizar uma mutação.

## Vetor 7 — Execução governada

```json
{
  "method": "tools/call",
  "params": {
    "name": "llm.execute",
    "arguments": {
      "instruction": "Execute somente dentro do escopo autorizado e produza evidência da execução.",
      "target_path": "src/vortex/"
    }
  }
}
```

O contrato do VUA retorna `execution_proof` no resultado da execução governada.

A propriedade desejada é:

```text
execution
   ↓
execution_proof
   ↓
verification
```

e não simplesmente:

```text
"executed": true
```

## Vetor 8 — Execução com capability de leitura

```text
repository.read
+
execute
→ DENY
```

Esse vetor testa separação de privilégios.

## Vetor 9 — Main

A existência de approval não deve permitir bypass da proteção da branch principal:

```text
approval = valid
branch = main
operation = write
→ DENY
```

A política deve considerar pelo menos:

```text
identity
+
capability
+
operation
+
target
+
policy
```

## Vetor 10 — Publish

```text
approval = valid
operation = publish
policy = prohibited
→ DENY
```

O token não deve transformar uma operação explicitamente proibida em permitida.

## Relação Bend × VUA

A divisão de responsabilidade é:

```text
BEND
  │
  └── especifica/prova invariantes
          │
          ▼
VUA
  │
  └── aplica governança no runtime/MCP
          │
          ▼
EXECUTION
  │
  └── produz evidência
          │
          ▼
GOS3
  │
  └── identidade + autorização + auditoria
```

Portanto:

> **Bend prova propriedades do programa. VUA governa a execução. GOS3 transforma a execução governada em evidência auditável.**

## Status de execução

Este documento registra o **contrato e o procedimento reproduzível** dos dez vetores.

Não deve ser interpretado como relatório de uma execução MCP real nesta sessão quando não houver um `ExecutionProof` correspondente anexado ao resultado.

Para uma execução auditável, cada vetor deve registrar:

```text
vector_id
operation
input_hash
policy_version
decision
execution_proof_id
verification_status
timestamp
```

A ausência dessa evidência deve ser tratada como **não comprovado**, não como PASS.

## Assinatura

```text
GOS3
Governed Execution / Evidence Specification
```

**GOS3**
