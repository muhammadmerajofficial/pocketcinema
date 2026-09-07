import React, { useState } from 'react';
import { 
  X, 
  Tv2, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Radio, 
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Unplug,
  KeyRound,
  ArrowRight
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { activateCustomPairingCode } from '../services/remotePairing';

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairingCode: string;
  userEmail: string;
  onSetActiveCode?: (code: string) => void;
  onRegenerateCode?: () => Promise<void>;
  onOpenLoginModal?: () => void;
  onDisconnectRemote?: () => Promise<void> | void;
}

export const DevicePairingModal: React.FC<DevicePairingModalProps> = ({
  isOpen,
  onClose,
  pairingCode,
  userEmail,
  onSetActiveCode,
  onRegenerateCode,
  onOpenLoginModal,
  onDisconnectRemote
}) => {
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectStatus, setDisconnectStatus] = useState<string | null>(null);

  // Manual code add & activate state
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [isActivatingCode, setIsActivatingCode] = useState(false);
  const [activationFeedback, setActivationFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  if (!isOpen) return null;

  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?view=display`
    : '?view=display';

  const handleCopy = () => {
    soundFx.playClick('switch');
    navigator.clipboard.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = async () => {
    if (!onRegenerateCode || isRegenerating) return;
    try {
      setIsRegenerating(true);
      soundFx.playClick('switch');
      await onRegenerateCode();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDisconnect = async () => {
    soundFx.playClick('switch');
    if (!onDisconnectRemote) return;
    try {
      setIsDisconnecting(true);
      await onDisconnectRemote();
      setDisconnectStatus('Remote Display disconnected successfully!');
      setTimeout(() => setDisconnectStatus(null), 3500);
    } catch (err: any) {
      setDisconnectStatus('Failed to disconnect remote.');
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleActivateCustomCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customCodeInput.trim().replace(/\D/g, '');
    if (clean.length !== 6) {
      setActivationFeedback({ success: false, msg: 'Code must be exactly 6 digits.' });
      return;
    }
    setIsActivatingCode(true);
    setActivationFeedback(null);
    soundFx.playClick('switch');
    try {
      const res = await activateCustomPairingCode(clean, userEmail || 'cinema_host', userEmail || '');
      if (res.valid) {
        try {
          localStorage.setItem('cinematic_remote_pairing_code', clean);
        } catch (_) {}
        onSetActiveCode?.(clean);
        setActivationFeedback({ success: true, msg: `Code #${clean} activated & saved in Firebase!` });
        setCustomCodeInput('');
      } else {
        setActivationFeedback({ success: false, msg: res.error || 'Failed to activate code.' });
      }
    } catch (err: any) {
      setActivationFeedback({ success: false, msg: err?.message || 'Firebase error.' });
    } finally {
      setIsActivatingCode(false);
    }
  };

  return (
    <div 
      id="device-pairing-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none font-sans"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md bg-zinc-950 border border-amber-500/30 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-zinc-100 flex flex-col gap-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Tv2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wide text-white uppercase font-mono flex items-center gap-2">
                TV / REMOTE PAIRING
              </h2>
              <p className="text-[11px] text-zinc-400">
                Sync with Remote Display using Firebase
              </p>
            </div>
          </div>

          <button
            id="close-pairing-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content based on login state */}
        {!userEmail ? (
          <div className="flex flex-col items-center text-center gap-4 py-3">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Login Required for Pairing</h3>
              <p className="text-xs text-zinc-400 max-w-xs">
                Log in with your Gmail to generate a permanent pairing code stored securely in Firebase.
              </p>
            </div>
            <button
              id="login-to-pair-btn"
              type="button"
              onClick={() => {
                onClose();
                onOpenLoginModal?.();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs uppercase tracking-wider hover:brightness-110 shadow-lg cursor-pointer"
            >
              Sign In with Google / Email
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Account Info Pill */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs">
              <span className="text-zinc-400 font-medium">Cloud Pairing Status:</span>
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                Firebase Online
              </span>
            </div>

            {/* Big 6-digit Code Display */}
            <div className="flex flex-col items-center justify-center p-5 rounded-2xl bg-black border-2 border-amber-500/40 shadow-inner">
              <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500 mb-1">
                Your 6-Digit Pairing Code
              </span>
              <div className="flex items-center gap-2">
                <span className="text-4xl sm:text-5xl font-black tracking-[0.25em] text-amber-400 font-mono drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] pl-2">
                  {pairingCode || '------'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-3 text-[11px] text-emerald-400 font-mono">
                <Radio className="w-3 h-3 animate-ping" />
                <span>Live Synced via Firebase</span>
              </div>
            </div>

            {/* Quick Action Buttons: Copy, Direct Link */}
            <div className="grid grid-cols-2 gap-2">
              <button
                id="copy-pairing-code-btn"
                type="button"
                onClick={handleCopy}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-bold text-white transition-all cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copy Code</span>
                  </>
                )}
              </button>

              <a
                id="open-direct-paired-btn"
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundFx.playClick('switch')}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
              >
                <span>Launch Display</span>
                <ExternalLink className="w-3 h-3 stroke-[2.5]" />
              </a>
            </div>

            {/* Manual Activation Instructions */}
            <div className="p-3.5 bg-zinc-900/80 rounded-2xl border border-zinc-800/80 text-[11px] text-zinc-300 space-y-1.5">
              <div className="text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                Connect to Remote Display (TV / Monitor):
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">1.</span>
                <span>Open Remote Display on your TV (<code className="text-amber-300 font-mono">?view=display</code>).</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">2.</span>
                <span>Enter your 6-digit code <strong className="text-amber-300 font-mono tracking-widest">{pairingCode || '------'}</strong> to connect.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400 font-bold">3.</span>
                <span>The Live Display will connect directly and securely. No personal Gmail address is ever displayed on screen!</span>
              </div>
            </div>

            {/* Add & Activate Custom Code on Cinema Remote */}
            <form onSubmit={handleActivateCustomCode} className="p-3.5 bg-black/60 rounded-2xl border border-amber-500/20 flex flex-col gap-2">
              <label htmlFor="custom-remote-code-input" className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>Add / Connect Another Code to this Remote:</span>
                </span>
              </label>

              <div className="flex items-center gap-2">
                <input
                  id="custom-remote-code-input"
                  type="text"
                  maxLength={6}
                  value={customCodeInput}
                  onChange={(e) => setCustomCodeInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6 digits"
                  className="flex-1 text-center font-mono text-base font-bold py-2 px-3 bg-zinc-900 border border-zinc-700 rounded-xl text-amber-400 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 tracking-widest"
                />
                <button
                  id="activate-custom-code-btn"
                  type="submit"
                  disabled={isActivatingCode || customCodeInput.length !== 6}
                  className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                >
                  {isActivatingCode ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>Activate</span>
                      <ArrowRight className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>

              {activationFeedback && (
                <div className={`text-[11px] font-medium text-center py-1 px-2 rounded-lg ${
                  activationFeedback.success 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  {activationFeedback.msg}
                </div>
              )}
            </form>

            {/* Disconnect Remote Display Button */}
            {onDisconnectRemote && (
              <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
                <button
                  id="disconnect-remote-display-btn"
                  type="button"
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                >
                  <Unplug className="w-3.5 h-3.5 text-red-400" />
                  <span>{isDisconnecting ? 'Disconnecting...' : 'Disconnect Remote Display'}</span>
                </button>
                {disconnectStatus && (
                  <p className="text-[11px] text-center text-amber-400 font-mono">
                    {disconnectStatus}
                  </p>
                )}
              </div>
            )}

            {/* How to use */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1.5">
              <div className="font-bold text-zinc-300 flex items-center gap-1.5">
                <Smartphone className="w-3 h-3 text-amber-400" />
                <span>How it works:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px]">
                <li>Open the <span className="text-amber-400 font-semibold">Remote Display</span> on your TV or other device.</li>
                <li>Enter your 6-digit code <span className="font-mono text-amber-400 font-bold">{pairingCode}</span> to activate.</li>
                <li>Any movie you play or control from here plays instantly on the remote display.</li>
                <li>If you disconnect or log out from here, the remote screen disconnects automatically!</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
