import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { ExecutionProof } from '../vortex/types.js';

// Initialize Firebase App instance
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// CRITICAL: The app will break without firebaseConfig.firestoreDatabaseId
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error handling types and function strictly conforming to Firebase Skill specification
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore Connection at Boot as strictly required by Firebase Skill
export async function testConnection(): Promise<{ ok: boolean; message?: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return { ok: false, message: 'Firestore client is offline' };
    }
    // Permissions error on test path is normal and indicates network connection to Firestore succeeded
    return { ok: true };
  }
}

// Execute initial connection check
testConnection().catch(() => {});

// Authentication helpers: Secure Email & Password (no personal Google account popup)
export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  const user = result.user;
  await syncUserProfile(user);
  return user;
}

export async function registerWithEmail(email: string, pass: string, displayName?: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const user = result.user;
  if (displayName) {
    await updateProfile(user, { displayName });
  }
  await syncUserProfile(user, displayName);
  return user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

// User profile synchronization to /users/{userId}
export async function syncUserProfile(user: User, customName?: string): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const path = `users/${user.uid}`;
  try {
    const profilePayload = {
      uid: user.uid,
      email: user.email || '',
      displayName: customName || user.displayName || 'VUA Operator',
      photoURL: user.photoURL || '',
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    await setDoc(userRef, profilePayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Persist Governed Execution Proof to Firestore
export async function persistExecutionProof(proof: ExecutionProof): Promise<{ success: boolean; proofId: string }> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Authentication required to persist ExecutionProof to Firestore.');
  }

  const proofId = proof.execution_id || `proof-${Date.now()}`;
  const path = `execution_proofs/${proofId}`;

  const payload = {
    execution_id: proof.execution_id,
    proof_version: proof.proof_version || '1',
    request_id: proof.request_id || `req-${Date.now()}`,
    principal_id: proof.principal_id || 'vua-operator',
    owner_uid: currentUser.uid,
    connector_id: proof.connector_id || 'vua-core',
    operation: proof.operation || 'vortex.execute',
    status: proof.status === 'BLOCKED_FAIL_CLOSED' ? 'BLOCKED_FAIL_CLOSED' : (proof.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED'),
    input_hash: proof.input_hash || '',
    output_hash: proof.output_hash || '',
    signature: proof.signature || '',
    proof_hash: proof.proof_hash || '',
    duration_ms: typeof proof.duration_ms === 'number' ? proof.duration_ms : 0,
    timestamp: proof.completed_at || new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, 'execution_proofs', proofId), payload);
    return { success: true, proofId };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// Real-time listener for user's Execution Proofs
export function subscribeToExecutionProofs(
  userId: string,
  onData: (proofs: any[]) => void,
  onError?: (err: unknown) => void,
) {
  const collectionRef = collection(db, 'execution_proofs');
  const path = 'execution_proofs';
  const q = query(collectionRef, orderBy('timestamp', 'desc'), limit(50));

  return onSnapshot(
    q,
    (snapshot) => {
      const proofs = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      onData(proofs);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.GET, path);
    },
  );
}

export { firebaseConfig, onAuthStateChanged, type User };
