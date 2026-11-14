import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signOut as fbSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocFromServer,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { PlayerProfile, GeneralSkillId } from './types';
import { savePlayerProfile, MAX_PLAYER_LEVEL } from './utils/progression';

export const ADMIN_EMAIL = 'emquan292011@gmail.com';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

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
      providerInfo:
        auth.currentUser?.providerData?.map(provider => ({
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

// Test connection on boot safely (skip offline to avoid noisy console errors)
export async function testConnection(): Promise<void> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase hiện đang ngoại tuyến, chuyển sang chế độ chơi offline.');
    }
  }
}
testConnection();

export interface UserAccountData {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  level: number;
  exp: number;
  pixelCoins: number;
  purchasedGenerals: string[];
  selectedGeneral: string;
  updatedAt?: any;
}

export function isUserAdmin(user: FirebaseUser | null): boolean {
  if (!user || !user.email) return false;
  if (!user.emailVerified) return false;
  return user.email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

/**
 * Verify admin rights directly against Firestore Security Rules on the server.
 * Returns true if server allows admin writes, false if rejected with permission error.
 */
export async function verifyAdminOnServer(user: FirebaseUser): Promise<boolean> {
  if (!isUserAdmin(user)) return false;
  const testDocRef = doc(db, 'admin_configs', 'server_verification');
  try {
    await setDoc(testDocRef, {
      id: 'server_verification',
      updatedBy: user.uid,
      verifiedEmail: user.email,
      timestamp: new Date().toISOString(),
    }, { merge: true });
    return true;
  } catch (error) {
    console.warn('Server-side admin verification failed:', error);
    return false;
  }
}

/**
 * Sync player profile to Firestore under user document
 */
export async function syncProfileToFirestore(user: FirebaseUser, profile: PlayerProfile): Promise<void> {
  if (!user) return;
  const userDocRef = doc(db, 'users', user.uid);
  const isAdmin = isUserAdmin(user);

  const payload = {
    id: user.uid,
    email: user.email || '',
    displayName: user.displayName || user.email?.split('@')[0] || 'Chỉ Huy',
    role: (isAdmin ? 'admin' : 'user') as 'admin' | 'user',
    level: profile.level,
    exp: profile.exp,
    pixelCoins: profile.pixelCoins,
    purchasedGenerals: profile.purchasedGenerals || [],
    selectedGeneral: profile.selectedGeneral || 'INSPIRE_AURA',
    skillPoints: profile.skillPoints || 0,
    skillTree: profile.skillTree || {
      economyLevel: 0,
      militaryLevel: 0,
      heroLevel: 0,
      chosenHybrid: null,
    },
    updatedAt: new Date().toISOString(),
  };

  try {
    await setDoc(userDocRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

/**
 * Load user profile from Firestore and merge with local progress (preserving offline EXP/levels)
 */
export async function loadProfileFromFirestore(user: FirebaseUser, localFallback: PlayerProfile): Promise<{ profile: PlayerProfile; isAdmin: boolean }> {
  if (!user) return { profile: localFallback, isAdmin: false };
  const userDocRef = doc(db, 'users', user.uid);
  const isAdmin = isUserAdmin(user);

  try {
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const tree = data.skillTree || localFallback.skillTree || {};

      const cloudLevel = typeof data.level === 'number' ? data.level : 1;
      const cloudExp = typeof data.exp === 'number' ? data.exp : 0;
      const cloudCoins = typeof data.pixelCoins === 'number' ? data.pixelCoins : 0;
      const cloudGenerals = Array.isArray(data.purchasedGenerals) ? data.purchasedGenerals : [];

      const localLevel = localFallback.level || 1;
      const localExp = localFallback.exp || 0;
      const localCoins = localFallback.pixelCoins || 0;
      const localGenerals = Array.isArray(localFallback.purchasedGenerals) ? localFallback.purchasedGenerals : [];

      // Smart merge: preserve highest level/EXP gained offline
      const mergedLevel = Math.max(cloudLevel, localLevel);
      let mergedExp = localExp;
      if (cloudLevel > localLevel) {
        mergedExp = cloudExp;
      } else if (localLevel > cloudLevel) {
        mergedExp = localExp;
      } else {
        mergedExp = Math.max(cloudExp, localExp);
      }

      const mergedCoins = Math.max(cloudCoins, localCoins);
      const generalSet = new Set<string>([...cloudGenerals, ...localGenerals]);
      const mergedGenerals = Array.from(generalSet);

      const mergedSelected = localFallback.selectedGeneral || data.selectedGeneral || 'INSPIRE_AURA';

      // Merge skill tree levels safely using Math.max
      const cloudEco = Number(tree.economyLevel) || 0;
      const cloudMil = Number(tree.militaryLevel) || 0;
      const cloudHero = Number(tree.heroLevel) || 0;
      const cloudHybrid = tree.chosenHybrid || null;

      const localEco = localFallback.skillTree?.economyLevel || 0;
      const localMil = localFallback.skillTree?.militaryLevel || 0;
      const localHero = localFallback.skillTree?.heroLevel || 0;
      const localHybrid = localFallback.skillTree?.chosenHybrid || null;

      const mergedEco = Math.min(10, Math.max(cloudEco, localEco));
      const mergedMil = Math.min(10, Math.max(cloudMil, localMil));
      const mergedHero = Math.min(10, Math.max(cloudHero, localHero));
      const mergedHybrid = cloudHybrid || localHybrid || null;

      const totalSpent = mergedEco + mergedMil + mergedHero + (mergedHybrid ? 1 : 0);
      const expectedTotalPoints = mergedLevel * 3;
      const mergedSkillPoints = Math.max(0, expectedTotalPoints - totalSpent);

      const profile: PlayerProfile = {
        level: mergedLevel,
        exp: mergedLevel >= MAX_PLAYER_LEVEL ? 0 : mergedExp,
        pixelCoins: mergedCoins,
        purchasedGenerals: mergedGenerals as GeneralSkillId[],
        selectedGeneral: mergedSelected as GeneralSkillId,
        skillPoints: mergedSkillPoints,
        skillTree: {
          economyLevel: mergedEco,
          militaryLevel: mergedMil,
          heroLevel: mergedHero,
          chosenHybrid: mergedHybrid,
        },
      };

      // Synchronize merged state back to both Firestore cloud and local storage
      await syncProfileToFirestore(user, profile);
      savePlayerProfile(profile);

      return { profile, isAdmin };
    } else {
      // First time user: save local progression to cloud
      await syncProfileToFirestore(user, localFallback);
      return { profile: localFallback, isAdmin };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
  }
}

export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  fbSignOut,
  onAuthStateChanged,
};
