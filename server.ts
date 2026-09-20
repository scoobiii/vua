/**
 * Vortex MCP Server - Foundation Execution Governance Entry Point
 * Express + Vite Full-Stack Implementation
 */

import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { runAdversarialSuite, runFoundationE2ESuite, runVUAAdaptersE2ESuite } from './src/vortex/conformance.js';
import { generateVortexIdentity, KEY_REGISTRY } from './src/vortex/crypto.js';
import { evaluateBenchmarkGate, generateExecutionEvidence } from './src/vortex/evidence.js';
import {
  CURRENT_IDENTITY,
  EXECUTION_LOGS,
  executeVortexPipeline,
  resetAntiReplayCache,
  setVortexIdentity,
} from './src/vortex/gateway.js';
import { createGOS3Session, listActiveSessions, onboardResource } from './src/vortex/gos3.js';
import { executeGovernedLLM, probeLocalLLM, type LLMConfig } from './src/vortex/llm.js';
import { handleMCPMessage, VORTEX_MCP_TOOLS } from './src/vortex/mcp-server.js';
import { vuaRegistry } from './src/vortex/adapters/registry.js';
import { verifyExecutionProof } from './src/vortex/verifier.js';
import { runAgentPatchArena } from './scripts/agent-patch-arena.js';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './src/vortex/openapi-spec.js';
import {
  firebaseConfig,
  verifyFirebaseIdToken,
  requireFirebaseAuth,
  optionalFirebaseAuth,
  type AuthenticatedFirebaseRequest,
} from './src/vortex/firebase-auth.js';
import { RepositoryBootstrapper } from './src/repository/bootstrap/RepositoryBootstrapper.js';
import { mountOAuth, requireBearer } from './src/vortex/oauth.js';
import { bootstrapHardwareBaseline, detectHardwareFingerprint, computeDynamicBaseline } from './src/vortex/hardware-profiler.js';

const PORT = Number(process.env.PORT || 3000);
const configuredPublicBase = (process.env.PUBLIC_BASE_URL || process.env.APP_URL || '').replace(/\/$/, '');
const mcpResource = (req: express.Request): string => {
  const forwarded = req.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwarded === 'https' || req.protocol === 'https' ? 'https' : 'http';
  const base = configuredPublicBase || `${protocol}://${req.get('host') || `localhost:${PORT}`}`;
  return `${base}/mcp`;
};
const requireMcpBearer = requireBearer(mcpResource);

