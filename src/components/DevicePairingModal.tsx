import React, { useState, useEffect } from 'react';
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
  ArrowRight,
  Wifi,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { 
  activateCustomPairingCode,
  QUICK_CONNECT_CODE,
  connectQuickNetworkRemote,
  connectRemoteWithCode,
  disconnectQuickNetworkRemote,
  getClientPublicIp
} from '../services/remotePairing';

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
  // Tab selector: 'quick' (default gotocinema) vs 'cloud' (6-digit Google code)
  const [activeTab, setActiveTab] = useState<'quick' | 'cloud'>('quick');

  // Quick Connect State
  const [quickInputCode, setQuickInputCode] = useState<string>(QUICK_CONNECT_CODE);
  const [isConnectingQuick, setIsConnectingQuick] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [currentPhoneIp, setCurrentPhoneIp] = useState<string>('Detecting Wi-Fi...');
  const [copiedQuickCode, setCopiedQuickCode] = useState(false);

  // Cloud Sync State
  const [copiedCloudCode, setCopiedCloudCode] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [disconnectStatus, setDisconnectStatus] = useState<string | null>(null);
  const [customCodeInput, setCustomCodeInput] = useState('');
  const [isActivatingCode, setIsActivatingCode] = useState(false);
  const [activationFeedback, setActivationFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Fetch mobile public IP on open to display network
  useEffect(() => {
    if (isOpen) {
      getClientPublicIp().then((ip) => {
        if (ip) setCurrentPhoneIp(ip);
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const displayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?view=display`
    : '?view=display';

  const isQuickConnected = pairingCode === QUICK_CONNECT_CODE;

  // Handle Quick Connect button click
  const handleQuickConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = (quickInputCode || QUICK_CONNECT_CODE).trim();
    if (!clean) return;

    setIsConnectingQuick(true);
    setQuickFeedback(null);
    soundFx.playClick('switch');

    try {
      const res = await connectQuickNetworkRemote(clean);
      if (res.success) {
        soundFx.playClick('ok');
        onSetActiveCode?.(QUICK_CONNECT_CODE);
        setQuickFeedback({
          success: true,
          msg: 'Connected successfully to Remote Display! This device is now the active controller.'
        });
      } else {
        soundFx.playClick('switch');
        setQuickFeedback({
          success: false,
          msg: res.error || 'Connection failed.'
        });
      }
    } catch (err: any) {
      soundFx.playClick('switch');
      setQuickFeedback({
        success: false,
        msg: err?.message || 'Error connecting to Remote Display.'
      });
    } finally {
      setIsConnectingQuick(false);
    }
  };

  const handleDisconnectQuick = async () => {
    soundFx.playClick('switch');
    try {
      setIsConnectingQuick(true);
      await disconnectQuickNetworkRemote();
      onSetActiveCode?.('');
      setQuickFeedback({
        success: true,
        msg: 'Remote disconnected. The display is now unlocked for other devices.'
      });
    } catch (err: any) {
      setQuickFeedback({
        success: false,
        msg: 'Failed to disconnect quick remote.'
      });
    } finally {
      setIsConnectingQuick(false);
    }
  };

  const handleCopyQuick = () => {
    soundFx.playClick('switch');
    navigator.clipboard.writeText(QUICK_CONNECT_CODE);
    setCopiedQuickCode(true);
    setTimeout(() => setCopiedQuickCode(false), 2000);
  };

  const handleCopyCloudCode = () => {
    soundFx.playClick('switch');
    navigator.clipboard.writeText(pairingCode);
    setCopiedCloudCode(true);
    setTimeout(() => setCopiedCloudCode(false), 2000);
  };

  const handleDisconnectCloud = async () => {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn select-none font-sans"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-zinc-950 border border-amber-500/30 rounded-3xl p-5 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-zinc-100 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
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
                Control Remote Display on Smart TV or PC in Real-Time
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

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900/90 rounded-2xl border border-zinc-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick('switch');
              setActiveTab('quick');
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'quick'
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Quick Connect (Wi-Fi)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick('switch');
              setActiveTab('cloud');
            }}
            className={`py-2 px-3 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'cloud'
                ? 'bg-amber-500 text-black shadow-md font-black'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Google Cloud Code</span>
          </button>
        </div>

        {/* TAB 1: SAME-NETWORK QUICK CONNECT (gotocinema) */}
        {activeTab === 'quick' && (
          <div className="flex flex-col gap-4">
            {/* Same Network Status & Wi-Fi IP */}
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Wifi className="w-3.5 h-3.5 text-amber-400" />
                <span>Your Phone Wi-Fi:</span>
                <span className="font-mono font-bold text-white">{currentPhoneIp}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold">
                No Login Required
              </span>
            </div>

            {/* Quick Connect Code Card */}
            <div className="flex flex-col p-4 rounded-2xl bg-black border-2 border-amber-500/40 shadow-inner gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                  Permanent Quick Code
                </span>
                {isQuickConnected && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    CONNECTED (Active Controller)
                  </span>
                )}
              </div>

              {/* Code Box with Copy */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-amber-500/30">
                <span className="text-3xl font-black font-mono tracking-widest text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                  {QUICK_CONNECT_CODE}
                </span>

                <button
                  id="copy-quick-code-modal-btn"
                  type="button"
                  onClick={handleCopyQuick}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-all cursor-pointer"
                  title="Copy Quick Code"
                >
                  {copiedQuickCode ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-amber-400" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Connection Controls */}
              {isQuickConnected ? (
                <div className="flex flex-col gap-2 pt-1">
                  <div className="flex items-center justify-between text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-500/30 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Radio className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
                      <span>This mobile device is currently controlling the TV display!</span>
                    </div>
                  </div>

                  <button
                    id="disconnect-quick-btn"
                    type="button"
                    onClick={handleDisconnectQuick}
                    disabled={isConnectingQuick}
                    className="w-full py-2.5 px-3 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Unplug className="w-3.5 h-3.5 text-red-400" />
                    <span>{isConnectingQuick ? 'Disconnecting...' : 'Disconnect Quick Remote'}</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleQuickConnect} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      id="quick-connect-code-input"
                      type="text"
                      value={quickInputCode}
                      onChange={(e) => setQuickInputCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                      placeholder="gotocinema"
                      className="flex-1 text-center font-mono text-lg font-black py-2 px-3 bg-zinc-900 border border-amber-500/40 rounded-xl text-amber-400 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 tracking-wider"
                    />
                    <button
                      id="connect-quick-remote-btn"
                      type="submit"
                      disabled={isConnectingQuick || !quickInputCode.trim()}
                      className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    >
                      {isConnectingQuick ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <span>Connect TV</span>
                          <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Feedback messages */}
              {quickFeedback && (
                <div className={`p-2.5 rounded-xl text-xs text-center font-medium ${
                  quickFeedback.success 
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border border-red-500/30'
                }`}>
                  {quickFeedback.msg}
                </div>
              )}
            </div>

            {/* Rules and Explanation */}
            <div className="p-3.5 bg-zinc-900/80 rounded-2xl border border-zinc-800 text-[11px] text-zinc-300 space-y-2">
              <div className="text-amber-400 font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5" />
                <span>একই নেটওয়ার্কে কুইক কানেক্ট ব্যবহারের নিয়ম:</span>
              </div>
              <ul className="space-y-1.5 text-zinc-300 list-disc list-inside">
                <li>
                  <strong>Same Network:</strong> আপনার Smart TV/PC এবং এই মোবাইল ডিভাইস অবশ্যই একই Wi-Fi / লোকাল নেটওয়ার্কে থাকতে হবে।
                </li>
                <li>
                  <strong>No Login Needed:</strong> কোনো Google সাইন-ইন ছাড়াই সরাসরি কোড <code className="text-amber-400 font-bold font-mono px-1 py-0.5 bg-black rounded">{QUICK_CONNECT_CODE}</code> দিয়ে রিমোট কন্ট্রোল করা যাবে।
                </li>
                <li>
                  <strong>Single Remote Rule:</strong> ডিসপ্লেতে একসাথে কেবলমাত্র ১টি রিমোট কানেক্ট থাকতে পারবে। অলরেডি কানেক্ট থাকলে অন্য কোনো ডিভাইস কানেক্ট করতে পারবে না।
                </li>
                <li>
                  <strong>Manual Re-connect:</strong> নতুন করে যতবার টিভি ডিসপ্লে ওপেন করা হবে, ততবার কোড দিয়ে কুইক কানেক্ট করতে হবে (অটো-কানেক্ট হবে না)।
                </li>
              </ul>
            </div>

            {/* Launch display link for testing */}
            <a
              id="open-display-test-btn"
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => soundFx.playClick('switch')}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-semibold text-zinc-300 hover:text-white transition-all cursor-pointer"
            >
              <Tv2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Launch Remote Display on TV/PC</span>
              <ExternalLink className="w-3 h-3 text-zinc-400" />
            </a>
          </div>
        )}

        {/* TAB 2: GOOGLE CLOUD CODE (6 DIGITS - ACROSS ANY NETWORK) */}
        {activeTab === 'cloud' && (
          <div className="flex flex-col gap-4">
            {!userEmail ? (
              <div className="flex flex-col items-center text-center gap-3 py-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <ShieldCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white">Google Sign-in Required</h3>
                  <p className="text-xs text-zinc-400 max-w-xs">
                    Sign in with Google to generate a personal 6-digit code that works across mobile data and different Wi-Fi networks.
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
              <div className="flex flex-col gap-3.5">
                {/* 6-Digit Code Box */}
                <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black border-2 border-amber-500/40 shadow-inner">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-400 mb-1">
                    Your 6-Digit Permanent Cloud Code
                  </span>
                  <span className="text-4xl font-black tracking-[0.25em] text-amber-400 font-mono drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] pl-2">
                    {pairingCode && pairingCode !== QUICK_CONNECT_CODE ? pairingCode : '------'}
                  </span>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-emerald-400 font-mono">
                    <Radio className="w-3 h-3 animate-ping" />
                    <span>Firebase Cloud Sync Online</span>
                  </div>
                </div>

                {/* Copy & Launch buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    id="copy-pairing-code-btn"
                    type="button"
                    onClick={handleCopyCloudCode}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-xs font-bold text-white transition-all cursor-pointer"
                  >
                    {copiedCloudCode ? (
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
                    className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
                  >
                    <span>Launch TV Display</span>
                    <ExternalLink className="w-3 h-3 stroke-[2.5]" />
                  </a>
                </div>

                {/* Add / Activate another 6-digit code */}
                <form onSubmit={handleActivateCustomCode} className="p-3 bg-black/60 rounded-2xl border border-zinc-800 flex flex-col gap-2">
                  <label htmlFor="custom-remote-code-input" className="text-[11px] font-bold text-zinc-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>Switch to Another 6-Digit Code:</span>
                    </span>
                  </label>

                  <div className="flex items-center gap-2">
                    <input
                      id="custom-remote-code-input"
                      type="text"
                      maxLength={6}
                      value={customCodeInput}
                      onChange={(e) => setCustomCodeInput(e.target.value.replace(/\D/g, ''))}
                      placeholder="6 digits"
                      className="flex-1 text-center font-mono text-sm font-bold py-1.5 px-3 bg-zinc-900 border border-zinc-700 rounded-xl text-amber-400 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 tracking-widest"
                    />
                    <button
                      id="activate-custom-code-btn"
                      type="submit"
                      disabled={isActivatingCode || customCodeInput.length !== 6}
                      className="py-1.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-bold uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                    >
                      {isActivatingCode ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>Activate</span>
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

                {/* Disconnect button for cloud */}
                {onDisconnectRemote && (
                  <div className="pt-2 border-t border-zinc-800/80 flex flex-col gap-2">
                    <button
                      id="disconnect-remote-display-btn"
                      type="button"
                      onClick={handleDisconnectCloud}
                      disabled={isDisconnecting}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-800/50 text-red-300 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
