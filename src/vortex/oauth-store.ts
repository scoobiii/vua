import { Firestore } from '@google-cloud/firestore';

type Client = { client_id: string; redirect_uris: string[]; client_name?: string };
type Code = { client_id: string; redirect_uri: string; code_challenge: string; scope: string; resource: string; expires_at: number; used: boolean };
type Token = { client_id: string; scope: string; resource: string; expires_at: number };

export interface OAuthStore {
  saveClient(client: Client): Promise<void>;
  getClient(clientId: string): Promise<Client | null>;
  saveCode(codeId: string, code: Code): Promise<void>;
  consumeCode(codeId: string): Promise<Code | null>;
  saveToken(tokenId: string, token: Token): Promise<void>;
  getToken(tokenId: string): Promise<Token | null>;
  deleteToken(tokenId: string): Promise<void>;
  kind: 'firestore' | 'memory';
}

class MemoryOAuthStore implements OAuthStore {
  readonly kind = 'memory' as const;
  private clients = new Map<string, Client>();
  private codes = new Map<string, Code>();
  private tokens = new Map<string, Token>();
  async saveClient(client: Client) { this.clients.set(client.client_id, client); }
  async getClient(clientId: string) { return this.clients.get(clientId) || null; }
  async saveCode(id: string, code: Code) { this.codes.set(id, code); }
  async consumeCode(id: string) {
    const code = this.codes.get(id);
    if (!code || code.used || code.expires_at <= Date.now()) { this.codes.delete(id); return null; }
    this.codes.delete(id);
    return { ...code, used: true };
  }
  async saveToken(id: string, token: Token) { this.tokens.set(id, token); }
  async getToken(id: string) { return this.tokens.get(id) || null; }
  async deleteToken(id: string) { this.tokens.delete(id); }
}

class FirestoreOAuthStore implements OAuthStore {
  readonly kind = 'firestore' as const;
  private db: Firestore;
  constructor() {
    this.db = new Firestore({ projectId: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || process.env.FIREBASE_PROJECT_ID });
  }
  private collection(name: string) { return this.db.collection(`vua_oauth_${name}`); }
  async saveClient(client: Client) { await this.collection('clients').doc(client.client_id).set(client); }
  async getClient(clientId: string) {
    const snap = await this.collection('clients').doc(clientId).get();
    return snap.exists ? snap.data() as Client : null;
  }
  async saveCode(id: string, code: Code) { await this.collection('codes').doc(id).set(code); }
  async consumeCode(id: string) {
    const ref = this.collection('codes').doc(id);
    return this.db.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return null;
      const code = snap.data() as Code;
      if (code.used || code.expires_at <= Date.now()) { tx.delete(ref); return null; }
      tx.delete(ref);
      return { ...code, used: true };
    });
  }
  async saveToken(id: string, token: Token) { await this.collection('tokens').doc(id).set(token); }
  async getToken(id: string) {
    const snap = await this.collection('tokens').doc(id).get();
    return snap.exists ? snap.data() as Token : null;
  }
  async deleteToken(id: string) { await this.collection('tokens').doc(id).delete(); }
}

let singleton: OAuthStore | undefined;
export function getOAuthStore(): OAuthStore {
  if (singleton) return singleton;
  const production = process.env.NODE_ENV === 'production';
  const requested = process.env.OAUTH_STORE || (production ? 'firestore' : 'memory');
  if (requested === 'memory') {
    if (production) throw new Error('OAuth memory store is forbidden in production');
    singleton = new MemoryOAuthStore();
    return singleton;
  }
  if (requested !== 'firestore') throw new Error(`Unsupported OAUTH_STORE: ${requested}`);
  singleton = new FirestoreOAuthStore();
  return singleton;
}

export function resetOAuthStoreForTests(): void { singleton = undefined; }
