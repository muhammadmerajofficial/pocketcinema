import { 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db, User } from '../lib/firebase';
import { CategoryType, MediaItem } from '../types';

export interface RemoteSessionData {
  code: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  isActive?: boolean;
  isConnected?: boolean;
  currentItem: MediaItem | null;
  playingItem: MediaItem | null;
  serverIndex?: number;
  season?: number;
  episode?: number;
  playerAction?: { action: 'play' | 'preview' | 'next'; timestamp: number } | null;
  playerCommand?: { command: string; value?: any; extra?: any; timestamp: number } | null;
  playerStatus?: { isPlaying: boolean; currentTime: number; duration: number; volume: number; isMuted: boolean; activeSeason?: number; activeEpisode?: number; timestamp: number } | null;
  activeCategory: CategoryType;
  searchQuery: string;
  selectedIndex: number;
  updatedAt: any;
  createdAt: any;
  disconnectedAt?: any;
}

// Generate a deterministic permanent 6-digit pairing code for a Gmail address
export function getPermanentCodeForGmail(email: string): string {
  const normalized = (email || '').toLowerCase().trim();
  if (!normalized) {
    return '100000';
  }
  // High-entropy deterministic hash (DJB2 + FNV hybrid)
  let h1 = 0x811c9dc5;
  let h2 = 5381;
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = (Math.imul(h2, 33) ^ code) >>> 0;
  }
  const combined = Math.abs(h1 ^ h2);
  const codeNum = 100000 + (combined % 900000);
  return String(codeNum);
}

// Generate a random 6-digit code fallback
export function generatePairingCode(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return String(num);
}

const LOCAL_CODE_KEY = 'cinematic_remote_pairing_code';

/**
 * Get or register the permanent 6-digit pairing code in Firestore for the logged-in user
 * Exactly one permanent code per Gmail account
 */
export async function getOrCreateUserSession(user: User): Promise<string> {
  if (!user || !user.uid) {
    throw new Error('User must be logged in to create a remote pairing code.');
  }

  // Generate or retrieve the unique permanent code for this Gmail
  const permanentCode = getPermanentCodeForGmail(user.email || user.uid);

  // 1. Ensure user doc has the pairing code saved
  try {
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || 'Cinema Host',
      pairingCode: permanentCode,
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[RemotePairing] user sync warning:', err);
  }

  // 2. Register and auto-save session in remote_sessions with active status
  const sessionRef = doc(db, 'remote_sessions', permanentCode);
  await setDoc(sessionRef, {
    code: permanentCode,
    userId: user.uid,
    userEmail: user.email || '',
    userDisplayName: user.displayName || 'Cinema Host',
    isActive: true,
    isConnected: true,
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });

  return permanentCode;
}

/**
 * Register or activate any 6-digit code from Cinema Remote:
 * Stores it immediately in Firebase remote_sessions so the remote and display pair seamlessly.
 */
