import http from 'node:http';
import { execFile } from 'node:child_process';
import { timingSafeEqual } from 'node:crypto';

const TOKEN = process.env.MCP_PUBLIC_TOKEN;
if (!TOKEN || TOKEN.length < 32) { console.error('defina MCP_PUBLIC_TOKEN (>=32 chars)'); process.exit(1); }
const OWNER = 'scoobiii';
const NAME_RE = /^[A-Za-z0-9._-]{1,100}$/;
const TOOLS = { github_inspect_repo: 'inspect_repo', github_inspect_workflows: 'inspect_workflows' };

const authOk = (h = '') => {
  const a = Buffer.from(h), b = Buffer.from('Bearer ' + TOKEN);
  return a.length === b.length && timingSafeEqual(a, b);
};

const run = (action, args) => new Promise(resolve => execFile(
  'npx', ['tsx', 'bin/vua.js', 'invoke', 'github', action, JSON.stringify(args)],
  { timeout: 30000, maxBuffer: 1 << 20,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, GITHUB_TOKEN: process.env.VUA_READ_TOKEN } },
  (e, out, err) => resolve({ isError: !!e, text: String(out || err || e).slice(0, 20000) })));

const rpc = async ({ id, method, params }) => {
  const ok = result => ({ jsonrpc: '2.0', id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
  if (method === 'initialize') return ok({ protocolVersion: params?.protocolVersion || '2025-03-26',
    capabilities: { tools: {} }, serverInfo: { name: 'vua-public-readonly', version: '1.0.0' } });
  if (method === 'ping') return ok({});
  if (method === 'tools/list') return ok({ tools: Object.entries(TOOLS).map(([name, a]) => ({
    name, description: `VUA ${a} (somente leitura)`,
    inputSchema: { type: 'object', properties: { owner: { type: 'string' }, repo: { type: 'string' } },
      required: ['owner', 'repo'], additionalProperties: false } })) });
  if (method === 'tools/call') {
    const action = TOOLS[params?.name]; const a = params?.arguments || {};
    if (!action) return fail(-32602, 'ferramenta não permitida');
    if (a.owner !== OWNER || !NAME_RE.test(a.repo || '')) return fail(-32602, 'owner/repo inválido');
    const r = await run(action, { owner: a.owner, repo: a.repo });
    return ok({ content: [{ type: 'text', text: r.text }], isError: r.isError });
  }
  return id === undefined ? null : fail(-32601, 'método não suportado');
};

http.createServer(async (req, res) => {
  const [, p1, p2] = req.url.split('?')[0].split('/');
  if (p1 !== 'mcp') return res.writeHead(404).end();
  if (!(p2 && authOk('Bearer ' + p2)) && !authOk(req.headers.authorization)) return res.writeHead(401).end();
  if (req.method !== 'POST') return res.writeHead(405).end();
  let body = '';
  for await (const c of req) { body += c; if (body.length > 65536) return res.writeHead(413).end(); }
  let m; try { m = JSON.parse(body); } catch { return res.writeHead(400).end(); }
  const out = Array.isArray(m) ? (await Promise.all(m.map(rpc))).filter(Boolean) : await rpc(m);
  if (!out || (Array.isArray(out) && !out.length)) return res.writeHead(202).end();
  res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out));
}).listen(8787, '127.0.0.1', () => console.log('MCP público (read-only) em 127.0.0.1:8787/mcp'));
