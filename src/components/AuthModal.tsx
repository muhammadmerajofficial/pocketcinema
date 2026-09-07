import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Lock, 
  User as UserIcon, 
  Eye, 
  EyeOff, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Settings,
  Unplug
} from 'lucide-react';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile,
  signOut, 
  syncUserToFirestore,
  firebaseConfig,
  type User 
} from '../lib/firebase';
import { disconnectRemoteSession } from '../services/remotePairing';
import { syncManager } from '../utils/syncChannel';
import { soundFx } from '../utils/sound';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User | null;
  pairingCode?: string;
  onOpenPairingModal?: () => void;
  onDisconnectRemote?: () => Promise<void> | void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  pairingCode,
  onOpenPairingModal,
  onDisconnectRemote
}) => {
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfigGuide, setShowConfigGuide] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Google Sign In
  const handleGoogleSignIn = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    soundFx.playClick('switch');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await syncUserToFirestore(result.user);
      setSuccessMsg('Signed in with Google! Your TV Pairing Code is ready.');
      setShowConfigGuide(false);
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
        onOpenPairingModal?.();
      }, 900);
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      if (err.code === 'auth/configuration-not-found' || err.code === 'auth/operation-not-allowed') {
        setError(`Google Sign-In is not enabled yet in your Firebase project (${firebaseConfig.projectId}). You need to enable 'Google' in Firebase Console > Authentication > Sign-in method.`);
        setShowConfigGuide(true);
      } else if (err.code === 'auth/unauthorized-domain') {
        setError("This domain is not authorized in Firebase. Please add this domain to Firebase Console > Authentication > Settings > Authorized domains.");
        setShowConfigGuide(true);
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Google sign-in popup was closed before completing.');
      } else if (err.code === 'auth/popup-blocked') {
        setError('Google sign-in popup was blocked by browser. Please allow popups.');
      } else if (err.code === 'auth/cancelled-popup-request') {
        setError('Sign in request was cancelled.');
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  // Email / Password Form Submit
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    soundFx.playClick('ok');

    try {
      if (mode === 'register') {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const displayName = name.trim() || cleanEmail.split('@')[0];
        
        if (displayName) {
          await updateProfile(userCredential.user, { displayName });
        }

        // Save email, password, and profile to Firestore as requested
        await syncUserToFirestore(userCredential.user, {
          displayName,
          password: password // Stores credentials in Firestore user document as requested
        });

        setSuccessMsg('Account registered successfully!');
        setShowConfigGuide(false);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        
        // Sync login timestamp and credentials to Firestore
        await syncUserToFirestore(userCredential.user, {
          password: password
        });

        setSuccessMsg('Logged in successfully!');
        setShowConfigGuide(false);
      }

      setTimeout(() => {
        onClose();
        setEmail('');
        setPassword('');
        setName('');
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      console.error('Auth Error:', err);
      let message = 'Authentication failed. Please try again.';
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/configuration-not-found') {
        message = "Email/Password sign-in is not enabled yet in your Firebase Console. Please enable 'Email/Password' in Firebase Console > Authentication > Sign-in method.";
        setShowConfigGuide(true);
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      } else if (err.code === 'auth/email-already-in-use') {
        message = 'This email is already registered. Please sign in.';
      } else if (err.code === 'auth/invalid-email') {
        message = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        message = 'Password is too weak. Must be at least 6 characters.';
      } else if (err.message) {
        message = err.message;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Sign Out
  const handleSignOut = async () => {
    soundFx.playClick('switch');
    try {
      if (onDisconnectRemote) {
        await onDisconnectRemote();
      } else if (pairingCode) {
        await disconnectRemoteSession(pairingCode);
        syncManager.broadcast({ type: 'DISCONNECT', timestamp: Date.now() });
      }
      await signOut(auth);
      setSuccessMsg('Logged out. Remote Display has been disconnected.');
      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 900);
    } catch (err: any) {
      setError('Failed to log out.');
    }
  };

  return (
    <div 
      id="auth-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="auth-modal-card"
        className="w-full max-w-md bg-zinc-950 border border-zinc-800/90 rounded-2xl sm:rounded-3xl shadow-2xl shadow-black overflow-hidden flex flex-col relative"
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-zinc-100">
                {currentUser ? 'User Profile' : mode === 'signin' ? 'Sign In to Television' : 'Create Account'}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {currentUser ? 'Manage your account session' : 'Sync your watch history & saved media'}
              </p>
            </div>
          </div>
          <button
            id="auth-modal-close-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 flex flex-col gap-4">
          
          {/* If already logged in, show Profile View */}
          {currentUser ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-zinc-900/70 border border-zinc-800">
                {currentUser.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt={currentUser.displayName || 'User'} 
                    className="w-12 h-12 rounded-full border border-amber-500/40 object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-lg">
                    {(currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-zinc-100 truncate text-sm">
                    {currentUser.displayName || 'Television Member'}
                  </h4>
                  <p className="text-xs text-zinc-400 truncate">
                    {currentUser.email}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      <ShieldCheck className="w-3 h-3" />
                      Firebase Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80 text-xs text-zinc-400 flex flex-col gap-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Provider:</span>
                  <span className="font-medium text-zinc-300">
                    {currentUser.providerData[0]?.providerId === 'google.com' ? 'Google Account' : 'Email & Password'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">User ID:</span>
                  <span className="font-mono text-[11px] text-zinc-400 truncate max-w-[200px]">
                    {currentUser.uid}
                  </span>
                </div>
              </div>

              {pairingCode && (
                <div className="space-y-2">
                  <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/30 flex items-center justify-between shadow-inner">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold text-zinc-400">TV Pairing Code (Firebase)</span>
                      <span className="text-xl font-black font-mono text-amber-400 tracking-widest">
                        {pairingCode}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPairingModal?.();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                    >
                      Pair Info
                    </button>
                  </div>

                  <button
                    id="auth-disconnect-remote-btn"
                    type="button"
                    onClick={async () => {
                      soundFx.playClick('switch');
                      if (onDisconnectRemote) {
                        await onDisconnectRemote();
                      } else if (pairingCode) {
                        await disconnectRemoteSession(pairingCode);
                        syncManager.broadcast({ type: 'DISCONNECT', timestamp: Date.now() });
                      }
                      setSuccessMsg('Remote Display disconnected successfully!');
                      setTimeout(() => setSuccessMsg(null), 3000);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-900/40 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    <span>Disconnect Remote Display</span>
                  </button>
                </div>
              )}

              <button
                id="sign-out-btn"
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-800/50 font-semibold text-sm transition-all cursor-pointer mt-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            </div>
          ) : (
            <>
              {/* Tab Selector: Sign In vs Register */}
              <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    mode === 'signin' 
                      ? 'bg-amber-500 text-black shadow-md' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    mode === 'register' 
                      ? 'bg-amber-500 text-black shadow-md' 
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Register
                </button>
              </div>

              {/* Feedback messages */}
              {error && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{error}</p>
                  </div>
                </div>
              )}

              {/* Firebase Console Setup Guide when configuration-not-found occurs */}
              {showConfigGuide && (
                <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/40 text-xs text-zinc-300 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-amber-400">
                      <Settings className="w-4 h-4" />
                      <span>Firebase Console Setup Required</span>
                    </div>
                    <a
                      href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                    >
                      <span>Open Console</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    To allow users to sign in to <strong className="text-zinc-200">{firebaseConfig.projectId}</strong>:
                  </p>

                  <ol className="list-decimal list-inside text-[11px] text-zinc-300 flex flex-col gap-1">
                    <li>Go to <strong>Authentication &gt; Sign-in method</strong> in Firebase.</li>
                    <li>Click <strong>Google</strong> &rarr; toggle <strong>Enable</strong> &rarr; choose Support Email &rarr; <strong>Save</strong>.</li>
                    <li>Click <strong>Email/Password</strong> &rarr; toggle <strong>Enable</strong> &rarr; <strong>Save</strong>.</li>
                    <li>Under <strong>Settings &gt; Authorized domains</strong>, ensure this domain is added:</li>
                  </ol>

                  <div className="flex items-center justify-between gap-2 p-1.5 bg-black/60 rounded-xl border border-zinc-800 font-mono text-[11px] text-amber-300">
                    <span className="truncate">{typeof window !== 'undefined' ? window.location.hostname : 'domain'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(window.location.hostname);
                          setCopiedDomain(true);
                          setTimeout(() => setCopiedDomain(false), 2000);
                        }
                      }}
                      className="p-1 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white shrink-0 flex items-center gap-1 text-[10px] cursor-pointer transition-colors"
                    >
                      {copiedDomain ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedDomain ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>
              )}

              {successMsg && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Google One-Click Login */}
              <button
                id="google-signin-btn"
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-zinc-200 hover:text-white border border-zinc-700/80 hover:border-zinc-500 transition-all font-semibold text-xs sm:text-sm cursor-pointer shadow-md disabled:opacity-50"
              >
                {/* Official Google G SVG */}
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 my-0.5">
                <div className="flex-1 h-px bg-zinc-800"></div>
                <span className="text-[11px] text-zinc-500 uppercase tracking-wider font-mono">
                  or with email & password
                </span>
                <div className="flex-1 h-px bg-zinc-800"></div>
              </div>

              {/* Email / Password Form */}
              <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
                {mode === 'register' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      Full Name
                    </label>
                    <div className="relative">
                      <UserIcon className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="John Doe"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Email Address (Gmail)
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="yourname@gmail.com"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="submit-auth-form-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>{mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
                  )}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
};
