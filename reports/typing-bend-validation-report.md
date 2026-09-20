# Relatório de Correções de Tipagem e Validação do Suporte Bend

**Projeto:** VUA — Vortex Universal Adapter  
**Revisão analisada:** `c1f1e8d` (`feat: implement vua_governance.bend and differential testing`)  
**Data da validação:** 20 de setembro de 2026  
**Responsável pelo relatório:** Manus AI

## Resumo executivo

O suporte Bend introduziu uma operação de governança chamada `publish` e passou a construir contextos de autorização dentro do adaptador Bend. A implementação, entretanto, não atualizou completamente o contrato TypeScript que define as operações do VUA nem preencheu todos os campos obrigatórios de `AuthorizationContext`. Como consequência, o compilador TypeScript interrompia o lint com quatro erros distribuídos entre o adaptador, o motor de políticas e o teste diferencial Bend–TypeScript.

A correção foi feita sem alterar a regra de segurança. A operação `publish` foi incorporada ao tipo normativo `VortexOperation`, enquanto os contextos criados pelo adaptador Bend passaram a incluir a versão da política e o escopo de autorização. A política já tratava `publish` como operação proibida; portanto, a mudança tornou explícito no sistema de tipos um comportamento que já fazia parte da especificação de governança.

Após a correção, o `tsc --noEmit` passou sem erros. As suítes unitária, de integração, de política e de detecção de mocks também passaram. O teste diferencial formal verificou que o arquivo `vua_governance.bend` continua compilando, retorna `True{}` no runtime Bend e mantém paridade de decisão em **10 de 10 vetores**.

## Escopo e estado inicial

A análise concentrou-se no suporte Bend e nos arquivos diretamente envolvidos na comparação entre a política formal Bend e a implementação TypeScript. Os principais componentes foram:

- `src/vortex/types.ts`, que define `VortexOperation` e `AuthorizationContext`;
- `src/vortex/adapters/bend.ts`, que executa os vetores diferenciais e chama `evaluatePolicy`;
- `src/vortex/policy.ts`, que implementa a decisão de autorização;
- `tests/vua-governance-differential.test.ts`, que compara as decisões Bend e TypeScript;
- `vua_governance.bend`, que contém a especificação formal e os vetores de governança.

Antes da correção, o comando `npm run lint` produzia quatro erros de compilação. O problema não estava em uma falha de paridade observada em runtime. Tratava-se de uma divergência entre os contratos declarados nos tipos TypeScript e o comportamento já representado pelo código Bend e pela política.

## Erros encontrados

### Operação `publish` ausente do tipo normativo

`VortexOperation` aceitava apenas `inspect`, `propose`, `verify`, `execute` e `branch.write`. O adaptador Bend e o teste diferencial, contudo, usavam `publish` como uma operação válida para representar o vetor de publicação proibida.

Esse desacordo causava dois erros diretamente:

1. em `src/vortex/adapters/bend.ts`, o valor `v.ts_op` não podia ser passado para `evaluatePolicy` porque seu tipo incluía `publish`, mas `VortexOperation` não;
2. em `tests/vua-governance-differential.test.ts`, `ts_op: 'publish'` não era aceito no campo declarado como `VortexOperation`.

O erro adicional em `src/vortex/policy.ts` tinha a mesma origem. O código comparava `operation` com `'publish'`, mas o tipo informado ao compilador não permitia esse valor.

### Contexto de autorização incompleto no adaptador Bend

`AuthorizationContext` exige seis campos básicos: `principal_id`, `agent_id`, `policy_id`, `policy_version`, `capability` e `scope`. Dois objetos criados em `src/vortex/adapters/bend.ts` forneciam apenas parte desses campos.

O primeiro contexto era usado na avaliação dos vetores de governança. O segundo era usado na avaliação dos vetores de política do adaptador. Ambos omitiam `policy_version` e `scope`, o que produzia um erro TypeScript no segundo ponto e deixava o primeiro contexto incompatível com o contrato completo.

A omissão era especialmente relevante porque a decisão de política é escopo-dependente. Um contexto sem escopo não representa completamente a autorização que está sendo avaliada, mesmo quando o teste utiliza um repositório conhecido.

