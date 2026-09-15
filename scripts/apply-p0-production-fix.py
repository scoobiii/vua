from pathlib import Path

OAUTH = r'''/**
 * VUA — Vortex Universal Connector
 * OAuth 2.1 Authorization Code + PKCE S256 / MCP Resource Protection.
 * OAuth authentication != execution authorization != approval_token != ExecutionProof.
 * In-memory state is for local/single-instance operation; production horizontal
 * scaling requires shared durable OAuth state.
 */
import crypto from 'node:crypto';
import type { Express, NextFunction, Request, Response } from 'express';

type Client={client_id:string;redirect_uris:string[];client_name?:string};
type Code={client_id:string;redirect_uri:string;code_challenge:string;scope:string;resource:string;expires_at:number;used:boolean};
type Token={client_id:string;scope:string;resource:string;expires_at:number};
const clients=new Map<string,Client>();
const codes=new Map<string,Code>();
const tokens=new Map<string,Token>();
const attempts=new Map<string,{count:number;resetAt:number}>();
const CODE_TTL=300000,TOKEN_TTL=3600,RATE_WINDOW=900000,RATE_MAX=5;
const randomToken=(n=32)=>crypto.randomBytes(n).toString('base64url');
const challenge=(v:string)=>crypto.createHash('sha256').update(v,'utf8').digest('base64url');
const equal=(a:string,b:string)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)};
const esc=(v:string)=>v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
const base=(req:Request,configured?:string)=>(configured||`${req.get('x-forwarded-proto')?.split(',')[0]?.trim()||req.protocol}://${req.get('host')}`).replace(/\/$/,'');
const resource=(b:string)=>`${b.replace(/\/$/,'')}/mcp`;
function limit(ip:string){const n=Date.now(),v=attempts.get(ip);if(!v||v.resetAt<=n){attempts.set(ip,{count:1,resetAt:n+RATE_WINDOW});return true}if(v.count>=RATE_MAX)return false;v.count++;return true}
setInterval(()=>{const n=Date.now();for(const[k,v]of codes)if(v.expires_at<=n)codes.delete(k);for(const[k,v]of tokens)if(v.expires_at<=n)tokens.delete(k);for(const[k,v]of attempts)if(v.resetAt<=n)attempts.delete(k)},60000).unref();

export function mountOAuth(app:Express,opts?:{publicBaseUrl?:string}){
 const configured=opts?.publicBaseUrl?.replace(/\/$/,'');
 app.get('/.well-known/oauth-protected-resource',(req,res)=>{const b=base(req,configured);res.json({resource:resource(b),authorization_servers:[b],scopes_supported:['mcp'],bearer_methods_supported:['header']})});
 app.get('/.well-known/oauth-authorization-server',(req,res)=>{const b=base(req,configured);res.json({issuer:b,authorization_endpoint:`${b}/oauth/authorize`,token_endpoint:`${b}/oauth/token`,registration_endpoint:`${b}/oauth/register`,response_types_supported:['code'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256'],token_endpoint_auth_methods_supported:['none'],scopes_supported:['mcp']})});
 app.post('/oauth/register',(req,res)=>{const uris=req.body?.redirect_uris;if(!Array.isArray(uris)||!uris.length||uris.length>20)return res.status(400).json({error:'invalid_client_metadata'});if(!uris.every((u:unknown)=>{if(typeof u!=='string'||u.length>2048)return false;try{return new URL(u).protocol==='https:'}catch{return false}}))return res.status(400).json({error:'invalid_client_metadata',error_description:'HTTPS redirect_uris required'});const client_id=`vua-client-${randomToken(18)}`;clients.set(client_id,{client_id,redirect_uris:uris,client_name:typeof req.body?.client_name==='string'?req.body.client_name.slice(0,200):undefined});return res.status(201).json({client_id,client_name:clients.get(client_id)?.client_name||'VUA MCP Client',redirect_uris:uris,grant_types:['authorization_code'],response_types:['code'],token_endpoint_auth_method:'none'})});
 app.get('/oauth/authorize',(req,res)=>{const{response_type,client_id,redirect_uri,code_challenge,code_challenge_method,state}=req.query;const scope=typeof req.query.scope==='string'?req.query.scope:'mcp';const requested=typeof req.query.resource==='string'?req.query.resource:'';if(response_type!=='code'||typeof client_id!=='string'||typeof redirect_uri!=='string'||typeof code_challenge!=='string'||code_challenge_method!=='S256')return res.status(400).send('Invalid OAuth authorization request');const c=clients.get(client_id);if(!c||!c.redirect_uris.includes(redirect_uri))return res.status(400).send('Invalid client or redirect_uri');const b=base(req,configured),expected=resource(b);if(requested&&requested!==expected)return res.status(400).send('Invalid resource');const form=new URL('/oauth/approve',b);for(const[k,v]of Object.entries({client_id,redirect_uri,code_challenge,scope,resource:expected,state:typeof state==='string'?state:''}))form.searchParams.set(k,v);return res.type('html').send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autorizar VUA</title></head><body><main style="font-family:system-ui;max-width:480px;margin:4rem auto;padding:1rem"><h1>Autorizar VUA</h1><p>O cliente <b>${esc(c.client_name||client_id)}</b> solicita acesso ao MCP VUA.</p><p>Escopo: <code>${esc(scope)}</code></p><form method="post" action="${esc(form.pathname)}"><input type="hidden" name="client_id" value="${esc(client_id)}"><input type="hidden" name="redirect_uri" value="${esc(redirect_uri)}"><input type="hidden" name="code_challenge" value="${esc(code_challenge)}"><input type="hidden" name="scope" value="${esc(scope)}"><input type="hidden" name="resource" value="${esc(expected)}"><input type="hidden" name="state" value="${esc(typeof state==='string'?state:'')}"><label>Senha de autorização</label><input name="secret" type="password" required style="display:block;width:100%;padding:.8rem"><button type="submit" style="margin-top:1rem;padding:.8rem;width:100%">Autorizar Claude App</button></form></main></body></html>`)})
 app.post('/oauth/approve',(req,res)=>{if(!limit(req.ip||'unknown'))return res.status(429).send('Too many authorization attempts');const expected=process.env.OAUTH_APPROVE_SECRET;if(!expected)return res.status(503).send('OAuth approval is not configured');const{client_id,redirect_uri,code_challenge,scope='mcp',resource,state,secret}=req.body||{};if(typeof client_id!=='string'||typeof redirect_uri!=='string'||typeof code_challenge!=='string'||typeof resource!=='string'||typeof secret!=='string')return res.status(400).send('Invalid approval request');if(!equal(secret,expected))return res.status(403).send('Authorization denied');const c=clients.get(client_id);if(!c||!c.redirect_uris.includes(redirect_uri))return res.status(400).send('Invalid client or redirect_uri');const code=randomToken(32);codes.set(code,{client_id,redirect_uri,code_challenge,scope:String(scope),resource,expires_at:Date.now()+CODE_TTL,used:false});const target=new URL(redirect_uri);target.searchParams.set('code',code);if(typeof state==='string'&&state)target.searchParams.set('state',state);return res.redirect(302,target.toString())});
 app.post('/oauth/token',(req,res)=>{const{grant_type,code,redirect_uri,client_id,code_verifier,resource:requested}=req.body||{};if(grant_type!=='authorization_code')return res.status(400).json({error:'unsupported_grant_type'});if([code,redirect_uri,client_id,code_verifier].some(v=>typeof v!=='string'))return res.status(400).json({error:'invalid_request'});const record=codes.get(code as string);if(!record||record.used||record.expires_at<=Date.now()){codes.delete(code as string);return res.status(400).json({error:'invalid_grant'})}if(record.client_id!==client_id||record.redirect_uri!==redirect_uri||(typeof requested==='string'&&requested!==record.resource))return res.status(400).json({error:'invalid_grant'});if(!equal(challenge(code_verifier as string),record.code_challenge))return res.status(400).json({error:'invalid_grant',error_description:'PKCE verification failed'});record.used=true;codes.delete(code as string);const access_token=randomToken(32);tokens.set(access_token,{client_id:client_id as string,scope:record.scope,resource:record.resource,expires_at:Date.now()+TOKEN_TTL*1000});return res.json({access_token,token_type:'Bearer',expires_in:TOKEN_TTL,scope:record.scope})});
}
export function requireOAuthForMcp(opts?:{publicBaseUrl?:string}){return(req:Request,res:Response,next:NextFunction):void=>{if(process.env.VUA_OAUTH_REQUIRED!=='true'){next();return}const m=req.get('authorization')?.match(/^Bearer\s+([^\s]+)$/i),token=m?.[1],b=base(req,opts?.publicBaseUrl),r=resource(b);if(!token){res.setHeader('WWW-Authenticate',`Bearer resource_metadata="${b}/.well-known/oauth-protected-resource", scope="mcp"`);res.status(401).json({error:'unauthorized',error_description:'Bearer access token required'});return}const session=tokens.get(token);if(!session||session.expires_at<=Date.now()){if(session)tokens.delete(token);res.setHeader('WWW-Authenticate',`Bearer error="invalid_token", resource_metadata="${b}/.well-known/oauth-protected-resource", scope="mcp"`);res.status(401).json({error:'invalid_token'});return}if(session.resource!==r){res.setHeader('WWW-Authenticate','Bearer error="invalid_token"');res.status(401).json({error:'invalid_token',error_description:'Token resource mismatch'});return}res.setHeader('MCP-Auth-Client-Id',session.client_id);res.setHeader('MCP-Auth-Scope',session.scope);next()}}
'''

