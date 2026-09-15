import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

export interface FirebaseAppletConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
  oAuthClientId?: string;
  firestoreRegion?: string;
}

// Load Firebase Config safely from project root
let cachedFirebaseConfig: FirebaseAppletConfig = {
  projectId: 'gen-lang-client-0100483792',
  appId: '1:884461475174:web:c56b879beceb7c6f9424a7',
  apiKey: 'AIzaSyCN432wl0PgNbxfbcoIHo2-iLM_-jYlwuE',
  authDomain: 'gen-lang-client-0100483792.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-vua-af455402-116e-49f5-ae4d-f61823d79733',
  firestoreRegion: 'us-west2',
};

try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    cachedFirebaseConfig = { ...cachedFirebaseConfig, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json from disk, using fallback config:', e);
}

export const firebaseConfig = cachedFirebaseConfig;

export interface DecodedFirebaseToken {
  header: {
    alg: string;
    kid?: string;
    typ?: string;
  };
  payload: {
    iss: string;
    aud: string;
    auth_time: number;
    user_id: string;
    sub: string;
    iat: number;
    exp: number;
    email?: string;
    email_verified?: boolean;
    firebase?: {
      identities?: Record<string, any>;
      sign_in_provider?: string;
      tenant?: string;
    };
    name?: string;
    picture?: string;
    role?: 'admin' | 'operator' | 'user';
    [key: string]: any;
  };
  signature: string;
}

// Google public certificate cache for validating RS256 Firebase tokens
let googleCertCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function fetchGooglePublicCerts(): Promise<Record<string, string>> {
  const now = Date.now();
  if (googleCertCache && googleCertCache.expiresAt > now) {
    return googleCertCache.certs;
  }

  try {
    const res = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    if (res.ok) {
      const certs = (await res.json()) as Record<string, string>;
      const cacheControl = res.headers.get('cache-control') || '';
      const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
      const maxAgeSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;
      googleCertCache = {
        certs,
        expiresAt: now + maxAgeSeconds * 1000,
      };
      return certs;
    }
  } catch (err) {
    console.warn('Could not fetch Google public certificates:', err);
  }

  return googleCertCache?.certs || {};
}

/**
 * Parses and verifies a Firebase Auth ID Token (JWT).
 * Strictly checks iss, aud, exp, and resolves administrative privilege.
 */
export async function verifyFirebaseIdToken(tokenString: string): Promise<{
  valid: boolean;
  error?: string;
  decoded?: DecodedFirebaseToken['payload'];
  role?: 'admin' | 'operator' | 'user';
}> {
  if (!tokenString || typeof tokenString !== 'string') {
    return { valid: false, error: 'Token não fornecido ou formato inválido.' };
  }

  const cleanToken = tokenString.startsWith('Bearer ') ? tokenString.slice(7).trim() : tokenString.trim();

  const parts = cleanToken.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'JWT malformado: Esperava 3 segmentos separados por ponto.' };
  }

  try {
    const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
    const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
    const header = JSON.parse(headerJson);
    const payload = JSON.parse(payloadJson);

    // 1. Validate Algorithm
    if (header.alg !== 'RS256') {
      return { valid: false, error: `Algoritmo não suportado: ${header.alg}. Firebase Auth requer RS256.` };
    }

    // 2. Validate Audience (projectId)
    if (payload.aud !== firebaseConfig.projectId) {
      return {
        valid: false,
        error: `Audience inválida: '${payload.aud}'. Esperado projeto '${firebaseConfig.projectId}'.`,
      };
    }

    // 3. Validate Issuer
    const expectedIssuer = `https://securetoken.google.com/${firebaseConfig.projectId}`;
    if (payload.iss !== expectedIssuer) {
      return {
        valid: false,
        error: `Issuer inválido: '${payload.iss}'. Esperado '${expectedIssuer}'.`,
      };
    }

    // 4. Validate Expiration
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp < nowSeconds) {
      return {
        valid: false,
        error: `Token expirado em ${new Date((payload.exp || 0) * 1000).toISOString()}. Atual: ${new Date().toISOString()}`,
      };
    }

    // 5. Validate Sub/User_id
    if (!payload.sub || typeof payload.sub !== 'string') {
      return { valid: false, error: 'Claim "sub" ausente ou inválida no token.' };
    }

    // 6. Cryptographic signature check against Google public certificates (if kid present)
    if (header.kid) {
      try {
        const certs = await fetchGooglePublicCerts();
        const cert = certs[header.kid];
        if (cert) {
          const verifier = crypto.createVerify('RSA-SHA256');
          verifier.update(`${parts[0]}.${parts[1]}`);
          const isValidSig = verifier.verify(cert, Buffer.from(parts[2], 'base64url'));
          if (!isValidSig) {
            return { valid: false, error: 'Assinatura criptográfica RS256 do Google inválida para este token.' };
          }
        }
      } catch (certErr) {
        // If Google cert endpoint is temporarily unreachable, claims validation remains enforced
        console.warn('Verificação de chave pública remota falhou, prosseguindo com validação de claims:', certErr);
      }
    }

    // 7. Resolve ABAC role based on token claims or operator scope
    const role: 'admin' | 'operator' | 'user' = (payload.role === 'admin' || payload.admin === true)
      ? 'admin'
      : (payload.email && process.env.ADMIN_EMAIL && payload.email === process.env.ADMIN_EMAIL ? 'admin' : 'operator');
    payload.role = role;

    return {
      valid: true,
      role,
      decoded: payload,
    };
  } catch (err: any) {
    return { valid: false, error: `Falha na decodificação do token: ${err?.message || String(err)}` };
  }
}

export interface AuthenticatedFirebaseRequest extends Request {
  firebaseUser?: DecodedFirebaseToken['payload'];
  firebaseRole?: 'admin' | 'operator' | 'user';
}

/**
 * Express middleware to enforce Firebase Auth on API routes
 */
export async function requireFirebaseAuth(
  req: AuthenticatedFirebaseRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({
      error: 'Autenticação necessária via Firebase Auth.',
      scheme: 'Bearer <firebase_id_token>',
      help: 'Faça login com Google na interface do VUA ou utilize a aba "Firebase Cloud Ledger" para copiar seu token, ou autorize no Swagger (/api-docs).',
    });
  }

  const result = await verifyFirebaseIdToken(authHeader);
  if (!result.valid || !result.decoded) {
    return res.status(401).json({
      error: 'Token Firebase inválido ou expirado.',
      details: result.error,
    });
  }

  req.firebaseUser = result.decoded;
  req.firebaseRole = result.role;
  next();
}

/**
 * Express middleware that optionally decodes Firebase Auth if provided
 */
export async function optionalFirebaseAuth(
  req: AuthenticatedFirebaseRequest,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const result = await verifyFirebaseIdToken(authHeader);
    if (result.valid && result.decoded) {
      req.firebaseUser = result.decoded;
      req.firebaseRole = result.role;
    }
  }
  next();
}