export async function activateCustomPairingCode(
  code: string,
  userId: string = '',
  userEmail: string = ''
): Promise<{ valid: boolean; code: string; error?: string }> {
  const cleanCode = code.trim().replace(/\D/g, '');
  if (cleanCode.length !== 6) {
    return { valid: false, code: '', error: 'Pairing code must be exactly 6 digits.' };
  }

  try {
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    await setDoc(sessionRef, {
      code: cleanCode,
      userId: userId || 'remote_host',
      userEmail: userEmail || '',
      isActive: true,
      isConnected: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { valid: true, code: cleanCode };
  } catch (err: any) {
    console.error('[RemotePairing] activateCustomPairingCode error:', err);
    return { valid: false, code: cleanCode, error: err?.message || 'Failed to activate code in Firebase.' };
  }
}

/**
 * Disconnect the remote session from Main Remote:
 * Sets isActive to false, resets playing item, records disconnectedAt.
 * Any listening remote display will immediately detect this and disconnect.
 */
export async function disconnectRemoteSession(code: string): Promise<void> {
  if (!code) return;
  try {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    await setDoc(sessionRef, {
      isActive: false,
      isConnected: false,
      playingItem: null,
      disconnectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (typeof window !== 'undefined') {
      localStorage.removeItem(LOCAL_CODE_KEY);
    }
  } catch (err) {
    console.warn('[RemotePairing] disconnect error:', err);
  }
}

/**
 * Activate or re-connect the remote session from the Remote Display screen:
 * Validates the 6-digit code against Firestore and marks it active and connected.
 */
/**
 * Sanitize data for Firestore by removing any undefined values recursively
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item));
  }
  
  const clean: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      clean[key] = sanitizeFirestoreData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Activate a paired display session with the 6-digit code.
 * If the session already exists, reactivates it.
 * If not, registers it as an active session immediately so the display connects seamlessly.
 */
export async function activateRemoteSession(code: string): Promise<{ 
  valid: boolean; 
  userEmail?: string; 
  data?: RemoteSessionData;
  error?: string;
}> {
  const cleanCode = code.trim().replace(/\D/g, '');
  if (cleanCode.length !== 6) {
    return { valid: false, error: 'Pairing code must be exactly 6 digits.' };
  }

  try {
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      // Auto-register code session as active immediately
      const initialData: Partial<RemoteSessionData> = {
        code: cleanCode,
        userId: 'paired_device',
        userDisplayName: 'Cinema Remote Host',
        isActive: true,
        isConnected: true,
      };
      await setDoc(sessionRef, {
        ...initialData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return { 
        valid: true, 
        data: initialData as RemoteSessionData 
      };
    }
    const data = snap.data() as RemoteSessionData;

    // Reactivate session
    await setDoc(sessionRef, {
      isActive: true,
      isConnected: true,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { 
      valid: true, 
      userEmail: data.userEmail, 
      data: { ...data, isActive: true, isConnected: true } 
    };
  } catch (err: any) {
    console.error('[RemotePairing] activate error:', err);
    return { valid: false, error: err?.message || 'Connection to Firebase failed.' };
  }
}

/**
 * Update the remote session in Firestore so any paired display updates in real time
 */
export async function updateRemoteSession(
  code: string, 
  data: Partial<Omit<RemoteSessionData, 'code' | 'userId' | 'userEmail' | 'createdAt'>>
) {
  if (!code) return;
  try {
    const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    const sanitized = sanitizeFirestoreData(data);
    await setDoc(sessionRef, {
      ...sanitized,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('[RemotePairing] updateRemoteSession error:', err);
  }
}

/**
 * Verify a pairing code entered on the remote display
 */
export async function verifyPairingCode(code: string): Promise<{ 
  valid: boolean; 
  userEmail?: string; 
  data?: RemoteSessionData;
  error?: string;
}> {
  const cleanCode = code.trim().replace(/\s+/g, '');
  if (cleanCode.length !== 6) {
    return { valid: false, error: 'Pairing code must be 6 digits.' };
  }

  try {
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    const snap = await getDoc(sessionRef);
    if (!snap.exists()) {
      return { valid: false, error: 'Code not found. Make sure you are logged in on the Main Remote.' };
    }
    const data = snap.data() as RemoteSessionData;
    return { valid: true, userEmail: data.userEmail, data };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Verification error' };
  }
}

/**
 * Real-time listener for the paired display screen
 */
export function listenToRemoteSession(
  code: string,
  onUpdate: (data: RemoteSessionData | null) => void,
  onError?: (err: Error) => void
): () => void {
  const cleanCode = code.trim();
  const sessionRef = doc(db, 'remote_sessions', cleanCode);

  return onSnapshot(
    sessionRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as RemoteSessionData);
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.error('[RemotePairing] Snapshot error:', err);
      if (onError) onError(err);
    }
  );
}
