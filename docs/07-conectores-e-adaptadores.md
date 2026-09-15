# 🔌 07. Catálogo Completo de Conectores e Adaptadores do VUA

O **VUA (Vortex Universal Connector)** implementa uma arquitetura modular de governança que separa rigorosamente a camada de transporte/protocolo (**Conectores**) da camada de ecossistema e ambiente de execução (**Adaptadores**).

Toda e qualquer invocação realizada através de conectores ou adaptadores segue as quatro garantias invariantes do protocolo VUA:
1. **Isolamento de Sandbox**: Bounded filesystem, memory limits e timeout rigoroso.
2. **Avaliação Normativa de Políticas**: Checagem de capacidades (`evaluatePolicy`) e proibição de operações sensíveis sem token de aprovação.
3. **Prova Criptográfica Ed25519**: Emissão do `ExecutionProof v1` assinado deterministicamente via RFC 8785 (JSON Canonicalization Scheme - JCS).
4. **Auditabilidade Independente**: Verificação matemática de assinaturas, hashes de entrada/saída (`sha256:`) e integridade de sessão GOS3.

---

## 1. Conectores de Sistema e Protocolo (System Connectors)

Os conectores operam na camada do **Gateway de Execução Vortex** (`src/vortex/gateway.ts`), mediando as chamadas entre agentes e o ambiente físico ou distribuído.

| Conector | ID de Registro | Finalidade | Garantias de Segurança |
| :--- | :--- | :--- | :--- |
| **Filesystem Connector** | `connector:filesystem` | Leitura e escrita de arquivos, análise de diffs e persistência de branches. | Restrição estrita às raízes autorizadas (`/tmp/vortex-sandbox`, `/app/applet`, `/workspace/vortex`), bloqueio contra path traversal (`../`) e symlink escapes. |
| **Governed Runtime Connector** | `connector:governed-runtime` | Execução de comandos, inspeção de estado do runtime e medição de recursos. | Execução não-root, bound timeouts com cancelamento forçado, auditoria de código de saída e hash de output. |
| **Model Context Protocol (MCP)** | `connector:mcp` | Servidor JSON-RPC 2.0 padrão para editores e agentes externos (Cursor, Claude Desktop, VS Code, Cline, Roo Code). | Exposição de ferramentas governadas (`vortex.inspect`, `vortex.propose`, `vortex.verify`, `vortex.execute`, `vortex.branch.write`). |
| **LLM Gateway Connector** | `connector:llm` | Roteamento governado para modelos de linguagem em nuvem e locais. | Chaves de API mantidas exclusivamente server-side (Gemini), suporte a Ollama local e fila serial para Llama.cpp em chips ARM. |

---

## 2. Adaptadores Universais (`IVUAAdapter`)

Os adaptadores implementam a interface `IVUAAdapter` e são orquestrados centralmente pelo **`vuaRegistry`** (`src/vortex/adapters/registry.ts`).

```
                              ┌─────────────────────────┐
                              │  vuaRegistry.invoke()   │
                              └────────────┬────────────┘
                                           │
         ┌───────────────────┬─────────────┴───────────┬───────────────────┐
         ▼                   ▼                         ▼                   ▼
  ┌──────────────┐    ┌──────────────┐          ┌──────────────┐    ┌──────────────┐
  │    github    │    │    linux     │          │   android    │    │   windows    │
  │  (Cloud VCS) │    │(POSIX Linux) │          │(AOSP Android)│    │  (Win32/NT)  │
  └──────────────┘    └──────────────┘          └──────────────┘    └──────────────┘
```

---

### A. Adaptador GitHub (`github`)
- **Ambiente**: Cloud VCS
- **Versão**: `1.2.0`
- **Capacidades**: `repository.read`, `repository.propose`, `repository.write`, `vua.adapter.read`, `vua.adapter.execute`
- **Autenticação Suportada**: Personal Access Token (PAT) ou GitHub App Oficial (JWT RS256 + token efêmero).