def replace_once(text, old, new, name):
    if old not in text:
        raise SystemExit(f'anchor missing: {name}')
    return text.replace(old, new, 1)

Path('src/vortex/oauth.ts').write_text(OAUTH)

p=Path('src/vortex/verifier.ts');s=p.read_text()
s=replace_once(s,"  // 4. Hashes Verification\n  const isInputHashValid = typeof proof.input_hash === 'string' && proof.input_hash.startsWith('sha256:');",'''  // 4. Hashes Verification\n  const calculatedProofHash = sha256(unsignedProof);\n  if (typeof proof_hash !== 'string') reasons.push('Missing proof_hash');\n  else if (proof_hash !== calculatedProofHash) reasons.push(`PROOF_HASH_MISMATCH: ${proof_hash} != ${calculatedProofHash}`);\n\n  const isInputHashValid = typeof proof.input_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(proof.input_hash);''','verifier')
s=s.replace("const isOutputHashValid = typeof proof.output_hash === 'string' && proof.output_hash.startsWith('sha256:');","const isOutputHashValid = typeof proof.output_hash === 'string' && /^sha256:[0-9a-f]{64}$/.test(proof.output_hash);")
p.write_text(s)

p=Path('src/vortex/gateway.ts');s=p.read_text()
if "import { verifyExecutionProof } from './verifier.js';" not in s:s=replace_once(s,"import { evaluatePolicy } from './policy.js';\n","import { evaluatePolicy } from './policy.js';\nimport { verifyExecutionProof } from './verifier.js';\n",'gateway import')
old="""    case 'verify':\n      return {\n        verified: true,\n        verification_scope: input?.scope || 'full',\n        tamper_evident: true,\n        rfc8785_canonical: true,\n      };"""
new="""    case 'verify': {\n      const proof = input?.execution_proof as ExecutionProof | undefined;\n      if (!proof) return { verified:false, valid:false, verification_scope:'full', tamper_evident:true, rfc8785_canonical:false, reasons:['execution_proof is required'] };\n      const verification = verifyExecutionProof(proof, { expectedOutputHash: typeof input?.expected_hash === 'string' ? input.expected_hash : undefined });\n      return { verified:verification.valid, valid:verification.valid, verification_scope:'full', tamper_evident:true, rfc8785_canonical:verification.checks.canonicalization.passed, reasons:verification.reasons, checks:verification.checks, verified_at:verification.verified_at };\n    }"""
s=replace_once(s,old,new,'gateway verify')
p.write_text(s)

