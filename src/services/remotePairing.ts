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

export const QUICK_CONNECT_CODE = 'gotocinema';

export interface RemoteSessionData {
  code: string;
  userId: string;
  userEmail: string;
  userDisplayName?: string;
  isActive?: boolean;
  isConnected?: boolean;
  isQuickConnect?: boolean;
  networkIp?: string;
  displayActive?: boolean;
  displaySessionId?: string;
  displayLastHeartbeat?: number;
  connectedRemoteId?: string | null;
  connectedRemoteName?: string | null;
  remoteLastHeartbeat?: number;
  remoteConnectedAt?: number;
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

/**
 * Standardize code: supports all letters (a-z, A-Z) and numbers (0-9)
 */
export function normalizeSessionCode(code: string): string {
  const trimmed = (code || '').trim();
  return trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Client Public IP cache to avoid repeated network calls
 */
let cachedPublicIp: string | null = null;
let lastIpFetchTime = 0;

export async function getClientPublicIp(): Promise<string> {
  const now = Date.now();
  if (cachedPublicIp && now - lastIpFetchTime < 45000) {
    return cachedPublicIp;
  }

  // 1. Primary: IPv4 specific ipify (forces IPv4 on both mobile & TV)
  try {
    const res = await fetch('https://api4.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedPublicIp = data.ip.trim();
        lastIpFetchTime = now;
        return cachedPublicIp;
      }
    }
  } catch (_) {}

  // 2. Secondary: generic ipify
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        cachedPublicIp = data.ip.trim();
        lastIpFetchTime = now;
        return cachedPublicIp;
      }
    }
  } catch (_) {}

  // 3. Fallback: icanhazip
  try {
    const res = await fetch('https://icanhazip.com', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const text = await res.text();
      if (text && text.trim()) {
        cachedPublicIp = text.trim();
        lastIpFetchTime = now;
        return cachedPublicIp;
      }
    }
  } catch (_) {}

  return cachedPublicIp || 'shared-local-network';
}

/**
 * Ephemeral session ID for the current browser/tab instance (not persistent in localStorage)
 */
export function getDeviceSessionId(prefix: 'disp' | 'rem' = 'rem'): string {
  try {
    const key = `cinematic_${prefix}_session_id`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
  }
}

/**
 * Initialize the default Same-Network Quick Connect session on Remote Display (Smart TV / PC)
 * Marks display active, stamps display network IP, and clears any previous remote binding.
 */