#### Ações Disponíveis:
| Ação | Risco | Requer Aprovação | Descrição |
| :--- | :--- | :--- | :--- |
| `inspect_repo` | `read` | Não | Inspeciona branches padrão, regras de proteção e políticas do repositório. |
| `verify_commit` | `read` | Não | Valida assinaturas de commits Git (PGP / SSH / Sigstore) e hash de árvore SHA-256. |
| `propose_pr` | `read` | Não | Gera proposta determinística de Pull Request sem alterar o estado do repositório remoto. |
| `inspect_workflows` | `read` | Não | Audita arquivos de CI em `.github/workflows` e valida atestações de segurança. |
| `check_ci_run` | `read` | Não | Inspeciona execuções do GitHub Actions e quality gates de commits específicos. |
| `verify_mergeability` | `read` | Não | Avalia se um PR atende a regra de merge: CI 100% PASS → mergeability OK. |
| `create_pr_written` | `write` | Sim | Cria formalmente um Pull Request com checklist GOS3 e RFC 8785 canonical diff. |
| `write_branch_commit` | `write` | Sim | Escreve commits diretamente em branches de desenvolvimento com assinatura Ed25519. |
| `merge_pr` | `destructive`| Sim | Executa o merge governado (squash/rebase) após aprovação e CI 100% verde. |

Exemplo de uso via CLI:
```bash
npm run vua invoke github inspect_repo '{"owner":"vuafoundation","repo":"vua"}'
```

---

### B. Adaptador Linux (`linux`)
- **Ambiente**: POSIX Linux (Alpine, Debian, Ubuntu, Termux PRoot)
- **Versão**: `2.1.0`
- **Capacidades**: `sandbox.execute`, `system.inspect`, `vua.adapter.read`, `vua.adapter.execute`
- **Garantias**: Execução não-root, isolamento de chroot jail e limites de cgroups v2.

#### Ações Disponíveis:
| Ação | Risco | Requer Aprovação | Descrição |
| :--- | :--- | :--- | :--- |
| `inspect_system` | `read` | Não | Consulta kernel release, carga de CPU, limites de memória e versão do cgroups. |
| `exec_command` | `write` | Sim | Executa comando em jail isolado com captura determinística de stdout e stderr. |
| `audit_permissions` | `read` | Não | Audita permissões octais POSIX (`chmod`), bits SUID/SGID e ownership de arquivos. |
| `sandbox_jail_check` | `read` | Não | Testa e comprova bloqueio contra injeções de path traversal (`../`) e null-byte. |

Exemplo de uso via CLI:
```bash
npm run vua invoke linux inspect_system
npm run vua invoke linux sandbox_jail_check '{"test_path":"/tmp/vua-sandbox/../etc/shadow"}'
```

---

### C. Adaptador Android (`android`)
- **Ambiente**: AOSP Android (Termux nativo, Emuladores, Dispositivos Físicos)
- **Versão**: `1.4.0`
- **Capacidades**: `android.adb`, `apk.verify`, `vua.adapter.read`, `vua.adapter.execute`
- **Garantias**: Suporte a APK Signature Scheme v2/v3/v4, checagem SELinux Enforcing e Scoped Storage.

#### Ações Disponíveis:
| Ação | Risco | Requer Aprovação | Descrição |
| :--- | :--- | :--- | :--- |
| `inspect_device` | `read` | Não | Inspeciona build props, nível de API (ex: API 35), status de bateria e SELinux. |
| `adb_shell` | `write` | Sim | Executa comandos sandboxed via bridge ADB sob isolamento restrito de UID. |
| `verify_apk` | `read` | Não | Audita assinatura criptográfica de APK, fingerprint SHA-256 e flags de depuração. |
| `scoped_storage_audit`| `read`| Não | Verifica conformidade com as regras de armazenamento privado e isolamento de pastas. |
| `check_selinux` | `read` | Não | Valida se a política de SELinux está em modo `Enforcing` com isolamento MLS. |