p=Path('src/vortex/mcp-server.ts');s=p.read_text()
if "import { verifyExecutionProof } from './verifier.js';" not in s:s=replace_once(s,"import { vuaRegistry } from './adapters/registry.js';\n","import { vuaRegistry } from './adapters/registry.js';\nimport { verifyExecutionProof } from './verifier.js';\n",'mcp import')
anchor="    if (toolName === 'vortex.llm.invoke') {"
block="""    if (toolName === 'vortex.verify') {\n      const proof = args.input?.execution_proof as any;\n      if (!proof || typeof proof !== 'object') return { jsonrpc:'2.0', id, result:{ verified:false, valid:false, verification_scope:'full', tamper_evident:true, rfc8785_canonical:false, reasons:['execution_proof is required'] } };\n      const verification = verifyExecutionProof(proof, { expectedOutputHash: typeof args.input?.expected_hash === 'string' ? args.input.expected_hash : undefined });\n      return { jsonrpc:'2.0', id, result:{ verified:verification.valid, valid:verification.valid, verification_scope:'full', tamper_evident:true, rfc8785_canonical:verification.checks.canonicalization.passed, reasons:verification.reasons, checks:verification.checks, verified_at:verification.verified_at } };\n    }\n\n"""
s=replace_once(s,anchor,block+anchor,'mcp verify')
p.write_text(s)

