import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv2, 
  Star, 
  Clock, 
  Maximize, 
  Minimize, 
  Maximize2,
  KeyRound, 
  RefreshCw, 
  Sparkles,
  Wifi,
  Copy,
  Check,
  ShieldAlert,
  Smartphone,
  Unplug
} from 'lucide-react';
import { MediaItem, CategoryType } from '../types';
import { loadCategoryMedia } from '../services/api';
import { FullScreenRemotePlayer } from './FullScreenRemotePlayer';
import { syncManager, DisplaySyncState, SyncMessage } from '../utils/syncChannel';
import { 
  verifyPairingCode, 
  activateRemoteSession, 
  disconnectRemoteSession, 
  listenToRemoteSession, 
  RemoteSessionData, 
  updateRemoteSession,
  QUICK_CONNECT_CODE,
  initQuickConnectDisplaySession,
  sendDisplayHeartbeat,
  closeQuickConnectDisplaySession
} from '../services/remotePairing';
import { checkFirebaseStatus } from '../lib/firebase';
import { soundFx } from '../utils/sound';

export const LiveDisplayScreen: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedQuickCode, setCopiedQuickCode] = useState(false);
  const [displayNetworkIp, setDisplayNetworkIp] = useState<string>('Detecting Wi-Fi...');

  // Pairing State - restore active pairing code from URL or localStorage (excluding gotocinema to avoid stale auto-reconnects)
  const [pairingCode, setPairingCode] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('code');
      if (codeFromUrl && codeFromUrl.trim().length === 6) {
        return codeFromUrl.trim();
      }
      const saved = localStorage.getItem('cinematic_paired_code') || '';
      return saved === QUICK_CONNECT_CODE ? '' : saved;
    } catch {
      return '';
    }
  });
  const [isPaired, setIsPaired] = useState<boolean>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const codeFromUrl = urlParams.get('code');
      const savedCode = localStorage.getItem('cinematic_paired_code');
      return !!((codeFromUrl && codeFromUrl.trim().length === 6) || (savedCode && savedCode !== QUICK_CONNECT_CODE));
    } catch {
      return false;
    }
  });
  const [pairedEmail, setPairedEmail] = useState<string>('');

  // Initialize gotocinema Same-Network session on Firebase when Display is opened
  useEffect(() => {
    let isMounted = true;
    initQuickConnectDisplaySession().then((res) => {
      if (isMounted && res.success) {
        setDisplayNetworkIp(res.networkIp);
      }
    });

    const heartbeatTimer = setInterval(() => {
      sendDisplayHeartbeat();
    }, 10000);

    const handleBeforeUnload = () => {
      closeQuickConnectDisplaySession();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);

    return () => {
      isMounted = false;
      clearInterval(heartbeatTimer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
    };
  }, []);

  // Media Display State
  const [currentItem, setCurrentItem] = useState<MediaItem | null>(() => {
    const saved = syncManager.getState();
    return saved ? saved.currentItem : null;
  });

  const [playingItem, setPlayingItem] = useState<MediaItem | null>(() => {
    const saved = syncManager.getState();
    return saved ? saved.playingItem : null;
  });

  // Real-time Player Server & Episode Sync
  const [serverIndex, setServerIndex] = useState<number>(() => {
    const saved = syncManager.getState();
    return typeof saved?.serverIndex === 'number' ? saved.serverIndex : 0;
  });
  const [season, setSeason] = useState<number>(() => {
    const saved = syncManager.getState();
    return typeof saved?.season === 'number' ? saved.season : 1;
  });
  const [episode, setEpisode] = useState<number>(() => {
    const saved = syncManager.getState();
    return typeof saved?.episode === 'number' ? saved.episode : 1;
  });

  const [activeCategory, setActiveCategory] = useState<CategoryType>(() => {
    const saved = syncManager.getState();
    return saved ? saved.activeCategory : 'movies';
  });

  const [searchQuery, setSearchQuery] = useState<string>(() => {
    const saved = syncManager.getState();
    return saved ? saved.searchQuery : '';
  });

  const [isLoading, setIsLoading] = useState(!currentItem);
  const [remotePlayerAction, setRemotePlayerAction] = useState<{ action: 'play' | 'preview' | 'next'; timestamp: number } | null>(null);
  const [latestCommand, setLatestCommand] = useState<{ command: string; value?: any; extra?: any; timestamp: number } | null>(null);
  const lastCommandTimestampRef = useRef<number>(0);

  // Auto-connect on mount if 6-digit pairing code exists in localStorage or URL
  useEffect(() => {
    if (pairingCode && pairingCode.length === 6) {
      activateRemoteSession(pairingCode)
        .then((res) => {
          if (res.valid) {
            setIsPaired(true);
            try {
              localStorage.setItem('cinematic_paired_code', pairingCode);
            } catch (_) {}
            if (res.data?.playingItem) setPlayingItem(res.data.playingItem);
            if (res.data?.currentItem) setCurrentItem(res.data.currentItem);
          }
        })
        .catch((err) => console.warn('[LiveDisplay] Auto-activation note:', err));
    }
  }, []);

  // Unified Real-time Firebase listener: handles both gotocinema and 6-digit sessions seamlessly
  useEffect(() => {
    const targetCode = pairingCode || QUICK_CONNECT_CODE;
    console.log('[LiveDisplayScreen] Subscribing to session:', targetCode);

    const unsubscribeFirebase = listenToRemoteSession(
      targetCode,
      (data: RemoteSessionData | null) => {
        if (!data) return;

        // If explicitly disconnected by remote
        if (data.isActive === false && data.isConnected === false && data.disconnectedAt) {
          console.log('[LiveDisplayScreen] Remote session explicitly disconnected');
          setIsPaired(false);
          setPlayingItem(null);
          setPairedEmail('');
          if (targetCode !== QUICK_CONNECT_CODE) {
            setPairingCode('');
            try {
              localStorage.removeItem('cinematic_paired_code');
              window.history.replaceState({}, '', window.location.pathname + '?view=display');
            } catch (_) {}
          }
          return;
        }

        // When a remote controller connects
        if (data.isConnected) {
          setIsPaired(true);
          if (data.code && !pairingCode) {
            setPairingCode(data.code);
          }
        }

        if (data.userEmail) {
          setPairedEmail(data.userEmail);
        }

        // Instant Movie / TV Playback Sync
        if ('playingItem' in data) {
          console.log('[LiveDisplayScreen] Received playingItem:', data.playingItem?.title || 'null');
          setPlayingItem(data.playingItem || null);
        }

        if (data.currentItem) {
          setCurrentItem((prev) => (prev?.id === data.currentItem?.id ? prev : data.currentItem));
          setIsLoading(false);
        }

        if (typeof data.serverIndex === 'number') {
          setServerIndex((prev) => (prev === data.serverIndex ? prev : data.serverIndex!));
        }
        if (typeof data.season === 'number') {
          setSeason((prev) => (prev === data.season ? prev : data.season!));
        }
        if (typeof data.episode === 'number') {
          setEpisode((prev) => (prev === data.episode ? prev : data.episode!));
        }

        if (data.playerAction && typeof data.playerAction.timestamp === 'number') {
          setRemotePlayerAction((prev) =>
            prev?.timestamp === data.playerAction!.timestamp ? prev : data.playerAction
          );
        }

        // Process real-time player commands (play, pause, seek, stop, volume, next, prev, etc.)
        if (data.playerCommand && typeof data.playerCommand.timestamp === 'number') {
          if (data.playerCommand.timestamp !== lastCommandTimestampRef.current) {
            lastCommandTimestampRef.current = data.playerCommand.timestamp;
            console.log('[LiveDisplayScreen] Processing player command:', data.playerCommand.command);
            if (data.playerCommand.command === 'stop') {
              setPlayingItem(null);
            }
            setLatestCommand({ ...data.playerCommand });
            syncManager.broadcast({
              type: 'PLAYER_COMMAND',
              command: data.playerCommand.command as any,
              value: data.playerCommand.value,
              extra: data.playerCommand.extra,
              timestamp: data.playerCommand.timestamp,
            });
          }
        }

        if (data.activeCategory) {
          setActiveCategory((prev) => (prev === data.activeCategory ? prev : data.activeCategory!));
        }
        if (typeof data.searchQuery === 'string') {
          setSearchQuery((prev) => (prev === data.searchQuery ? prev : data.searchQuery!));
        }
      },
      (err) => {
        console.warn('[LiveDisplayScreen] Firebase sync warning:', err);
      }
    );

    return () => {
      unsubscribeFirebase();
    };
  }, [pairingCode]);

  // 3. Fallback Local BroadcastChannel sync (cross-tab on same browser)
  useEffect(() => {
    syncManager.broadcast({ type: 'REQUEST_STATE' });

    const unsubscribeBroadcast = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'DISCONNECT') {
        console.log('[LiveDisplayScreen] Local broadcast DISCONNECT received');
        setIsPaired(false);
        setPairingCode('');
        setPlayingItem(null);
        setPairedEmail('');
        try {
          localStorage.removeItem('cinematic_paired_code');
          window.history.replaceState({}, '', window.location.pathname + '?view=display');
        } catch (_) {}
      } else if (msg.type === 'STATE_UPDATE') {
        if (msg.state.currentItem) setCurrentItem(msg.state.currentItem);
        setPlayingItem(msg.state.playingItem);
        if (typeof msg.state.serverIndex === 'number') setServerIndex(msg.state.serverIndex);
        if (typeof msg.state.season === 'number') setSeason(msg.state.season);
        if (typeof msg.state.episode === 'number') setEpisode(msg.state.episode);
        setActiveCategory(msg.state.activeCategory);
        setSearchQuery(msg.state.searchQuery);
        setIsLoading(false);
      } else if (msg.type === 'SELECT_ITEM') {
        setCurrentItem(msg.item);
        if (msg.category) setActiveCategory(msg.category);
        setIsLoading(false);
      } else if (msg.type === 'PLAY') {
        setCurrentItem(msg.item);
        setPlayingItem(msg.item);
        if (typeof msg.serverIndex === 'number') setServerIndex(msg.serverIndex);
        if (typeof msg.season === 'number') setSeason(msg.season);
        if (typeof msg.episode === 'number') setEpisode(msg.episode);
        setIsLoading(false);
      } else if (msg.type === 'PLAYER_CONFIG') {
        setServerIndex(msg.serverIndex);
        setSeason(msg.season);
        setEpisode(msg.episode);
      } else if (msg.type === 'PLAYER_ACTION') {
        setRemotePlayerAction((prev) =>
          prev?.timestamp === msg.timestamp ? prev : { action: msg.action, timestamp: msg.timestamp }
        );
      } else if (msg.type === 'CLOSE_PLAYER') {
        setPlayingItem(null);
      } else if (msg.type === 'CATEGORY_CHANGE') {
        setActiveCategory(msg.category);
      } else if (msg.type === 'SEARCH') {
        setSearchQuery(msg.query);
      }
    });

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'cinema_display_sync_state' && e.newValue) {
        try {
          const state: DisplaySyncState = JSON.parse(e.newValue);
          if (state.currentItem) setCurrentItem(state.currentItem);
          setPlayingItem(state.playingItem);
          if (typeof state.serverIndex === 'number') setServerIndex(state.serverIndex);
          if (typeof state.season === 'number') setSeason(state.season);
          if (typeof state.episode === 'number') setEpisode(state.episode);
          setActiveCategory(state.activeCategory);
          setSearchQuery(state.searchQuery);
          setIsLoading(false);
        } catch (_) {}
      }
    };

    window.addEventListener('storage', handleStorage);

    return () => {
      unsubscribeBroadcast();
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  // 4. Initial fallback media if completely empty
  useEffect(() => {
    if (!currentItem) {
      let isMounted = true;
      setIsLoading(true);
      loadCategoryMedia(activeCategory, searchQuery, 1)
        .then((res) => {
          if (isMounted && res.items.length > 0) {
            setCurrentItem(res.items[0]);
          }
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, []);

  const handleDisconnect = async () => {
    soundFx.playClick('switch');
    if (pairingCode) {
      if (pairingCode === QUICK_CONNECT_CODE) {
        await closeQuickConnectDisplaySession();
        await initQuickConnectDisplaySession();
      } else {
        await disconnectRemoteSession(pairingCode);
      }
      syncManager.broadcast({ type: 'DISCONNECT', timestamp: Date.now() });
    }
    setIsPaired(false);
    setPairingCode('');
    setPairedEmail('');
    setPlayingItem(null);
    try {
      localStorage.removeItem('cinematic_paired_code');
      window.history.replaceState({}, '', window.location.pathname + '?view=display');
    } catch (_) {}
  };

  // Toggle fullscreen for TV / Monitor display
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error('Fullscreen error:', err);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch((err) => {
        console.error('Exit fullscreen error:', err);
      });
    }
  };

  const handleCopyQuickCode = () => {
    soundFx.playClick('switch');
    navigator.clipboard.writeText(QUICK_CONNECT_CODE);
    setCopiedQuickCode(true);
    setTimeout(() => setCopiedQuickCode(false), 2000);
  };

  // --- RENDERING: ACTIVATION / PAIRING SCREEN IF NOT PAIRED ---
  if (!isPaired) {
    return (
      <div 
        ref={containerRef}
        id="display-activation-screen"
        className="relative w-screen h-screen min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center p-3 sm:p-6 overflow-y-auto select-none font-sans"
      >
        {/* Ambient background glows */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-amber-500/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-orange-600/5 blur-[160px] rounded-full pointer-events-none" />

        <div className="relative z-10 w-full max-w-xl bg-zinc-950/95 border border-amber-500/30 rounded-3xl p-5 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl flex flex-col gap-5 my-auto">
          {/* Header */}
          <div className="flex flex-col items-center text-center gap-2">
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Tv2 className="w-8 h-8 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white font-mono mt-1">
              REMOTE DISPLAY (TV / PC)
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-md">
              Control this big screen in real-time from your mobile device using Cinema Remote.
            </p>

            {/* Same Network IP Status Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-amber-400">
                <Wifi className="w-3.5 h-3.5" />
                <span className="text-zinc-400 font-sans">Wi-Fi Network:</span>
                <span className="font-bold text-white">{displayNetworkIp}</span>
              </div>
              <span className="text-zinc-600">•</span>
              <div className="flex items-center gap-1 text-emerald-400 font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Ready for Phone</span>
              </div>
            </div>
          </div>

          {/* Primary Feature: DEFAULT SAME-NETWORK QUICK CONNECT */}
          <div className="flex flex-col gap-3.5 p-5 sm:p-6 rounded-2xl bg-black border-2 border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.2)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  TV Connection Code (Pair with Remote)
                </span>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                No Login Required
              </span>
            </div>

            {/* Permanent Code Display with Copy Button */}
            <div className="flex items-center justify-between gap-3 p-4 sm:p-5 rounded-xl bg-zinc-900/90 border border-amber-500/30 shadow-inner">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">
                  Connection Code for Remote:
                </span>
                <span className="text-3xl sm:text-4xl font-black tracking-widest text-amber-400 font-mono drop-shadow-[0_0_20px_rgba(245,158,11,0.6)] select-all">
                  {QUICK_CONNECT_CODE}
                </span>
              </div>

              <button
                id="copy-quick-connect-code-btn"
                type="button"
                onClick={handleCopyQuickCode}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-bold text-white transition-all cursor-pointer shadow-sm hover:scale-105 active:scale-95"
                title="Copy Quick Connect Code"
              >
                {copiedQuickCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Bengali & English Guidance */}
            <div className="text-xs text-zinc-300 space-y-2 leading-relaxed bg-zinc-950/70 p-3.5 rounded-xl border border-zinc-900">
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <span>
                  <strong>কানেক্ট করার নিয়ম:</strong> আপনার মোবাইল রিমোটের (Cinema Remote) Connect বক্সে কোড <code className="text-amber-400 font-bold font-mono px-1.5 py-0.5 bg-zinc-900 rounded border border-amber-500/30">{QUICK_CONNECT_CODE}</code> বসিয়ে <strong>Connect TV</strong> বাটনে চাপুন।
                </span>
              </div>
              <div className="flex items-start gap-2.5 pt-1.5 border-t border-zinc-900 text-zinc-400 text-[11px]">
                <ShieldAlert className="w-4 h-4 text-amber-500/90 mt-0.5 shrink-0" />
                <span>
                  <strong>ডিসপ্লে থেকে কোনো ইনপুট লাগবে না:</strong> ডিসপ্লে শুধুমাত্র রিসিভার হিসেবে কাজ করছে। রিমোট থেকে কানেক্ট করলেই সাথে সাথে এই স্ক্রিনে ভিডিও প্লে হবে।
                </span>
              </div>
            </div>

            {/* Pulsing Status Bar */}
            <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
              <span>Waiting for your mobile remote to connect with "{QUICK_CONNECT_CODE}"...</span>
            </div>
          </div>

          {/* Fullscreen Toggle & Tips */}
          <div className="flex items-center justify-between px-2 pt-1 text-xs text-zinc-500">
            <span className="text-[11px]">Screen ID: {QUICK_CONNECT_CODE}</span>
            <button
              id="display-screen-toggle-fullscreen"
              type="button"
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium cursor-pointer transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>{isFullscreen ? 'Exit Fullscreen' : 'TV Fullscreen Mode'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING: ACTIVE PAIRED CINEMATIC DISPLAY SCREEN ---
  return (
    <div
      ref={containerRef}
      id="live-display-screen"
      className="relative w-screen h-screen min-h-screen overflow-hidden bg-black text-white flex flex-col justify-between select-none font-sans"
    >
      {/* 1. FULL SCREEN CINEMATIC BACKDROP */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {currentItem ? (
          <div
            key={currentItem.id}
            className="absolute inset-0 bg-center bg-cover transition-all duration-1000 transform scale-105"
            style={{
              backgroundImage: `url(${currentItem.backdrop || currentItem.poster})`,
            }}
          >
            {/* Dark Vignettes for supreme readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/30" />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.85)_100%)]" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[#06070a]" />
        )}
      </div>

      {/* 2. TOP BAR - FULLSCREEN & PAIRING STATUS CONTROLS */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
        <div className="flex items-center gap-2">
          {pairingCode === QUICK_CONNECT_CODE ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Quick Connect: {QUICK_CONNECT_CODE}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900/80 border border-zinc-700 text-zinc-300 text-xs font-mono">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Paired: #{pairingCode}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Fullscreen Button */}
          <button
            id="display-fullscreen-btn"
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-md backdrop-blur-md opacity-80 hover:opacity-100"
            title="Toggle TV Fullscreen"
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">TV Fullscreen</span>
              </>
            )}
          </button>

          {/* Disconnect Button */}
          <button
            id="display-disconnect-btn"
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 text-red-300 text-xs font-semibold transition-all cursor-pointer shadow-md backdrop-blur-md opacity-80 hover:opacity-100"
            title="Disconnect Display"
          >
            <Unplug className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden sm:inline">Disconnect</span>
          </button>
        </div>
      </header>

      {/* 3. CENTER DISPLAY SHOWCASE (POSTER & METADATA - LIVE FROM FIREBASE CONTROLLER) */}
      <main className="relative z-10 flex-1 flex flex-col justify-end px-6 pb-10 sm:px-12 sm:pb-16 max-w-7xl mx-auto w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-3 border-amber-400 border-t-transparent shadow-[0_0_30px_rgba(245,158,11,0.5)]" />
            <p className="text-sm font-semibold text-zinc-300 tracking-wider">
              Waiting for Main Remote Controller...
            </p>
          </div>
        ) : currentItem ? (
          <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6 sm:gap-10 animate-fadeIn">
            {/* Movie Poster Card */}
            <div 
              className="group relative shrink-0 w-40 sm:w-56 lg:w-72 rounded-2xl sm:rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.95)] border-2 border-zinc-800/90 transition-all duration-300"
            >
              <img 
                src={currentItem.poster} 
                alt={currentItem.title} 
                className="w-full aspect-[2/3] object-cover"
              />

              {/* Poster Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
              
              {/* Rating badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/85 border border-amber-500/40 text-amber-400 font-bold text-xs backdrop-blur-md shadow-lg">
                <Star className="w-3.5 h-3.5 fill-amber-400" />
                <span>{currentItem.rating.toFixed(1)}</span>
              </div>

              {/* 4K UHD Tag */}
              <div className="absolute top-3 right-3 px-2.5 py-0.5 rounded-lg bg-amber-500 text-black font-black text-[10px] tracking-wider uppercase shadow-md">
                4K UHD
              </div>
            </div>

            {/* Movie Details & Overview */}
            <div className="flex-1 space-y-3 sm:space-y-4">
              {/* Metadata Badges: Year, Duration, Rating, Studio */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold text-zinc-300">
                <span className="px-3 py-1 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-zinc-200">
                  {currentItem.year}
                </span>

                <span className="px-3 py-1 rounded-xl bg-zinc-900/90 border border-zinc-700/60 text-zinc-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  {currentItem.durationOrEpisodes}
                </span>

                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
                  {currentItem.ageRating || 'HD'}
                </span>

                <span className="text-zinc-400 text-xs hidden sm:inline">
                  {currentItem.directorOrStudio}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white drop-shadow-2xl leading-tight">
                {currentItem.title}
              </h1>

              {/* Tagline */}
              {currentItem.tagline && (
                <p className="text-sm sm:text-base font-medium text-amber-400/90 italic drop-shadow">
                  "{currentItem.tagline}"
                </p>
              )}

              {/* Genre Pills */}
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {currentItem.genres.map((genre, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 rounded-xl bg-zinc-900/80 border border-zinc-800 text-zinc-300 text-xs font-medium"
                  >
                    {genre}
                  </span>
                ))}
              </div>

              {/* Synopsis */}
              <p className="text-zinc-300 text-xs sm:text-sm md:text-base max-w-3xl line-clamp-3 sm:line-clamp-4 leading-relaxed drop-shadow-md">
                {currentItem.synopsis}
              </p>
            </div>
          </div>
        ) : null}
      </main>

      {/* FULL SCREEN PLAYER ONLY: Pure video canvas, 100% full-screen, ZERO controls */}
      {playingItem && (
        <FullScreenRemotePlayer
          item={playingItem}
          serverIndex={serverIndex}
          season={season}
          episode={episode}
          pairingCode={pairingCode}
          latestCommand={latestCommand}
          onExit={() => {
            setPlayingItem(null);
            syncManager.saveState({ playingItem: null });
            syncManager.broadcast({ type: 'CLOSE_PLAYER' });
            if (pairingCode) {
              updateRemoteSession(pairingCode, { playingItem: null });
            }
          }}
        />
      )}
    </div>
  );
};