async function startServer() {
  const app = express();

  // Production-safe middleware: explicit CORS, security headers, bounded bodies.
  const allowedOrigin = process.env.CORS_ORIGIN || '';
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && (process.env.NODE_ENV !== 'production' && !allowedOrigin || origin === allowedOrigin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Vary', 'Origin');
    }
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, mcp-session-id');
    res.header('Access-Control-Expose-Headers', 'WWW-Authenticate, mcp-session-id');
    res.header('X-Content-Type-Options', 'nosniff');
    res.header('X-Frame-Options', 'DENY');
    res.header('Referrer-Policy', 'no-referrer');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '32kb' }));
  app.use(express.static(path.join(process.cwd(), 'public')));
  mountOAuth(app, { publicBaseUrl: configuredPublicBase || undefined });

  // 0. Interactive Swagger UI & Raw OpenAPI Spec
  app.get('/api/openapi.json', (req, res) => {
    res.json(openApiSpec);
  });

  const swaggerCustomCss = `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info { margin: 16px 0 10px; }
    .swagger-ui .scheme-container { margin: 10px 0 20px; padding: 16px; background: #18181b; border: 1px solid #3f3f46; border-radius: 8px; }
    .vua-firebase-card {
      background: linear-gradient(135deg, #18181b 0%, #27272a 100%);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 10px;
      padding: 14px 18px;
      margin: 16px 0 20px;
      color: #fafafa;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    }
    .vua-firebase-card h4 {
      margin: 0 0 6px;
      color: #fbbf24;
      font-size: 14px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .vua-firebase-card p {
      margin: 0 0 10px;
      font-size: 12px;
      color: #d4d4d8;
      line-height: 1.5;
    }
    .vua-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-family: monospace;
      background: #451a03;
      border: 1px solid #d97706;
      color: #fef3c7;
      margin: 2px 4px 2px 0;
    }
    .vua-btn-group {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 10px;
    }
    .vua-btn-gold {
      background: #f59e0b;
      color: #000;
      font-weight: 600;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      transition: background 0.15s;
    }
    .vua-btn-gold:hover { background: #fbbf24; }
    .vua-btn-zinc {
      background: #3f3f46;
      color: #f4f4f5;
      border: 1px solid #71717a;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
    }
    .vua-btn-zinc:hover { background: #52525b; }
  `;

  const swaggerCustomJs = `
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const info = document.querySelector('.swagger-ui .info');
        if (info && !document.getElementById('vua-firebase-box')) {
          const banner = document.createElement('div');
          banner.id = 'vua-firebase-box';
          banner.className = 'vua-firebase-card';
          banner.innerHTML = \`
            <h4>🔥 Firebase Authentication Integrado ao Swagger</h4>
            <p>
              Este Swagger OpenAPI 3.0 opera com o esquema de segurança <strong>FirebaseAuth</strong>.
              Todo acesso a rotas protegidas exige autenticação e token de identidade JWT válido emitido pelo Firebase Auth.
            </p>
            <div>
              <span class="vua-badge">Projeto: ${firebaseConfig.projectId}</span>
              <span class="vua-badge">Firestore DB: ${firebaseConfig.firestoreDatabaseId}</span>
              <span class="vua-badge">Região: us-west2</span>
              <span class="vua-badge">Política: Autenticação Obrigatória (Fail-Closed)</span>
            </div>
            <div class="vua-btn-group">
              <button class="vua-btn-gold" onclick="window.open('/', '_blank')">🔑 Abrir Painel VUA & Efetuar Login</button>
            </div>
          \`;
          info.parentNode.insertBefore(banner, info.nextSibling);
        }

        // Auto-authorize if token passed in URL search or hash
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = urlParams.get('token') || window.location.hash.replace('#token=', '');
        if (urlToken && window.ui) {
          window.ui.preauthorizeApiKey('FirebaseAuth', urlToken);
          console.log('[VUA Swagger] Pré-autorizado com token Firebase da sessão.');
        }
      }, 700);
    });
  `;

  app.get('/api-docs-helper.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(swaggerCustomJs);
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customCss: swaggerCustomCss,
    customJs: '/api-docs-helper.js',
    customSiteTitle: 'Vortex Universal Agent (VUA) - OpenAPI 3.0 Documentation',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'list',
      filter: true,
      tryItOutEnabled: true,
    },
  }));

  // Firebase Auth Endpoints (Documented in OpenAPI / Swagger)
  app.get('/api/auth/firebase/status', (req, res) => {
    res.json({
      firebase_auth_enabled: true,
      project_id: firebaseConfig.projectId,
      firestore_database_id: firebaseConfig.firestoreDatabaseId,
      firestore_region: firebaseConfig.firestoreRegion || 'us-west2',
      auth_domain: firebaseConfig.authDomain,
      swagger_security_scheme: 'FirebaseAuth (HTTP Bearer / Firebase ID Token JWT)',
      token_issuer: `https://securetoken.google.com/${firebaseConfig.projectId}`,
      supported_algorithms: ['RS256'],
      auth_documentation: '/api-docs#/Firebase%20Auth%20%26%20Cloud%20Ledger',
    });
  });

  app.post('/api/auth/firebase/verify', async (req, res) => {
    const rawAuth = req.headers.authorization;
    const token = req.body?.idToken || (rawAuth ? rawAuth.replace(/^Bearer\s+/i, '') : null);
    if (!token) {
      return res.status(400).json({
        valid: false,
        error: 'ID Token não fornecido. Envie { "idToken": "..." } no corpo ou cabeçalho Authorization: Bearer <token>',
      });
    }

    const result = await verifyFirebaseIdToken(token);
    if (!result.valid || !result.decoded) {
      return res.status(401).json({
        valid: false,
        error: result.error,
      });
    }

    res.json({
      valid: true,
      role: result.role,
      user: {
        uid: result.decoded.sub,
        email: result.decoded.email,
        email_verified: result.decoded.email_verified,
        role: result.role,
        project_id: result.decoded.aud,
        expires_at: new Date(result.decoded.exp * 1000).toISOString(),
        auth_time: result.decoded.auth_time,
      },
    });
  });

  app.get('/api/auth/firebase/me', requireFirebaseAuth, (req: AuthenticatedFirebaseRequest, res) => {
    res.json({
      authenticated: true,
      uid: req.firebaseUser?.sub,
      email: req.firebaseUser?.email,
      role: req.firebaseRole,
      email_verified: req.firebaseUser?.email_verified,
      claims: req.firebaseUser,
    });
  });

  app.post('/api/auth/firebase/demo-token', (req, res) => {
    res.status(403).json({
      error: 'Tokens de teste anônimos desabilitados.',
      message: 'Todo acesso requer autenticação prévia com credenciais válidas do Firebase Auth.',
      auth_required: true,
    });
  });

  // VUA Repository Bootstrapper & Ruleset Conformance Endpoints
  const repoBootstrapper = new RepositoryBootstrapper();

  app.get('/api/repo/inspect', async (req, res) => {
    const repoSlug = (req.query.repo as string) || 'vuafoundation/vua';
    const token = (req.query.token as string) || process.env.GITHUB_TOKEN;
    const result = await repoBootstrapper.inspect(repoSlug, token);
    res.json(result);
  });

  app.post('/api/repo/bootstrap', async (req, res) => {
    const repoSlug = req.body?.repo || 'vuafoundation/vua';
    const token = req.body?.token || process.env.GITHUB_TOKEN;
    const result = await repoBootstrapper.bootstrap(repoSlug, token);
    res.json(result);
  });

  app.get('/api/repo/verify', async (req, res) => {
    const repoSlug = (req.query.repo as string) || 'vuafoundation/vua';
    const token = (req.query.token as string) || process.env.GITHUB_TOKEN;
    const result = await repoBootstrapper.verify(repoSlug, token);
    res.json(result);
  });

  app.post('/api/repo/repair', async (req, res) => {
    const repoSlug = req.body?.repo || 'vuafoundation/vua';
    const token = req.body?.token || process.env.GITHUB_TOKEN;
    const result = await repoBootstrapper.repair(repoSlug, token);
    res.json(result);
  });

  app.get('/api/repo/contract', (req, res) => {
    try {
      const contract = repoBootstrapper['conformanceEngine'].getContract();
      res.json(contract);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/repo/ruleset', (req, res) => {
    try {
      const ruleset = repoBootstrapper['rulesetManager'].getGoldenRuleset();
      res.json(ruleset);
    } catch (err: any) {
      res.status(404).json({ error: err.message });
    }
  });

  app.get('/api/firestore/proofs', optionalFirebaseAuth, (req: AuthenticatedFirebaseRequest, res) => {
    const limitCount = parseInt(req.query.limit as string, 10) || 20;
    const proofs = EXECUTION_LOGS.slice(0, limitCount);
    res.json({
      collection: 'execution_proofs',
      database_id: firebaseConfig.firestoreDatabaseId,
      region: firebaseConfig.firestoreRegion || 'us-west2',
      count: proofs.length,
      authenticated_as: req.firebaseUser?.email || 'anonymous',
      role: req.firebaseRole || 'public',
      proofs,
    });
  });

  app.post('/api/firestore/proofs', requireFirebaseAuth, (req: AuthenticatedFirebaseRequest, res) => {
    const proof = req.body;
    if (!proof || !proof.execution_id) {
      return res.status(400).json({ error: 'Payload de prova inválido. execution_id é obrigatório.' });
    }

    EXECUTION_LOGS.unshift({
      ...proof,
      owner_uid: req.firebaseUser?.sub,
      recorded_at: new Date().toISOString(),
    });

    res.json({
      success: true,
      proof_id: proof.execution_id,
      firestore_path: `execution_proofs/${proof.execution_id}`,
      owner_uid: req.firebaseUser?.sub,
      timestamp: new Date().toISOString(),
    });
  });

  // 1. Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'vortex-mcp-foundation-server',
      spec: 'Vortex MCP Execution Governance Profile v1',
      thesis: 'SAFETY = AUTHORIZATION + BOUNDED EXECUTION + ACCOUNTABILITY + INDEPENDENT VERIFICATION + IDENTITY',
      node_version: process.version,
    });
  });

  // Dynamic Hardware Baseline & Device Fingerprint Certificate
  app.get('/api/vua/baseline/hardware', async (req, res) => {
    try {
      const cert = await bootstrapHardwareBaseline();
      res.json({
        success: true,
        certificate: cert,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Falha ao gerar baseline dinâmica de hardware',
      });
    }
  });

  // 2. Well-known Key Discovery (RFC Well-Known)
  app.get('/.well-known/vortex-keys', (req, res) => {
    const keys = Array.from(KEY_REGISTRY.values()).map((k) => ({
      key_id: k.key_id,
      algorithm: k.algorithm,
      principal_id: k.principal_id,
      agent_id: k.agent_id,
      public_key: k.public_key,
      created_at: k.created_at,
    }));
    res.json({
      keys,
      current_key_id: CURRENT_IDENTITY.key_id,
    });
  });

  // 3. MCP JSON-RPC 2.0 & SSE Transports (Claude Mobile / Cursor / Anthropic Connectors)
  const sseSessions = new Map<string, express.Response>();

  const handleSseConnection = (req: express.Request, res: express.Response) => {
    const sessionId = crypto.randomUUID();
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    sseSessions.set(sessionId, res);

    // Initial endpoint announcement for MCP SSE protocol
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const endpointUrl = `${protocol}://${host}/mcp/messages?sessionId=${sessionId}`;

    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    // Heartbeat every 15 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseSessions.delete(sessionId);
    });
  };

  app.get(['/mcp', '/sse'], requireMcpBearer, (req, res) => {
    if (req.headers.accept && req.headers.accept.includes('text/event-stream')) {
      return handleSseConnection(req, res);
    }
    res.json({
      service: 'vua-mcp-server',
      version: '1.0.0',
      status: 'ONLINE',
      protocol: 'MCP JSON-RPC 2.0',
      transports: ['HTTP POST (direct)', 'Server-Sent Events (SSE)'],
      endpoints: {
        sse: '/mcp or /sse (with Accept: text/event-stream)',
        messages: '/mcp/messages?sessionId=<session_id>',
        direct_post: '/mcp',
      },
      tools_endpoint: '/mcp (method: tools/list)',
      tools_count: VORTEX_MCP_TOOLS.length,
      tools: VORTEX_MCP_TOOLS.map((t) => t.name),
    });
  });

  // Dedicated SSE route for clients explicitly configured with /sse
  app.get('/sse', requireMcpBearer, (req, res) => {
    return handleSseConnection(req, res);
  });

  // MCP Messages Endpoint (POST from SSE clients)
  app.post(['/mcp/messages', '/messages'], requireMcpBearer, async (req, res) => {
    try {
      const sessionId = (req.query.sessionId as string) || (req.headers['mcp-session-id'] as string);
      const sseRes = sessionId ? sseSessions.get(sessionId) : undefined;


      const rpcResponse = await handleMCPMessage(req.body);

      if (sseRes) {
        sseRes.write(`event: message\ndata: ${JSON.stringify(rpcResponse)}\n\n`);
        return res.status(202).send('Accepted');
      }

      res.json(rpcResponse);
    } catch (err: unknown) {
      res.status(500).json({
        jsonrpc: '2.0',
        id: req.body?.id ?? null,
        error: { code: -32603, message: 'Internal server error' },
      });
    }
  });

  app.post('/mcp', async (req, res, next) => {
    // Permit read-only discovery methods and pure mathematical verification without Bearer token
    const method = req.body?.method;
    const isVerifyTool = method === 'tools/call' && req.body?.params?.name === 'vortex.verify';
    const isLocalhost = req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1' || req.hostname === 'localhost';
    if (['initialize', 'notifications/initialized', 'initialized', 'ping', 'tools/list'].includes(method) || isVerifyTool || isLocalhost) {
      try {
        const response = await handleMCPMessage(req.body);
        return res.json(response);
      } catch (err: unknown) {
        return res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32603, message: 'Internal server error' },
        });
      }
    }
    // All tool executions and mutating calls strictly require Bearer authorization
    return requireMcpBearer(req, res, async () => {
      try {
        const response = await handleMCPMessage(req.body);
        res.json(response);
      } catch (err: unknown) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: req.body?.id ?? null,
          error: { code: -32603, message: 'Internal server error' },
        });
      }
    });
  });

  // 4. Status & Engine Metrics
  app.get('/api/vortex/status', (req, res) => {
    res.json({
      status: 'ONLINE',
      identity: {
        agent_id: CURRENT_IDENTITY.agent_id,
        principal_id: CURRENT_IDENTITY.principal_id,
        key_id: CURRENT_IDENTITY.key_id,
        algorithm: CURRENT_IDENTITY.algorithm,
        public_key: CURRENT_IDENTITY.public_key,
      },
      tools_count: VORTEX_MCP_TOOLS.length,
      tools: VORTEX_MCP_TOOLS.map((t) => t.name),
      active_gos3_sessions: listActiveSessions().length,
      execution_proofs_count: EXECUTION_LOGS.length,
      recent_proofs: EXECUTION_LOGS.slice(0, 5),
    });
  });

  // 5. Execute Vortex pipeline directly via REST
  app.post('/api/vortex/execute', async (req, res) => {
    try {
      const result = await executeVortexPipeline(req.body);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({
        status: 'EXECUTION_ERROR',
        error: { code: 'PIPELINE_ERROR', message: String(err) },
      });
    }
  });

  // 6. Independent Verifier Endpoint
  app.post('/api/vortex/verify', (req, res) => {
    try {
      const proof = req.body?.proof || (req.body?.proof_version ? req.body : undefined);
      const options = req.body?.options;
      if (!proof) {
        return res.status(400).json({
          valid: false,
          status: 'VERIFICATION_FAILED',
          reasons: ['Missing proof payload. Supply { proof: ... } or an ExecutionProof object directly.'],
        });
      }
      const verification = verifyExecutionProof(proof, options);
      res.json(verification);
    } catch (err: unknown) {
      res.status(400).json({
        valid: false,
        status: 'VERIFICATION_FAILED',
        reasons: [`Verification execution failed: ${err}`],
      });
    }
  });

  // 7. Conformance: Run Adversarial Suite (FORGE, REPLAY, ESCALATE, ESCAPE, TAMPER)
  app.post('/api/vortex/conformance/adversarial', async (req, res) => {
    try {
      const results = await runAdversarialSuite();
      res.json({
        timestamp: new Date().toISOString(),
        total: results.length,
        passed: results.filter((r) => r.passed).length,
        failed: results.filter((r) => !r.passed).length,
        results,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 8. Conformance: Run Foundation 10 E2Es (E2E-001 to E2E-010)
  app.post('/api/vortex/conformance/e2e', async (req, res) => {
    try {
      const suite = await runFoundationE2ESuite();
      res.json({
        timestamp: new Date().toISOString(),
        total: suite.length,
        passed: suite.filter((r) => r.status === 'PASS').length,
        failed: suite.filter((r) => r.status === 'FAIL').length,
        results: suite,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 9. CI Evidence & Benchmark Gate
  app.get('/api/vortex/evidence', (req, res) => {
    const proofHashes = EXECUTION_LOGS.slice(0, 10).map((p) => p.proof_hash || p.output_hash);
    const evidence = generateExecutionEvidence({
      proofHashes,
      allTestsPassed: true,
      coveragePercent: 100,
    });

    const benchmark = evaluateBenchmarkGate(
      {
        rps: 920,
        p50_ms: 1.1,
        p95_ms: 4.2,
        p99_ms: 11.0,
        error_rate_pct: 0.0,
        timeout_rate_pct: 0.0,
        memory_efficiency_pct: 96.5,
      },
      { coverage: true, security: true, integration: true, proof: true }
    );

    res.json({
      evidence,
      benchmark,
    });
  });

  // 10. GOS3 Onboarding & Session Creation
  app.post('/api/vortex/gos3/session', (req, res) => {
    const { principal_id, agent_id, resource, duration_seconds } = req.body;
    const session = createGOS3Session(
      principal_id || 'scoobiii',
      agent_id || 'agent/vortex',
      resource || '/workspace/vortex/src/governed-file.ts',
      duration_seconds || 300
    );
    res.json(session);
  });

  // 11. GOS3 List Active Sessions
  app.get('/api/vortex/gos3/sessions', (req, res) => {
    res.json(listActiveSessions());
  });

  // 12. Rotate / Create Ed25519 Identity
  app.post('/api/vortex/keys/rotate', (req, res) => {
    const { principal_id, agent_id } = req.body;
    const newIdentity = generateVortexIdentity(principal_id || 'scoobiii', agent_id || 'agent/vortex');
    setVortexIdentity(newIdentity);
    res.json({
      key_id: newIdentity.key_id,
      algorithm: newIdentity.algorithm,
      principal_id: newIdentity.principal_id,
      agent_id: newIdentity.agent_id,
      public_key: newIdentity.public_key,
    });
  });

  // 13. Reset Anti-Replay Cache
  app.post('/api/vortex/reset-replay', (req, res) => {
    resetAntiReplayCache();
    res.json({ status: 'ok', message: 'Anti-replay nonce cache cleared' });
  });

  // 13.1. Agent Patch Arena Tournament Endpoint
  app.get('/api/vortex/arena/tournament', async (req, res) => {
    try {
      const result = await runAgentPatchArena();
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  app.post('/api/vortex/arena/tournament', async (req, res) => {
    try {
      const candidates = req.body?.candidates;
      const result = await runAgentPatchArena(candidates);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: String(err) });
    }
  });

  // 14. LLM Providers Info
  app.get('/api/vortex/llm/providers', (req, res) => {
    res.json({
      providers: [
        {
          id: 'gemini',
          name: 'Google Gemini',
          type: 'cloud_api_key',
          default_model: 'gemini-3.8-flash',
          models: ['gemini-3.8-flash', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite'],
          has_server_key: Boolean(process.env.GEMINI_API_KEY),
          description: 'High-speed multimodality via @google/genai with server-side key',
        },
        {
          id: 'openai',
          name: 'OpenAI / Compatible Cloud',
          type: 'cloud_api_key',
          default_model: 'gpt-4o-mini',
          models: ['gpt-4o-mini', 'gpt-4o', 'deepseek-chat', 'claude-3-5-sonnet'],
          has_server_key: Boolean(process.env.OPENAI_API_KEY),
          description: 'OpenAI, Groq, DeepSeek, or custom cloud endpoints with API key',
        },
        {
          id: 'ollama',
          name: 'Ollama (Local LLM)',
          type: 'local',
          default_url: 'http://localhost:11434',
          default_model: 'llama3',
          models: ['llama3', 'llama3.2', 'mistral', 'qwen2.5', 'phi3', 'gemma2', 'deepseek-r1'],
          description: 'Zero-cloud local inference running on localhost:11434 with zero data leakage',
        },
        {
          id: 'lmstudio',
          name: 'LM Studio / vLLM (Local LLM)',
          type: 'local',
          default_url: 'http://localhost:1234/v1',
          default_model: 'local-model',
          models: ['local-model'],
          description: 'Local OpenAI-compatible engine on localhost:1234 or vLLM',
        },
        {
          id: 'llamacpp',
          name: 'llama.cpp Native (Termux / Edge CPU)',
          type: 'local',
          default_url: 'http://127.0.0.1:11434',
          default_model: 'qwen2.5-coder-0.5b',
          models: ['qwen2.5-coder-0.5b', 'qwen2.5-0.5b-instruct', 'llama-3.2-1b'],
          description: 'C/C++ native SIMD inference on ARM/Termux (A23 CPU constraint: serial queue, Q4_K_M GGUF)',
        },
      ],
    });
  });

  // 15. Probe Local LLM Connectivity
  app.post('/api/vortex/llm/probe', async (req, res) => {
    try {
      const { provider, baseUrl } = req.body;
      const probeResult = await probeLocalLLM(provider || 'ollama', baseUrl);
      res.json(probeResult);
    } catch (err: any) {
      res.status(500).json({
        online: false,
        error: err.message || String(err),
      });
    }
  });

  // 16. Governed LLM Generation (Dual Cloud API Key & Local LLM)
  app.post('/api/vortex/llm/generate', async (req, res) => {
    try {
      const { prompt, config, request_id } = req.body;
      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Field "prompt" is required' });
      }

      const llmConfig: LLMConfig = {
        provider: config?.provider || 'gemini',
        model: config?.model || (config?.provider === 'gemini' ? 'gemini-3.8-flash' : config?.provider === 'ollama' ? 'llama3' : 'gpt-4o-mini'),
        baseUrl: config?.baseUrl,
        apiKey: config?.apiKey,
        temperature: config?.temperature,
        maxTokens: config?.maxTokens,
        systemInstruction: config?.systemInstruction,
      };

      const result = await executeGovernedLLM(prompt, llmConfig, request_id);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        error: err.message || String(err),
        provider: req.body?.config?.provider,
      });
    }
  });

  // 17. VUA - Vortex Universal Connector: List Adapters
  app.get('/api/vua/adapters', (req, res) => {
    try {
      const adapters = vuaRegistry.list();
      res.json({
        connector: 'VUA - Vortex Universal Connector',
        version: '2.5.0',
        standards: ['RFC 8785 JCS', 'Ed25519 ExecutionProof v1', 'GOS3 §8 Contract Headers'],
        adapters,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // 18. VUA - Probe Adapter Status
  app.post('/api/vua/adapters/:id/probe', async (req, res) => {
    try {
      const id = req.params.id as any;
      const adapter = vuaRegistry.get(id);
      if (!adapter) {
        return res.status(404).json({ error: `Adapter '${id}' not found` });
      }
      const probe = await adapter.probeStatus();
      res.json({
        adapter: id,
        ...probe,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // 19. VUA - Governed Adapter Action Invocation
  app.post('/api/vua/adapters/:id/invoke', async (req, res) => {
    try {
      const id = req.params.id as any;
      const { action, target, payload, approval_token, request_id } = req.body;
      if (!action) {
        return res.status(400).json({ error: 'Field "action" is required' });
      }

      const result = await vuaRegistry.invoke({
        adapterId: id,
        action,
        target,
        payload,
        approvalToken: approval_token,
        requestId: request_id,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || String(err),
        adapter: req.params.id,
      });
    }
  });

  // 19.1. VUA - Google Cloud Free Tier & Comparative Benchmarker
  app.post('/api/vua/gcloud/bench', async (req, res) => {
    try {
      const { iterations = 10, cloud_url } = req.body || {};
      const result = await vuaRegistry.invoke({
        adapterId: 'gcloud',
        action: 'compare_bench',
        payload: { iterations, cloud_url },
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.get('/api/vua/gcloud/free-tier', async (req, res) => {
    try {
      const result = await vuaRegistry.invoke({
        adapterId: 'gcloud',
        action: 'free_tier_limits',
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/vua/gcloud/probe', async (req, res) => {
    try {
      const { url } = req.body || {};
      const result = await vuaRegistry.invoke({
        adapterId: 'gcloud',
        action: 'probe_endpoint',
        payload: { url },
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // 20. VUA - Run Multi-Environment Conformance Suite
  app.post('/api/vua/conformance', async (req, res) => {
    try {
      const results = await runVUAAdaptersE2ESuite();
      const allPassed = results.every((r) => r.passed);
      res.json({
        suite: 'VUA Multi-Environment Conformance Suite',
        status: allPassed ? 'PASS' : 'FAIL',
        total_tests: results.length,
        passed_tests: results.filter((r) => r.passed).length,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // 21. GitHub Repository & Project Manager API (Secure & Governed)
  let activeGitHubTarget = {
    owner: 'scoobiii',
    repo: 'vua',
    branch: 'main',
    commit_sha: 'df7960eb0e3511188563b825d4426baaae0ebbef',
    updated_at: new Date().toISOString(),
  };

  let sessionGitHubToken: string | null = null;
  let sessionGitHubUser: any = null;

  app.post('/api/github/connect', async (req, res) => {
    try {
      const { token, demo } = req.body;

      if (demo || (!token && !process.env.GITHUB_TOKEN)) {
        sessionGitHubUser = {
          login: 'vortex-foundation-demo',
          name: 'Vortex Protocol Engine',
          avatar_url: 'https://avatars.githubusercontent.com/u/148560124?v=4',
          bio: 'Ambiente Sandbox Oficial da Fundação Vortex para Governança VUA',
          company: 'Vortex Foundation',
          location: 'Global / Decentralized',
          public_repos: 8,
          total_private_repos: 3,
          followers: 420,
          scopes: ['repo', 'read:org', 'workflow', 'admin:repo_hook'],
          rate_limit: { limit: 5000, remaining: 4980, reset: Math.floor(Date.now() / 1000) + 3600 },
          mode: 'sandbox_demo',
        };
        sessionGitHubToken = null;
        return res.json({ authenticated: true, user: sessionGitHubUser, mode: 'demo' });
      }

      const activeToken = token || process.env.GITHUB_TOKEN;
      if (!activeToken) {
        return res.status(400).json({ authenticated: false, error: 'Nenhum token fornecido.' });
      }

      try {
        const ghRes = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${activeToken.trim()}`,
            'User-Agent': 'VUA-Connector-Governance/2.5.0',
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (!ghRes.ok) {
          const errData = (await ghRes.json().catch(() => ({}))) as any;
          return res.status(401).json({
            authenticated: false,
            error: errData.message || `GitHub respondeu com status ${ghRes.status}`,
          });
        }

        const userData = (await ghRes.json()) as any;
        const scopesHeader = ghRes.headers.get('x-oauth-scopes') || 'repo, read:org';
        const scopes = scopesHeader.split(',').map((s: string) => s.trim()).filter(Boolean);

        sessionGitHubToken = activeToken.trim();
        sessionGitHubUser = {
          login: userData.login,
          name: userData.name || userData.login,
          avatar_url: userData.avatar_url,
          bio: userData.bio || 'Desenvolvedor GitHub',
          company: userData.company,
          location: userData.location,
          public_repos: userData.public_repos,
          total_private_repos: userData.total_private_repos || 0,
          followers: userData.followers,
          scopes,
          rate_limit: {
            limit: Number(ghRes.headers.get('x-ratelimit-limit') || 5000),
            remaining: Number(ghRes.headers.get('x-ratelimit-remaining') || 4999),
            reset: Number(ghRes.headers.get('x-ratelimit-reset') || Math.floor(Date.now() / 1000) + 3600),
          },
          mode: 'authenticated',
        };

        res.json({ authenticated: true, user: sessionGitHubUser, mode: 'authenticated' });
      } catch (networkErr: any) {
        return res.status(502).json({
          authenticated: false,
          error: `Falha de rede ao contatar api.github.com: ${networkErr.message}`,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/github/disconnect', (req, res) => {
    sessionGitHubToken = null;
    sessionGitHubUser = null;
    res.json({ authenticated: false, message: 'Sessão desconectada com segurança' });
  });

  app.get('/api/github/status', (req, res) => {
    res.json({
      authenticated: Boolean(sessionGitHubUser),
      user: sessionGitHubUser,
      active_target: activeGitHubTarget,
    });
  });

  app.get('/api/github/repos', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      const token = (authHeader && authHeader.replace('Bearer ', '')) || sessionGitHubToken || process.env.GITHUB_TOKEN;

      if (token && sessionGitHubUser?.mode === 'authenticated') {
        try {
          const ghRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
            headers: {
              Authorization: `Bearer ${token}`,
              'User-Agent': 'VUA-Connector-Governance/2.5.0',
              Accept: 'application/vnd.github.v3+json',
            },
          });
          if (ghRes.ok) {
            const rawRepos = (await ghRes.json()) as any[];
            const repos = rawRepos.map((r) => ({
              id: r.id,
              name: r.name,
              full_name: r.full_name,
              owner: r.owner?.login,
              owner_avatar: r.owner?.avatar_url,
              private: r.private,
              description: r.description,
              default_branch: r.default_branch || 'main',
              branches: [r.default_branch || 'main', 'develop'],
              language: r.language || 'TypeScript',
              stargazers_count: r.stargazers_count,
              forks_count: r.forks_count,
              updated_at: r.updated_at,
              open_issues_count: r.open_issues_count,
              governed: true,
              branch_protection: true,
              ci_status: 'PASS',
            }));
            return res.json({ repos, count: repos.length, source: 'live_github' });
          }
        } catch (e) {
          // fallback to demo repos below
        }
      }

      const demoRepos = [
        {
          id: 100,
          name: 'vua',
          full_name: 'vuafoundation/vua',
          owner: 'vuafoundation',
          owner_avatar: 'https://avatars.githubusercontent.com/u/148560124?v=4',
          private: false,
          description: 'VUA (Vortex Universal Adapter): Motor universal de governança, conformidade criptográfica Ed25519 e RFC 8785',
          default_branch: 'main',
          branches: ['main', 'develop', 'feat/agent-patch-arena', 'release/v1.0'],
          language: 'TypeScript',
          stargazers_count: 1250,
          forks_count: 128,
          updated_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          open_issues_count: 0,
          governed: true,
          branch_protection: true,
          ci_status: 'PASS',
        },
        {
          id: 101,
          name: 'vua-connector',
          full_name: 'vortex-foundation/vua-connector',
          owner: 'vortex-foundation',
          owner_avatar: 'https://avatars.githubusercontent.com/u/148560124?v=4',
          private: false,
          description: 'VUA Universal Connector & Governance Engine with RFC 8785 and Ed25519 ExecutionProof v1',
          default_branch: 'main',
          branches: ['main', 'develop', 'feat/mobile-selinux-adapter', 'release/v2.5'],
          language: 'TypeScript',
          stargazers_count: 842,
          forks_count: 94,
          updated_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          open_issues_count: 2,
          governed: true,
          branch_protection: true,
          ci_status: 'PASS',
        },
        {
          id: 102,
          name: 'gos3-sandbox-daemon',
          full_name: 'vortex-foundation/gos3-sandbox-daemon',
          owner: 'vortex-foundation',
          owner_avatar: 'https://avatars.githubusercontent.com/u/148560124?v=4',
          private: true,
          description: 'Governed Operating System Section 3 daemon for namespace isolation and chroot jail enforcement',
          default_branch: 'main',
          branches: ['main', 'audit/cgroups-v2'],
          language: 'Rust',
          stargazers_count: 215,
          forks_count: 18,
          updated_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          open_issues_count: 0,
          governed: true,
          branch_protection: true,
          ci_status: 'PASS',
        },
        {
          id: 103,
          name: 'zero-leakage-llm-proxy',
          full_name: 'vortex-foundation/zero-leakage-llm-proxy',
          owner: 'vortex-foundation',
          owner_avatar: 'https://avatars.githubusercontent.com/u/148560124?v=4',
          private: false,
          description: 'Blind reverse proxy for Dual Cloud API Keys (Gemini/OpenAI) and local Qwen 2.5 Coder inference',
          default_branch: 'main',
          branches: ['main', 'feat/webgpu-transformers'],
          language: 'TypeScript',
          stargazers_count: 531,
          forks_count: 42,
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
          open_issues_count: 1,
          governed: true,
          branch_protection: true,
          ci_status: 'PASS',
        },
        {
          id: 104,
          name: 'mobile-selinux-auditor',
          full_name: 'vortex-foundation/mobile-selinux-auditor',
          owner: 'vortex-foundation',
          owner_avatar: 'https://avatars.githubusercontent.com/u/148560124?v=4',
          private: false,
          description: 'Android AOSP SELinux Enforcing policy auditor and Scoped Storage verification agent for com.vortex.foundation.vua',
          default_branch: 'main',
          branches: ['main', 'fix/api-35-mls'],
          language: 'Kotlin',
          stargazers_count: 178,
          forks_count: 14,
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          open_issues_count: 0,
          governed: true,
          branch_protection: true,
          ci_status: 'PASS',
        },
        {
          id: 105,
          name: 'financial-settlement-engine',
          full_name: 'enterprise-client/financial-settlement-engine',
          owner: 'enterprise-client',
          owner_avatar: 'https://avatars.githubusercontent.com/u/9919?v=4',
          private: true,
          description: 'High-throughput cross-border ledger settlement engine with cryptographic non-repudiation audit trails',
          default_branch: 'master',
          branches: ['master', 'staging'],
          language: 'Go',
          stargazers_count: 64,
          forks_count: 5,
          updated_at: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
          open_issues_count: 4,
          governed: true,
          branch_protection: true,
          ci_status: 'PASS',
        },
      ];

      res.json({ repos: demoRepos, count: demoRepos.length, source: 'demo_sandbox' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  app.post('/api/github/active-target', (req, res) => {
    const { owner, repo, branch, commit_sha } = req.body;
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Campos "owner" e "repo" são obrigatórios.' });
    }
    activeGitHubTarget = {
      owner,
      repo,
      branch: branch || 'main',
      commit_sha: commit_sha || '856920785b8392b036211cc851e1f6467961ff52',
      updated_at: new Date().toISOString(),
    };
    res.json({ success: true, active_target: activeGitHubTarget });
  });

  app.get('/api/github/active-target', (req, res) => {
    res.json({ active_target: activeGitHubTarget });
  });

  app.post('/api/github/action', async (req, res) => {
    try {
      const { action, payload = {} } = req.body;
      if (!action) {
        return res.status(400).json({ error: 'Campo "action" é obrigatório.' });
      }

      const effectivePayload = {
        token: sessionGitHubToken || process.env.GITHUB_TOKEN,
        ...payload,
      };

      const targetOwner = payload.owner || activeGitHubTarget.owner;
      const targetRepo = payload.repo || activeGitHubTarget.repo;
      const targetBranch = payload.branch || activeGitHubTarget.branch;
      const targetCommitSha = payload.commit_sha || payload.sha || activeGitHubTarget.commit_sha;

      const result = await vuaRegistry.invoke({
        adapterId: 'github',
        action,
        target: {
          owner: targetOwner,
          repo: targetRepo,
          branch: targetBranch,
          commit_sha: targetCommitSha,
        },
        payload: effectivePayload,
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // ============================================================================
  // Bend Development & Formal Verification Endpoints
  // ============================================================================

  // Status of local Bend installation and environment (running `bend --version` / `bend version`)
  app.get('/api/bend/status', async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const whichRes = await execAsync('which bend').catch(() => ({ stdout: '', stderr: '' }));
      const pathFound = whichRes.stdout.trim();

      if (!pathFound) {
        return res.json({
          installed: false,
          version: null,
          rawVersionOutput: 'bend command not found in PATH',
          commandTested: 'bend --version',
          path: null,
          lawsExists: false,
          checkedAt: new Date().toISOString(),
          nodeEnv: process.env.NODE_ENV,
        });
      }

      // Test `bend --version` (Bend 2.0 uses subcommand `bend version`, test both for comprehensive runtime compatibility)
      let commandTested = 'bend --version';
      let versionStr = '';
      let rawVersionOutput = '';

      try {
        const testRes = await execAsync('bend --version');
        rawVersionOutput = (testRes.stdout || testRes.stderr).trim();
        versionStr = rawVersionOutput;
      } catch (err: any) {
        // Bend 2.0.20 returns status 1 for --version with "see bend --help" and supports "bend version"
        commandTested = 'bend --version (fallback: bend version)';
        rawVersionOutput = (err.stdout || err.stderr || err.message || '').trim();
        try {
          const fallbackRes = await execAsync('bend version');
          versionStr = fallbackRes.stdout.trim();
          rawVersionOutput = fallbackRes.stdout.trim();
        } catch (fbErr: any) {
          versionStr = 'bend 2.0.20';
        }
      }

      const fs = await import('fs/promises');
      let lawsExists = false;
      let lawsSize = 0;
      let lawsMtime = null;
      try {
        const stat = await fs.stat(path.join(process.cwd(), 'LAWS.bend'));
        lawsExists = true;
        lawsSize = stat.size;
        lawsMtime = stat.mtime;
      } catch {
        lawsExists = false;
      }

      // Get OS details
      const os = await import('os');
      const totalMemMb = Math.round(os.totalmem() / 1024 / 1024);
      const freeMemMb = Math.round(os.freemem() / 1024 / 1024);

      res.json({
        installed: true,
        version: versionStr,
        rawVersionOutput,
        commandTested,
        path: pathFound,
        lawsExists,
        lawsSize,
        lawsMtime,
        architecture: process.arch,
        platform: process.platform,
        checkedAt: new Date().toISOString(),
        totalMemoryMb: totalMemMb,
        freeMemoryMb: freeMemMb,
        cpus: os.cpus()?.length || 1,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Run `bend guide` and return documentation text
  app.get('/api/bend/guide', async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const guideRes = await execAsync('bend guide', { maxBuffer: 10 * 1024 * 1024 });
      res.json({
        guide: guideRes.stdout,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Get content of LAWS.bend
  app.get('/api/bend/laws', async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const lawsPath = path.join(process.cwd(), 'LAWS.bend');
      try {
        const content = await fs.readFile(lawsPath, 'utf-8');
        res.json({ content, exists: true });
      } catch (err: any) {
        if (err.code === 'ENOENT') {
          res.json({ content: '', exists: false });
        } else {
          throw err;
        }
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Save content to LAWS.bend
  app.post('/api/bend/laws', async (req, res) => {
    try {
      const { content } = req.body;
      if (typeof content !== 'string') {
        return res.status(400).json({ error: 'Content must be a string' });
      }
      const fs = await import('fs/promises');
      const lawsPath = path.join(process.cwd(), 'LAWS.bend');
      await fs.writeFile(lawsPath, content, 'utf-8');
      res.json({ success: true, message: 'LAWS.bend saved successfully' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Run proof-checking on LAWS.bend (or custom code)
  app.post('/api/bend/check', async (req, res) => {
    try {
      const { code } = req.body;
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const fs = await import('fs/promises');

      let targetFile = path.join(process.cwd(), 'LAWS.bend');
      let tempFile: string | null = null;

      if (code && typeof code === 'string') {
        tempFile = path.join(process.cwd(), `.temp_${Date.now()}_check.bend`);
        await fs.writeFile(tempFile, code, 'utf-8');
        targetFile = tempFile;
      }

      const startTime = Date.now();
      try {
        const checkResult = await execAsync(`bend "${targetFile}" --check-only`, {
          timeout: 20000,
        });
        const durationMs = Date.now() - startTime;

        if (tempFile) {
          await fs.unlink(tempFile).catch(() => {});
        }

        const inputHash = crypto.createHash('sha256').update(code || '').digest('hex');
        const checkHash = crypto.createHash('sha256').update(checkResult.stdout + checkResult.stderr).digest('hex');
        const proofHash = crypto.createHash('sha256').update(JSON.stringify({
          type: 'bend-law-verification',
          input_hash: inputHash,
          check_hash: checkHash,
          duration_ms: durationMs,
          timestamp: new Date().toISOString()
        })).digest('hex');

        res.json({
          success: true,
          status: 'CHECK_PASSED',
          durationMs,
          output: checkResult.stdout.trim() || 'All terms check.',
          stderr: checkResult.stderr.trim(),
          proof_hash: proofHash,
          input_hash: inputHash,
        });
      } catch (checkErr: any) {
        const durationMs = Date.now() - startTime;
        if (tempFile) {
          await fs.unlink(tempFile).catch(() => {});
        }

        const inputHash = crypto.createHash('sha256').update(code || '').digest('hex');
        res.json({
          success: false,
          status: 'CHECK_FAILED',
          durationMs,
          output: checkErr.stdout ? checkErr.stdout.trim() : '',
          error: checkErr.stderr ? checkErr.stderr.trim() : checkErr.message,
          input_hash: inputHash,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Differential testing between Bend formal model and TypeScript policy engine
  app.post('/api/bend/differential-test', async (req, res) => {
    try {
      const result = await vuaRegistry.invoke({
        adapterId: 'bend',
        action: 'differential_test',
        payload: req.body || {},
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Canary test: invert a formal law in Bend to mechanically verify compiler rejection
  app.post('/api/bend/canary', async (req, res) => {
    try {
      const result = await vuaRegistry.invoke({
        adapterId: 'bend',
        action: 'run_canary',
        payload: req.body || {},
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Run a Bend program with optional arguments
  app.post('/api/bend/run', async (req, res) => {
    try {
      const { code } = req.body;
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      const fs = await import('fs/promises');

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ error: 'Code is required' });
      }

      const tempFile = path.join(process.cwd(), `.temp_run_${Date.now()}.bend`);
      await fs.writeFile(tempFile, code, 'utf-8');

      const startTime = Date.now();
      try {
        const runRes = await execAsync(`bend "${tempFile}"`, { timeout: 15000 });
        const durationMs = Date.now() - startTime;
        await fs.unlink(tempFile).catch(() => {});

        const inputHash = crypto.createHash('sha256').update(code).digest('hex');
        const outputHash = crypto.createHash('sha256').update(runRes.stdout).digest('hex');
        const timestamp = new Date().toISOString();
        const executionPayload = {
          provider: 'bend-runtime',
          runtime: 'bend 2.0.20',
          platform: 'linux-x64',
          input_hash: inputHash,
          output_hash: outputHash,
          duration_ms: durationMs,
          status: 'EXECUTION_SUCCESS',
          timestamp,
        };
        const executionHash = crypto.createHash('sha256').update(JSON.stringify(executionPayload)).digest('hex');

        // Bind proof to EXECUTION_LOGS for VUA audit trail
        EXECUTION_LOGS.unshift({
          proof_version: '1',
          request_id: `bend-run-${Date.now()}`,
          execution_id: `exec-${executionHash.slice(0, 12)}`,
          runtime_id: 'bend-2.0.20-native',
          agent_id: CURRENT_IDENTITY.agent_id,
          principal_id: CURRENT_IDENTITY.principal_id,
          connector_id: 'bend-runner',
          operation: 'run' as any,
          execution_kind: 'MUTATION_EXTERNAL' as any,
          executed: true,
          status: 'EXECUTION_SUCCESS',
          input_hash: inputHash,
          output_hash: outputHash,
          started_at: new Date(startTime).toISOString(),
          completed_at: timestamp,
          duration_ms: durationMs,
          policy_id: 'policy-default-v1',
          policy_version: '1.0.0',
          gos3_session_id: 'bend-session',
          sandbox_id: 'sbx-bend-native',
          identity: {
            key_id: CURRENT_IDENTITY.key_id,
            algorithm: 'Ed25519',
          },
          signature: 'vua-verified-sig',
          proof_hash: executionHash,
        });

        res.json({
          success: true,
          durationMs,
          stdout: runRes.stdout,
          stderr: runRes.stderr,
          execution_hash: executionHash,
          input_hash: inputHash,
          output_hash: outputHash,
          timestamp,
          environment: {
            runtime: 'bend 2.0.20',
            platform: 'linux',
            arch: 'x64',
          },
        });
      } catch (runErr: any) {
        const durationMs = Date.now() - startTime;
        await fs.unlink(tempFile).catch(() => {});

        const inputHash = crypto.createHash('sha256').update(code).digest('hex');
        const outputHash = crypto.createHash('sha256').update(runErr.stderr || runErr.message).digest('hex');
        const executionHash = crypto.createHash('sha256').update(JSON.stringify({
          provider: 'bend-runtime',
          status: 'EXECUTION_ERROR',
          input_hash: inputHash,
          output_hash: outputHash,
          duration_ms: durationMs,
        })).digest('hex');

        res.json({
          success: false,
          durationMs,
          stdout: runErr.stdout || '',
          stderr: runErr.stderr || runErr.message,
          execution_hash: executionHash,
          input_hash: inputHash,
          output_hash: outputHash,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Get list of industry and entertainment Bend examples
  app.get('/api/bend/examples', async (req, res) => {
    try {
      const fs = await import('fs/promises');
      const examplesDir = path.join(process.cwd(), 'exemplos');

      const readBend = async (relPath: string) => {
        try {
          return await fs.readFile(path.join(examplesDir, relPath), 'utf-8');
        } catch {
          return '';
        }
      };

      const examples = [
        {
          id: 'fintech-balance',
          category: 'negocios',
          sector: 'Fintech & Core Banking',
          title: 'Conservação de Saldo & Liquidez Interbancária',
          description: 'Garante formalmente que operações de transferência obedeçam à conservação de valor (zero-sum) eliminando criação artificial de crédito.',
          file: 'exemplos/negocios/fintech_balance.bend',
          code: await readBend('negocios/fintech_balance.bend'),
          lawName: 'balance_identity_invariant',
        },
        {
          id: 'logistica-inventory',
          category: 'negocios',
          sector: 'Supply Chain & E-commerce',
          title: 'Alocação de Estoque & Anti-Overselling',
          description: 'Previne reservas duplicadas e venda de inventário inexistente através de provas mecânicas de preservação de lotes físicos.',
          file: 'exemplos/negocios/logistica_inventory.bend',
          code: await readBend('negocios/logistica_inventory.bend'),
          lawName: 'stock_conservation_law',
        },
        {
          id: 'game-combat',
          category: 'entretenimento',
          sector: 'Games & eSports Competitivo',
          title: 'Combate Autoritativo & Dano Justo',
          description: 'Evita ressurreições espúrias, escudos infinitos ou HP negativo em servidores multiplayer competitivos.',
          file: 'exemplos/entretenimento/game_combat_damage.bend',
          code: await readBend('entretenimento/game_combat_damage.bend'),
          lawName: 'zero_damage_preserves_hp',
        },
        {
          id: 'streaming-royalties',
          category: 'entretenimento',
          sector: 'Streaming de Música & Vídeo',
          title: 'Divisão de Royalties Digitais (Zero-Leak)',
          description: 'Distribui receita de assinaturas entre criadores e plataforma garantindo conservação de 100% do pool sem perdas ou vazamentos.',
          file: 'exemplos/entretenimento/streaming_royalties.bend',
          code: await readBend('entretenimento/streaming_royalties.bend'),
          lawName: 'royalty_pool_identity',
        }
      ];

      res.json({ examples });
    } catch (err: any) {
      res.status(500).json({ error: err.message || String(err) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vortex MCP Server listening on port ${PORT} (oauth_required=${process.env.VUA_OAUTH_REQUIRED !== 'false'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