p=Path('server.ts');s=p.read_text()
if "from './src/vortex/oauth.js'" not in s:s=replace_once(s,"import { runAgentPatchArena } from './scripts/agent-patch-arena.js';\n","import { runAgentPatchArena } from './scripts/agent-patch-arena.js';\nimport { mountOAuth, requireOAuthForMcp } from './src/vortex/oauth.js';\n",'server import')
marker="  // 3. MCP JSON-RPC 2.0 & SSE Transports (Claude Mobile / Cursor / Anthropic Connectors)\n"
if 'mountOAuth(app' not in s:s=replace_once(s,marker,marker+"  mountOAuth(app, { publicBaseUrl: process.env.PUBLIC_BASE_URL });\n\n",'oauth mount')
s=s.replace("app.get(['/mcp', '/sse'], (req, res) => {","app.get(['/mcp', '/sse'], requireOAuthForMcp({ publicBaseUrl: process.env.PUBLIC_BASE_URL }), (req, res) => {")
s=s.replace("app.get('/sse', (req, res) => {","app.get('/sse', requireOAuthForMcp({ publicBaseUrl: process.env.PUBLIC_BASE_URL }), (req, res) => {")
s=s.replace("app.post(['/mcp/messages', '/messages'], async (req, res) => {","app.post(['/mcp/messages', '/messages'], requireOAuthForMcp({ publicBaseUrl: process.env.PUBLIC_BASE_URL }), async (req, res) => {")
s=s.replace("app.post('/mcp', async (req, res) => {","app.post('/mcp', requireOAuthForMcp({ publicBaseUrl: process.env.PUBLIC_BASE_URL }), async (req, res) => {")
p.write_text(s)

Path('scripts/test-mcp-verify-tamper.ts').write_text('''import { executeVortexPipeline, resetAntiReplayCache } from '../src/vortex/gateway.js';\nimport { verifyExecutionProof } from '../src/vortex/verifier.js';\nresetAntiReplayCache();\nconst result = await executeVortexPipeline({ request_id:`mcp-proof-${Date.now()}`, operation:'inspect', input:{} });\nif (!result.execution_proof) throw new Error('inspect did not emit execution_proof');\nconst proof=result.execution_proof;\nconst original=verifyExecutionProof(proof);\nif (!original.valid) throw new Error(`valid proof rejected: ${original.reasons.join('; ')}`);\nconst tampered=structuredClone(proof); tampered.output_hash='sha256:'+'0'.repeat(64);\nconst bad=verifyExecutionProof(tampered);\nif (bad.valid) throw new Error('CRITICAL: tampered execution proof was accepted');\nconsole.log('PASS original proof'); console.log('PASS tampered proof rejected'); console.log(JSON.stringify({original:original.valid,tampered:bad.valid,reasons:bad.reasons},null,2));\n''')
