import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut, 
  onAuthStateChanged,
  type User 
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  setDoc, 
  getDoc, 
  getDocFromServer,
  serverTimestamp 
} from "firebase/firestore";
import appletConfig from "../../firebase-applet-config.json";

// Provisioned Firebase configuration
export const firebaseConfig = {
  apiKey: appletConfig.apiKey,
  authDomain: appletConfig.authDomain,
  projectId: appletConfig.projectId,
  storageBucket: appletConfig.storageBucket,
  messagingSenderId: appletConfig.messagingSenderId,
  appId: appletConfig.appId,
  measurementId: appletConfig.measurementId || ""
};

// Initialize Firebase safely
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const db = (() => {
  try {
    const dbId = appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== "(default)"
      ? appletConfig.firestoreDatabaseId
      : undefined;
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    }, dbId);
  } catch {
    return appletConfig.firestoreDatabaseId && appletConfig.firestoreDatabaseId !== "(default)"
      ? getFirestore(app, appletConfig.firestoreDatabaseId)
      : getFirestore(app);
  }
})();

// Test Firestore connection as required by Firebase skill
export async function checkFirebaseStatus(): Promise<{ connected: boolean; message: string }> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { connected: true, message: 'Firebase Online' };
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return { connected: false, message: 'Firebase Client Offline' };
    }
    // Permission or other benign Firestore response means Firestore is reachable
    return { connected: true, message: 'Firebase Active' };
  }
}

async function testConnection() {
  try {
    await checkFirebaseStatus();
  } catch (_) {}
}
testConnection();

// Save or update user profile & credentials in Firestore 'users' collection
export async function syncUserToFirestore(
  user: User, 
  additionalData?: { password?: string; displayName?: string }
) {
  if (!user || !user.uid) return;

  try {
    const userRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(userRef);

    const baseData: Record<string, any> = {
      uid: user.uid,
      email: user.email || "",
      displayName: additionalData?.displayName || user.displayName || "Viewer",
      photoURL: user.photoURL || null,
      provider: user.providerData?.[0]?.providerId || "password",
      lastLoginAt: serverTimestamp(),
    };

    if (additionalData?.password) {
      baseData.password = additionalData.password;
    }

    if (!docSnap.exists()) {
      baseData.createdAt = serverTimestamp();
      await setDoc(userRef, baseData);
    } else {
      await setDoc(userRef, baseData, { merge: true });
    }
  } catch (error) {
    console.error("Error writing user to Firestore:", error);
  }
}

export { 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut, 
  onAuthStateChanged,
  type User 
};