## Correções aplicadas

### Inclusão de `publish` em `VortexOperation`

O tipo foi atualizado de:

```ts
export type VortexOperation =
  | 'inspect'
  | 'propose'
  | 'verify'
  | 'execute'
  | 'branch.write';
```

para:

```ts
export type VortexOperation =
  | 'inspect'
  | 'propose'
  | 'verify'
  | 'execute'
  | 'branch.write'
  | 'publish';
```

Essa alteração não autoriza a publicação. Ela apenas permite que o tipo represente uma operação que a política pode avaliar e rejeitar.

A política padrão mantém `repository.publish` na lista de operações proibidas. O vetor diferencial continua esperando uma decisão negativa para `publish` com credenciais administrativas e token de aprovação. Portanto, a mudança amplia a precisão do contrato de tipos sem ampliar permissões.

### Preenchimento dos contextos Bend

Os dois contextos de autorização do adaptador passaram a incluir:

```ts
policy_version: DEFAULT_DEV_POLICY.version,
scope: { repositories: ['scoobiii/vortex'] },
```

O `policy_version` identifica a versão efetiva da política usada na avaliação. O `scope` delimita explicitamente o repositório usado pelos vetores diferenciais. A estrutura agora corresponde ao contrato `AuthorizationContext` e representa melhor a autorização que está sendo testada.

### Preservação dos vetores diferenciais

O vetor `vector_10` continuou usando:

```ts
ts_op: 'publish',
ts_cap: 'repository.write',
expected_decision: false,
```

Nenhum vetor foi removido, relaxado ou convertido em uma exceção de tipo. A finalidade do teste permanece a mesma: provar que a decisão formal Bend e a decisão TypeScript negam a operação proibida de publicação.

## Validação realizada

### Verificação de tipos

O comando abaixo foi executado após as alterações:

```bash
npm run lint
```

Resultado:

```text
> tsc --noEmit
```

O comando terminou com código de saída zero e não produziu erros TypeScript.

### Testes unitários

```bash
npm run test:unit
```

Resultado: **13 de 13 testes aprovados**. A suíte confirmou, entre outros pontos, canonicalização RFC 8785, assinaturas Ed25519, políticas, sandbox, anti-replay, GOS3 e baseline dinâmica.

### Testes de integração

```bash
npm run test:integration
```

Resultado: **8 de 8 testes aprovados**. Foram aprovados o registro de adaptadores, a matriz de conformidade, o pipeline E2E, os canários de efeitos colaterais, o gateway LLM, o ciclo de vida GOS3 e a matriz de adaptadores.

### Testes de política

```bash
npm run test:policy
```

Resultado: **33 de 33 testes aprovados**. A suíte confirmou as classificações de mudança, os vereditos de segurança, performance, governança e correção, além da desqualificação de um patch que viola o canário de segurança.

### Testes de detecção de mocks

```bash
npm run test:mock
```

Resultado: **4 de 4 testes aprovados**. A auditoria estática e dinâmica detectou zero mocks sintéticos no repositório e manteve os testes positivos de rejeição de mocks injetados.

### Teste diferencial Bend–TypeScript

O teste foi executado com o compilador Bend 2.0.20 disponível no `PATH`:

```bash
export PATH="$HOME/.bend/bin:$PATH"
BEND_NO_TELEMETRY=1 npm run test:diff
```

O resultado foi:

- verificação formal de `vua_governance.bend`: **PASS**;
- execução no runtime HVM Bend: **`True{}`**;
- vetores congruentes: **10/10**;
- geração e verificação independente da prova Ed25519: **PASS**.

Os dez vetores mantiveram paridade entre Bend e TypeScript. Em particular, o vetor de publicação continuou com decisão `DENY` nos dois lados.