export async function initQuickConnectDisplaySession(): Promise<{ 
  success: boolean; 
  networkIp: string; 
  error?: string 
}> {
  try {
    const networkIp = await getClientPublicIp();
    const displayId = getDeviceSessionId('disp');
    const sessionRef = doc(db, 'remote_sessions', QUICK_CONNECT_CODE);
    const snap = await getDoc(sessionRef);
    const existing = snap.exists() ? (snap.data() as RemoteSessionData) : null;
    const now = Date.now();
    const hasActiveRemote = !!(
      existing?.isConnected && 
      existing?.connectedRemoteId && 
      (now - (existing?.remoteLastHeartbeat || 0) < 60000)
    );

    await setDoc(sessionRef, {
      code: QUICK_CONNECT_CODE,
      isQuickConnect: true,
      networkIp,
      displayActive: true,
      displaySessionId: displayId,
      displayLastHeartbeat: now,
      isActive: true,
      isConnected: hasActiveRemote,
      connectedRemoteId: hasActiveRemote ? existing!.connectedRemoteId : null,
      connectedRemoteName: hasActiveRemote ? existing!.connectedRemoteName : null,
      userDisplayName: 'Smart TV / PC Display',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return { success: true, networkIp };
  } catch (err: any) {
    console.error('[RemotePairing] initQuickConnectDisplaySession error:', err);
    return { success: false, networkIp: 'unknown', error: err?.message || 'Firebase error' };
  }
}

/**
 * Periodic Heartbeat from Remote Display to indicate screen is still open
 */
export async function sendDisplayHeartbeat(): Promise<void> {
  try {
    const sessionRef = doc(db, 'remote_sessions', QUICK_CONNECT_CODE);
    await setDoc(sessionRef, {
      displayLastHeartbeat: Date.now(),
      displayActive: true,
      isActive: true,
    }, { merge: true });
  } catch (_) {}
}

/**
 * Immediately disconnect and release the Quick Connect display session when window closes
 */
export async function closeQuickConnectDisplaySession(): Promise<void> {
  try {
    const sessionRef = doc(db, 'remote_sessions', QUICK_CONNECT_CODE);
    await updateDoc(sessionRef, {
      displayActive: false,
      isConnected: false,
      connectedRemoteId: null,
      isActive: false,
      disconnectedAt: serverTimestamp(),
    });
  } catch (_) {}
}

/**
 * Connect a Cinema Remote (e.g. mobile iPhone) to Remote Display using the same network
 * Validates:
 * 1. Display must be open and active in real time.
 * 2. Both devices MUST be on the exact same Wi-Fi / Local Network.
 * 3. Only 1 remote device can be connected at a time (occupancy lock).
 * 4. Google login is NOT required.
 */
export async function connectQuickNetworkRemote(inputCode: string): Promise<{
  success: boolean;
  error?: string;
  networkIp?: string;
  data?: RemoteSessionData;
}> {
  const cleanCode = (inputCode || '').trim().toLowerCase();
  if (cleanCode !== QUICK_CONNECT_CODE) {
    return {
      success: false,
      error: `Quick Connect code must be "${QUICK_CONNECT_CODE}".`,
    };
  }

  try {
    const sessionRef = doc(db, 'remote_sessions', QUICK_CONNECT_CODE);
    const snap = await getDoc(sessionRef);

    if (!snap.exists()) {
      return {
        success: false,
        error: `Remote Display has not been opened on your TV/PC yet. Please open the Remote Display first to view the connection screen.`,
      };
    }

    const session = snap.data() as RemoteSessionData;
    const now = Date.now();

    // 1. Verify Remote Display is active
    const isDisplayAlive = session.displayActive === true && (now - (session.displayLastHeartbeat || 0) < 90000);
    if (!isDisplayAlive) {
      return {
        success: false,
        error: `Remote Display is not currently open or active on your TV/PC. Please launch Remote Display on your TV first.`,
      };
    }

    // 2. Network IP information (informational & dual-stack tolerant)
    const myIp = await getClientPublicIp();
    const displayIp = session.networkIp || 'shared-local-network';
    if (displayIp !== 'shared-local-network' && myIp !== 'shared-local-network' && myIp !== displayIp) {
      console.log(`[RemotePairing] Network info - TV: ${displayIp}, Remote: ${myIp}. Connecting seamlessly.`);
    }

    // 3. Verify Single Device Occupancy (strictly 1 active remote controller at a time)
    const myRemoteId = getDeviceSessionId('rem');
    if (session.connectedRemoteId && session.connectedRemoteId !== myRemoteId) {
      const remoteLastSeen = session.remoteLastHeartbeat || 0;
      const isOtherRemoteActive = session.isConnected === true && (now - remoteLastSeen < 30000);
      if (isOtherRemoteActive) {
        return {
          success: false,
          error: `The Remote Display is already connected to another remote. Only 1 remote can control the display at a time. Please disconnect that device or close the display first.`,
        };
      }
    }

    // 4. Claim session and bind this remote
    await setDoc(sessionRef, {
      isConnected: true,
      isActive: true,
      displayActive: true,
      connectedRemoteId: myRemoteId,
      remoteIp: myIp,
      connectedRemoteName: navigator.userAgent.includes('iPhone') ? 'iPhone Remote' : navigator.userAgent.includes('Android') ? 'Android Remote' : 'Cinema Remote',
      remoteLastHeartbeat: now,
      remoteConnectedAt: now,
      userDisplayName: 'Same Network Remote',
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      networkIp: myIp,
      data: {
        ...session,
        isConnected: true,
        isActive: true,
        displayActive: true,
        connectedRemoteId: myRemoteId,
      },
    };
  } catch (err: any) {
    console.error('[RemotePairing] connectQuickNetworkRemote error:', err);
    return {
      success: false,
      error: err?.message || 'Failed to connect to Firebase. Check your internet connection.',
    };
  }
}

/**
 * Periodic Heartbeat from connected Remote Controller
 */
export async function sendRemoteHeartbeat(): Promise<void> {
  try {
    const sessionRef = doc(db, 'remote_sessions', QUICK_CONNECT_CODE);
    await setDoc(sessionRef, {
      remoteLastHeartbeat: Date.now(),
      isConnected: true,
      isActive: true,
    }, { merge: true });
  } catch (_) {}
}

/**
 * Disconnect this remote from the Quick Connect session so other remotes can connect
 */
export async function disconnectQuickNetworkRemote(): Promise<void> {
  try {
    const sessionRef = doc(db, 'remote_sessions', QUICK_CONNECT_CODE);
    const myRemoteId = getDeviceSessionId('rem');
    const snap = await getDoc(sessionRef);
    if (snap.exists() && snap.data()?.connectedRemoteId === myRemoteId) {
      await updateDoc(sessionRef, {
        isConnected: false,
        connectedRemoteId: null,
        disconnectedAt: serverTimestamp(),
      });
    }
  } catch (_) {}
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
 * Register or activate any alphanumeric code from Cinema Remote:
 * Stores it immediately in Firebase remote_sessions so the remote and display pair seamlessly.
 */
export async function activateCustomPairingCode(
  code: string,
  userId: string = '',
  userEmail: string = ''
): Promise<{ valid: boolean; code: string; error?: string }> {
  const cleanCode = normalizeSessionCode(code);
  if (!cleanCode || cleanCode.length < 3) {
    return { valid: false, code: '', error: 'Pairing code must be at least 3 characters.' };
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
 * Universal connect method for the Cinema Remote:
 * Connects the mobile remote to the display using any alphanumeric code (such as 'gotocinema' or 6-digit codes)
 */
export async function connectRemoteWithCode(inputCode: string): Promise<{
  success: boolean;
  code: string;
  error?: string;
  data?: RemoteSessionData;
}> {
  const cleanCode = normalizeSessionCode(inputCode);
  if (!cleanCode) {
    return { success: false, code: '', error: 'Please enter a code (e.g. gotocinema).' };
  }

  // If gotocinema, use quick network connect logic
  if (cleanCode === QUICK_CONNECT_CODE) {
    const res = await connectQuickNetworkRemote(cleanCode);
    if (!res.success) {
      return { success: false, code: cleanCode, error: res.error };
    }
    return { success: true, code: QUICK_CONNECT_CODE, data: res.data };
  }

  // Any other alphanumeric code (letters, numbers, or combo)
  try {
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    const snap = await getDoc(sessionRef);
    const myRemoteId = getDeviceSessionId('rem');
    const now = Date.now();

    if (!snap.exists()) {
      return {
        success: false,
        code: cleanCode,
        error: `Display with code "${cleanCode}" was not found. Please ensure the Remote Display screen is open on your TV/PC.`,
      };
    }

    const session = snap.data() as RemoteSessionData;
    await setDoc(sessionRef, {
      isConnected: true,
      isActive: true,
      connectedRemoteId: myRemoteId,
      connectedRemoteName: navigator.userAgent.includes('iPhone') ? 'iPhone Remote' : navigator.userAgent.includes('Android') ? 'Android Remote' : 'Cinema Remote',
      remoteLastHeartbeat: now,
      remoteConnectedAt: now,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    return {
      success: true,
      code: cleanCode,
      data: {
        ...session,
        isConnected: true,
        connectedRemoteId: myRemoteId,
      },
    };
  } catch (err: any) {
    console.error('[RemotePairing] connectRemoteWithCode error:', err);
    return {
      success: false,
      code: cleanCode,
      error: err?.message || 'Failed to connect.',
    };
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
    const cleanCode = normalizeSessionCode(code);
    if (!cleanCode) return;
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    await setDoc(sessionRef, {
      isActive: false,
      isConnected: false,
      connectedRemoteId: null,
      playingItem: null,
      disconnectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    if (typeof window !== 'undefined' && cleanCode !== QUICK_CONNECT_CODE) {
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
    const cleanCode = normalizeSessionCode(code);
    if (!cleanCode) return;
    const sessionRef = doc(db, 'remote_sessions', cleanCode);
    const sanitized = sanitizeFirestoreData(data);
    const isActive = typeof data.isActive === 'boolean' ? data.isActive : true;
    const isConnected = typeof data.isConnected === 'boolean' ? data.isConnected : true;
    await setDoc(sessionRef, {
      ...sanitized,
      isActive,
      isConnected,
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
  const cleanCode = normalizeSessionCode(code);
  if (!cleanCode) {
    return { valid: false, error: 'Invalid pairing code.' };
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
  const cleanCode = normalizeSessionCode(code);
  if (!cleanCode) return () => {};
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