Exemplo de uso via CLI:
```bash
npm run vua invoke android check_selinux
npm run vua invoke android verify_apk '{"package_name":"com.vortex.foundation.vua"}'
```

---

### D. Adaptador Windows (`windows`)
- **Ambiente**: Win32/NT Windows
- **Versão**: `2.0.0`
- **Capacidades**: `windows.powershell`, `ntfs.acl_audit`, `vua.adapter.read`, `vua.adapter.execute`
- **Garantias**: Execução de scripts restrita ao modo ConstrainedLanguage, auditoria de ACLs NTFS e isolamento de hives do Registro.

#### Ações Disponíveis:
| Ação | Risco | Requer Aprovação | Descrição |
| :--- | :--- | :--- | :--- |
| `inspect_system` | `read` | Não | Inspeciona build do Windows NT, status do Windows Defender e ExecutionPolicy do PowerShell. |
| `powershell_exec` | `write` | Sim | Executa commandlets em ambiente restrito com desativação de reflexão arbitrária e COM. |
| `inspect_acls` | `read` | Não | Audita listas de controle de acesso NTFS (DACL/SACL), Security Descriptors e herança. |
| `registry_audit` | `read` | Não | Verifica se o app respeita o isolamento de chaves de usuário (`HKCU`) vs do sistema (`HKLM`). |
| `wsl_bridge_status` | `read` | Não | Avalia integridade e interoperabilidade de instâncias do WSL2 (Hyper-V). |

Exemplo de uso via CLI:
```bash
npm run vua invoke windows inspect_system
npm run vua invoke windows registry_audit '{"key_path":"HKLM:\\SAM"}'
```

---

### E. Adaptador Canary de Governança (`canary`)
- **Ambiente**: Test / Conformance
- **Versão**: `1.0.0`
- **Capacidades**: `canary.read`, `canary.write`
- **Finalidade**: Validação contínua do princípio fundamental de segurança: **efeitos colaterais são matematicamente nulos (`sideEffectCount = 0`)** caso haja recusa de política, falta de aprovação ou assinatura inválida.

#### Ações Disponíveis:
| Ação | Risco | Requer Aprovação | Efeito no Estado |
| :--- | :--- | :--- | :--- |
| `read` | `read` | Não | Leitura de `sideEffectCount` sem alteração. |
| `write` | `write` | Sim | Incrementa `sideEffectCount` somente se a política autorizar e o token for válido. |

---

## 3. Uso Programático via SDK TypeScript

Para integrar os adaptadores diretamente no código de uma aplicação Node.js, Electron ou Tauri:

```typescript
import { vuaRegistry } from 'vua';

// 1. Listar adaptadores registrados
const adapters = vuaRegistry.list();
console.log(adapters.map(a => `${a.id}: ${a.name} (${a.status})`));

// 2. Invocar uma ação protegida
const result = await vuaRegistry.invoke({
  adapterId: 'linux',
  action: 'inspect_system',
  authorization: {
    principal_id: 'agent-alice',
    agent_id: 'agent/governance',
    policy_id: 'vortex-development',
    policy_version: '1.0.0',
    capability: 'vua.adapter.read',
    scope: { paths: ['*'], repositories: ['*'] }
  }
});

if (result.success) {
  console.log('Dados do Sistema:', result.data);
  console.log('Prova Criptográfica Emitida:', result.execution_proof?.proof_id);
  console.log('Assinatura Ed25519 Verificada:', result.verification?.valid);
}
```

---

## 4. Integração com Editores via MCP (Model Context Protocol)

Ao iniciar o servidor MCP do VUA:
```bash
npm run vua mcp
```

Editores como **Cursor**, **Claude Desktop** e **VS Code** conectam-se via `stdio` e utilizam a ferramenta unificada `vua.adapter.invoke`, permitindo que agentes LLM operem nos ecossistemas GitHub, Linux, Android e Windows mantendo a governança estrita e as assinaturas digitais intactas.
