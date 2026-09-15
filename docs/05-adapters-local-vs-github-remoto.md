# 🔌 05. GitHub App Remota vs. Adaptadores para Apps Locais

Uma das dúvidas mais comuns é: **Como o VUA se comunica com o GitHub na nuvem e se existem adaptadores para controlar e auditar aplicações instaladas localmente nos vários sistemas operacionais?**

A resposta curta é: **Sim! O VUA possui arquitetura separada para integração remota com o GitHub e adaptadores locais nativos para cada classe de aplicação (Linux, Android, Windows e Editores/IDEs via MCP).**

---

## 1. Acesso à GitHub App Remota

Para repositórios hospedados no GitHub, o VUA suporta dois modos de conexão remota:

### A. Modo Token Pessoal (PAT)
Basta definir a variável de ambiente:
```bash
export GITHUB_TOKEN="ghp_seuTokenAqui..."
```

### B. Modo GitHub App Oficial (App Remota)
Para organizações corporativas e agentes autônomos, o VUA suporta o protocolo de **GitHub App**:
1. Registre sua GitHub App no GitHub Developer Settings.
2. Gere a chave privada `.pem` e o `App ID`.
3. Instale a GitHub App na organização ou repositório desejado.
4. O VUA gera um JWT (JSON Web Token) efêmero assinado com RS256 e obtém um `installation_access_token` de curta duração (1 hora) com escopo restrito.

### Ações Executadas pelo Adaptador GitHub:
- `inspect_repo`: Inspeciona branches padrão, proteções de branch e políticas de segurança.
- `verify_commit`: Valida assinaturas de commits (PGP / SSH / Sigstore).
- `propose_pr`: Cria propostas determinísticas de PR sem sobrescrever branches protegidas.
- `check_ci_run`: Audita se o workflow de CI (Actions) passou com 100% dos quality gates.
- `verify_mergeability`: Regra estrita: CI 100% PASS → mergeability OK.

---

## 2. Adaptadores para Aplicações Locais (Local Apps)

O VUA fornece adaptadores especializados para os vários tipos de aplicativos rodando localmente na sua máquina ou dispositivo móvel:

```
                          ┌──────────────────────────┐
                          │   VUA Registry Engine    │
                          └─────────────┬────────────┘
                                        │
        ┌───────────────────┬───────────┴───────────┬───────────────────┐
        ▼                   ▼                       ▼                   ▼
 ┌──────────────┐    ┌──────────────┐        ┌──────────────┐    ┌──────────────┐
 │ Linux Apps   │    │ Android Apps │        │ Windows Apps │    │ IDEs Locais  │
 │ (CLI, Daemons│    │ (APKs, Intent│        │ (Win32, PS,  │    │ (Cursor, VS  │
 │  & Scripts)  │    │  & Storage)  │        │  Registry)   │    │  Code, MCP)  │
 └──────────────┘    └──────────────┘        └──────────────┘    └──────────────┘
```

---

### A. Adaptador para Apps Linux (`linux`)
Projetado para interagir com programas executáveis locais, scripts em Bash/Python, serviços systemd e processos em containers:
- **`exec_command`**: Executa binários locais em sandbox controlado, capturando stdout/stderr com hash determinístico e tempo de execução.
- **`audit_permissions`**: Verifica permissões POSIX (`chmod`, `chown`, suid/sgid) de arquivos de configuração da aplicação.
- **`sandbox_jail_check`**: Confirma se a aplicação local está rodando isolada em namespaces (chroot, cgroups, PRoot).

Exemplo CLI:
```bash
npm run vua invoke linux sandbox_jail_check
```

---

### B. Adaptador para Apps Android (`android`)
Projetado para interagir com aplicativos móveis instalados no dispositivo (`.apk`), processos do ecossistema Android e sandboxes do sistema operacional:
- **`verify_apk`**: Valida a integridade matemática do APK instalado, certificação de assinatura (v2/v3 Scheme) e permissões declaradas.
- **`check_selinux`**: Verifica se o aplicativo local está sujeito à política de SELinux `Enforcing` com categorias MLS exclusivas por UID de app.
- **`scoped_storage_audit`**: Garante que o app respeite o isolamento de pastas privadas no `/data/data/<package_name>`.
- **`adb_shell`**: Envia comandos pontuais de depuração e inspeção para apps em desenvolvimento.

Exemplo CLI:
```bash
npm run vua invoke android check_selinux
npm run vua invoke android verify_apk '{"package_name":"com.vortex.foundation.vua"}'
```

---

### C. Adaptador para Apps Windows (`windows`)
Projetado para gerenciar e auditar aplicações locais de desktop Windows (Win32 / UWP / .NET):
- **`powershell_exec`**: Executa comandos de gestão de apps via PowerShell em processo filho normatizado.
- **`inspect_acls`**: Audita listas de controle de acesso (ACLs) do sistema de arquivos NTFS da aplicação.
- **`registry_audit`**: Inspeciona chaves do registro local (`HKLM`, `HKCU`) usadas pela aplicação.
- **`wsl_bridge_status`**: Ponte de comunicação bidirecional com instâncias WSL2 locais.

Exemplo CLI:
```bash
npm run vua invoke windows inspect_acls '{"path":"C:\\Program Files"}'
```

---

### D. Adaptador MCP (Model Context Protocol) para Editores Locais
Se você utiliza editores e agentes como **Cursor IDE**, **Claude Desktop**, **VS Code** (com extensões Roo Code, Cline ou Copilot), o VUA oferece o conector **MCP Server** via protocolo padrão JSON-RPC 2.0:

#### Iniciar via Linha de Comando:
```bash
npm run vua mcp
# ou
npx tsx bin/vua.js mcp
```

#### Como Configurar no Claude Desktop ou Cursor:
No seu arquivo de configuração `claude_desktop_config.json` ou nas configurações de MCP do Cursor:
```json
{
  "mcpServers": {
    "vua-local": {
      "command": "node",
      "args": ["/caminho/absoluto/do/projeto/bin/vua.js", "mcp"]
    }
  }
}
```

O seu editor local terá acesso imediato a todas as ferramentas do VUA:
1. `vortex.inspect`: Ler e auditar arquivos locais com atestação criptográfica.
2. `vortex.propose`: Propor patches sem efeitos colaterais.
3. `vortex.verify`: Verificar provas e assinaturas Ed25519.
4. `vortex.execute`: Executar ações em apps locais dentro de limites estritos de sandbox.
5. `vua.adapter.invoke`: Acionar diretamente qualquer um dos 4 adaptadores locais do sistema.

---

### E. Uso Direto como SDK em Apps Desktop (Electron / Tauri)
Se você está construindo uma aplicação desktop própria (usando Electron, Tauri ou Node.js), você pode consumir o VUA diretamente em memória:

```typescript
import { vuaRegistry } from 'vua';

// Invoca a ação local do app diretamente no processo
const status = await vuaRegistry.invoke({
  adapterId: 'linux',
  action: 'exec_command',
  target: { app: 'my-desktop-app' },
  payload: { command: 'uname -a' }
});

console.log(status.data);
```
Isso oferece latência de microssegundos (< 1 milissegundo) com garantia de prova assinada Ed25519 para cada operação efetuada.