| Vetor | Operação | Decisão Bend | Decisão TypeScript | Resultado |
|---|---|---:|---:|---:|
| `VECTOR_1` | `inspect` | ALLOW | ALLOW | Congruente |
| `VECTOR_2` | `verify` | ALLOW | ALLOW | Congruente |
| `VECTOR_3` | `propose` | ALLOW | ALLOW | Congruente |
| `VECTOR_4` | `branch.write` sem aprovação | DENY | DENY | Congruente |
| `VECTOR_5` | `branch.write` aprovado | ALLOW | ALLOW | Congruente |
| `VECTOR_6` | `branch.write` com capability de leitura | DENY | DENY | Congruente |
| `VECTOR_7` | `execute` aprovado | ALLOW | ALLOW | Congruente |
| `VECTOR_8` | `execute` sem aprovação | DENY | DENY | Congruente |
| `VECTOR_9` | `branch.write` em `main` | DENY | DENY | Congruente |
| `VECTOR_10` | `publish` proibido | DENY | DENY | Congruente |

## Impacto de segurança

A correção não transforma `publish` em uma operação permitida. A inclusão no tipo é necessária para que o motor de política possa representar explicitamente uma operação proibida. A decisão continua sendo `POLICY_DENIED` quando a política identifica publicação como operação proibida.

A inclusão de `scope` nos contextos Bend reforça o modelo de autorização. A comparação agora é executada com um repositório declarado, em vez de usar um contexto estruturalmente incompleto. Isso reduz o risco de que um teste de paridade valide apenas a operação e a capability, ignorando a delimitação do recurso.

A inclusão de `policy_version` também torna a avaliação mais auditável. O contexto passa a registrar qual versão da política está sendo usada, alinhando o teste com o modelo de provas de execução do VUA.

## Estado dos arquivos

As alterações permanecem locais no clone do projeto. O estado validado contém modificações apenas em:

- `src/vortex/types.ts`;
- `src/vortex/adapters/bend.ts`.

O teste diferencial já continha o vetor `publish` correto e não precisou de mudança funcional. O arquivo `src/vortex/policy.ts` também não precisou de alteração de lógica; o erro desapareceu quando o tipo `VortexOperation` passou a refletir corretamente os valores aceitos pela política.

## Limitações e observações

O teste diferencial exige que o compilador Bend esteja disponível no ambiente. Sem `bend` no `PATH`, o teste falha antes de avaliar os vetores, mesmo que o TypeScript esteja correto. Nesta validação, foi usado o Bend 2.0.20 instalado pelo instalador oficial.

A correção de tipagem não aborda outras falhas independentes observadas anteriormente no projeto. O runner de `worker_threads` ainda requer configuração adequada para executar arquivos TypeScript, e o gate consolidado de Multi-LLM depende de um provedor configurado. Essas questões não fazem parte dos quatro erros de tipagem corrigidos neste relatório.

## Conclusão

Os quatro erros de tipagem foram eliminados sem enfraquecer a política de autorização. O contrato TypeScript agora representa `publish` como operação válida para avaliação, enquanto a política continua proibindo essa operação. Os contextos Bend agora contêm versão de política e escopo completos.

A validação confirmou compilação TypeScript sem erros, aprovação das suítes diretamente afetadas e paridade formal completa entre Bend e TypeScript. O resultado final é uma integração Bend tipada de forma consistente, com **10/10 vetores diferenciais congruentes** e o vetor de publicação explicitamente rejeitado pelos dois runtimes.

## Referências

[1]: https://github.com/scoobiii/vua/blob/main/src/vortex/types.ts "VUA — Tipos normativos de operações e autorização"

[2]: https://github.com/scoobiii/vua/blob/main/src/vortex/adapters/bend.ts "VUA — Adaptador formal Bend"

[3]: https://github.com/scoobiii/vua/blob/main/src/vortex/policy.ts "VUA — Motor de políticas e autorização"

[4]: https://github.com/scoobiii/vua/blob/main/tests/vua-governance-differential.test.ts "VUA — Teste diferencial Bend–TypeScript"

[5]: https://github.com/scoobiii/vua/blob/main/vua_governance.bend "VUA — Especificação formal de governança em Bend"

[6]: https://www.typescriptlang.org/docs/handbook/2/everyday-types.html "TypeScript Handbook — Everyday Types"

[7]: https://bend-lang.com/ "Bend — Linguagem, compilador e documentação oficial"
