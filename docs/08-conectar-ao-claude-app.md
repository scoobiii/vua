# 08. Conectar o VUA (somente leitura) ao Claude App

> O antigo endpoint público sem autenticação foi removido deste guia.
> Nunca exponha `vortex.execute`, `vortex.branch.write`, `vua.adapter.invoke`,
> `exec_command`, `run_program`, `adb_shell` ou `powershell_exec` em URL pública.
> O `vua mcp` (stdio) é só para uso local (Cursor, Claude Desktop na mesma máquina).

## 1. Servidor
`mcp-public.mjs` escuta só em 127.0.0.1:8787 e libera apenas ações de leitura.
Variáveis: `MCP_PUBLIC_TOKEN` (openssl rand -hex 32) e `VUA_READ_TOKEN`
(GitHub fine-grained, read-only, só o repo necessário).

    node mcp-public.mjs &
    cloudflared tunnel --url http://127.0.0.1:8787

## 2. Claude App → Conectores → Adicionar personalizado
| Campo | Valor |
| :-- | :-- |
| Nome | VUA (leitura) |
| URL | `https://<túnel>/mcp/<MCP_PUBLIC_TOKEN>` |
| OAuth | vazio |

A autenticação é o segredo na URL. Trate a URL como senha, não publique
em docs nem commits e rotacione o token se vazar.

## 3. Ferramentas expostas
`github_inspect_repo`, `github_inspect_workflows` (owner fixo, repo validado).

## 4. Segurança
- Ed25519/ExecutionProof prova o que foi executado; não autentica quem chama.
- O token do GitHub do servidor é read-only.
- A URL do túnel trycloudflare muda a cada execução.

## 5. Teste
    curl -s -X POST "https://<túnel>/mcp/<TOKEN>" -H 'content-type: application/json' \
      -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
    curl -si "https://<túnel>/mcp/errado" | head -1   # deve dar 401
