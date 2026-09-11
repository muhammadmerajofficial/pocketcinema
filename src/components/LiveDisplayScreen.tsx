import React, { useState, useEffect, useRef } from 'react';
import { 
  Tv2, 
  Maximize, 
  Minimize, 
  Copy, 
  Check, 
  Sparkles, 
  ExternalLink,
  Unplug,
  Film,
  RefreshCw,
  QrCode,
  X
} from 'lucide-react';
import QRCode from 'qrcode';
import { MediaItem } from '../types';
import { MEDIA_COLLECTION } from '../data/mediaData';
import { FullScreenRemotePlayer } from './FullScreenRemotePlayer';
import { syncManager, SyncMessage } from '../utils/syncChannel';
import { 
  generate4DigitRoomCode, 
  initRoom, 
  listenToRoom, 
  closeRoom, 
  RoomData, 
  updateRoom 
} from '../services/remotePairing';
import { soundFx } from '../utils/sound';
import { 
  openFullscreen, 
  closeFullscreen, 
  isFullscreenActive, 
  registerTvDpadNavigation 
} from '../utils/tvNavigation';

export const LiveDisplayScreen: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isQROverlayOpen, setIsQROverlayOpen] = useState(true);

  // 1. Generate a fresh, new, unique 4-digit roomCode every time TV Screen opens
  const [roomCode] = useState<string>(() => {
    return generate4DigitRoomCode();
  });

  const [roomStatus, setRoomStatus] = useState<'waiting' | 'connected' | 'closed'>('waiting');
  const [connectionToast, setConnectionToast] = useState<string | null>(null);
  // Initially auto-play default movie or media from URL params with full sound
  const [playingItem, setPlayingItem] = useState<MediaItem | null>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const mediaId = urlParams.get('mediaId');
      const cat = (urlParams.get('category') as any) || 'movies';
      if (mediaId) {
        const found = MEDIA_COLLECTION.find((m) => String(m.id) === mediaId);
        if (found) return found;
        return {
          id: mediaId,
          title: 'Now Playing',
          year: new Date().getFullYear(),
          category: cat,
          poster: '',
          backdrop: '',
          rating: 8.8,
          overview: '',
        };
      }
    } catch (_) {}
    return MEDIA_COLLECTION[0] || null;
  });
  const [serverIndex, setServerIndex] = useState<number>(0);
  const [season, setSeason] = useState<number>(1);
  const [episode, setEpisode] = useState<number>(1);
  const [volume, setVolume] = useState<number>(100);
  const [latestCommand, setLatestCommand] = useState<{ command: string; value?: any; extra?: any; timestamp: number } | null>(null);
  const lastActionTimestampRef = useRef<number>(0);

  // Helper to generate the exact controller remote URL across all hosting environments
  const getRemoteUrl = () => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('view');
      u.searchParams.set('room', roomCode);
      u.hash = '';
      return u.toString();
    } catch {
      return `${window.location.origin}/?room=${roomCode}`;
    }
  };

  // 2. Generate high-resolution QR code pointing to remote page with ?room={roomCode}
  useEffect(() => {
    if (!roomCode) return;
    const remoteUrl = getRemoteUrl();
    QRCode.toDataURL(remoteUrl, {
      width: 500,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('[LiveDisplayScreen] QR code generation error:', err));
  }, [roomCode]);

  // 3. Initialize Firebase room node at rooms/{roomCode} on page load in waiting state
  useEffect(() => {
    const initialItem = playingItem || MEDIA_COLLECTION[0];
    initRoom(roomCode, {
      status: 'waiting',
      isPlaying: true,
      currentTime: 0,
      action: 'none',
      volume: 100,
      playingItem: initialItem,
      serverIndex: 0,
      season: 1,
      episode: 1,
      lastCommandTimestamp: Date.now(),
    });

    const handleBeforeUnload = () => {
      closeRoom(roomCode);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
      closeRoom(roomCode);
    };
  }, [roomCode]);

  // 4. Firebase Listener for rooms/{roomCode}
  useEffect(() => {
    const unsubscribe = listenToRoom(roomCode, (data: RoomData | null) => {
      if (!data) return;

      // When remote connects (QR code scanned or 4-digit room code entered in remote and activated)
      if (data.status === 'connected') {
        setRoomStatus('connected');
        
        // Hide big QR & Room ID from the screen ONLY when remote actually connects!
        setIsQROverlayOpen(false);

        // Feedback sound & connection banner
        soundFx.playClick('ok');
        setConnectionToast(`📱 Remote Connected to Room #${roomCode} • Playing Now!`);
        setTimeout(() => setConnectionToast(null), 3500);

        // Keep background movie playing seamlessly or update if new movie selected
        if (data.playingItem) {
          setPlayingItem((prev) => {
            if (!prev || prev.id !== data.playingItem?.id) {
              return data.playingItem || prev;
            }
            return prev;
          });
        }
        setVolume(100);
      } else if (data.status === 'waiting') {
        setRoomStatus('waiting');
        // STRICT: Stay open and never auto-hide until remote activates the room code
        setIsQROverlayOpen(true);
      }

      // Incoming movie/show to stream from remote (e.g. user selects a movie on remote)
      if ('playingItem' in data && data.playingItem) {
        setPlayingItem((prev) => {
          if (!prev || prev.id !== data.playingItem?.id) {
            return data.playingItem || prev;
          }
          return prev;
        });
        setVolume(100);
        // Only hide QR overlay if remote is officially connected
        if (data.status === 'connected') {
          setIsQROverlayOpen(false);
        }
      } else if (data.action === 'close') {
        setPlayingItem(null);
      }

      if (typeof data.serverIndex === 'number') {
        setServerIndex(data.serverIndex);
      }
      if (typeof data.season === 'number') {
        setSeason(data.season);
      }
      if (typeof data.episode === 'number') {
        setEpisode(data.episode);
      }
      if (typeof data.volume === 'number') {
        setVolume(data.volume);
      }

      // Actions: play, pause, close, rewind, forward, seek
      if (data.action && data.action !== 'none') {
        const ts = data.lastCommandTimestamp || Date.now();
        if (ts !== lastActionTimestampRef.current) {
          lastActionTimestampRef.current = ts;

          if (data.action === 'close') {
            setPlayingItem(null);
          } else if (data.action === 'play') {
            if (data.status === 'connected') {
              setIsQROverlayOpen(false);
            }
            setLatestCommand({ command: 'play', timestamp: ts });
          } else if (data.action === 'pause') {
            setLatestCommand({ command: 'pause', timestamp: ts });
          } else if (data.action === 'rewind') {
            setLatestCommand({ command: 'rewind', extra: -10, timestamp: ts });
          } else if (data.action === 'forward') {
            setLatestCommand({ command: 'forward', extra: 10, timestamp: ts });
          } else if (data.action === 'seek') {
            const seekVal = typeof data.currentTime === 'number' ? data.currentTime : 0;
            setLatestCommand({ command: 'seek', value: seekVal, timestamp: ts });
          }
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode]);

  // 5. Cross-tab BroadcastChannel listener (local fallback)
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'ROOM_UPDATE') {
        const updateMsg = msg as any;
        // Verify this update is for this roomCode and status is connected
        if (updateMsg.roomCode === roomCode && updateMsg.data?.status === 'connected') {
          setIsQROverlayOpen(false);
          setRoomStatus('connected');
          if (updateMsg.data?.playingItem) {
            setPlayingItem(updateMsg.data.playingItem);
          }
          setVolume(100);
          soundFx.playClick('ok');
          setConnectionToast(`📱 Remote Paired with Room #${roomCode} • Playing Now!`);
          setTimeout(() => setConnectionToast(null), 3500);
        }
      } else if (msg.type === 'PLAY') {
        const playMsg = msg as any;
        // Only accept PLAY to dismiss QR if targeted to this room or already connected
        if (playMsg.roomCode === roomCode || roomStatus === 'connected') {
          setIsQROverlayOpen(false);
          setRoomStatus('connected');
          setPlayingItem(msg.item);
          setVolume(100);
          soundFx.playClick('ok');
          setConnectionToast(`📱 Remote Connected • Auto-Playing "${msg.item.title}"!`);
          setTimeout(() => setConnectionToast(null), 3500);

          if (typeof msg.serverIndex === 'number') setServerIndex(msg.serverIndex);
          if (typeof msg.season === 'number') setSeason(msg.season);
          if (typeof msg.episode === 'number') setEpisode(msg.episode);
        }
      } else if (msg.type === 'CLOSE_PLAYER') {
        setPlayingItem(null);
      } else if (msg.type === 'PLAYER_COMMAND') {
        if (msg.command === 'stop') {
          setPlayingItem(null);
        } else {
          setLatestCommand({ command: msg.command, value: msg.value, extra: msg.extra, timestamp: msg.timestamp });
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [roomCode, roomStatus]);

  // Auto fullscreen when TV display is active
  useEffect(() => {
    const enterFs = () => {
      if (!isFullscreenActive()) {
        openFullscreen(containerRef.current || document.documentElement);
      }
    };
    enterFs();
    window.addEventListener('click', enterFs, { once: true });
    window.addEventListener('keydown', enterFs, { once: true });
    window.addEventListener('touchstart', enterFs, { once: true });
    return () => {
      window.removeEventListener('click', enterFs);
      window.removeEventListener('keydown', enterFs);
      window.removeEventListener('touchstart', enterFs);
    };
  }, [playingItem]);

  // Smart TV Remote D-Pad Navigation & Back key handling
  useEffect(() => {
    const unregister = registerTvDpadNavigation({
      onBack: () => {
        setIsQROverlayOpen((prev) => !prev);
      },
      onPlayPauseToggle: () => {
        setLatestCommand((prev) => ({
          command: prev?.command === 'play' ? 'pause' : 'play',
          timestamp: Date.now(),
        }));
      },
      onSeekForward: () => {
        setLatestCommand({ command: 'seek', extra: 10, timestamp: Date.now() });
      },
      onSeekBackward: () => {
        setLatestCommand({ command: 'seek', extra: -10, timestamp: Date.now() });
      },
    });
    return unregister;
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreenActive()) {
      openFullscreen(containerRef.current || document.documentElement);
      setIsFullscreen(true);
    } else {
      closeFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    soundFx.playClick('switch');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const isConnected = roomStatus === 'connected';
  const remotePageUrl = getRemoteUrl();
  const activeMediaItem = playingItem || MEDIA_COLLECTION[0];

  return (
    <div
      ref={containerRef}
      id="live-display-screen"
      className="fixed inset-0 w-screen h-screen min-h-screen overflow-hidden bg-black text-white m-0 p-0 z-50 select-none font-sans"
      style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}
    >
      {/* 1. Full-Screen Video Canvas Playing in Background with Sound */}
      <FullScreenRemotePlayer
        item={activeMediaItem}
        serverIndex={serverIndex}
        season={season}
        episode={episode}
        pairingCode={roomCode}
        latestCommand={latestCommand}
        onExit={() => {
          closeRoom(roomCode);
          setPlayingItem(null);
        }}
      />

      {/* 2. Connection Toast Notification */}
      {connectionToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10003] px-5 py-2.5 rounded-2xl bg-emerald-950/95 border border-emerald-500/70 text-emerald-200 text-xs sm:text-sm font-semibold flex items-center gap-2.5 shadow-2xl backdrop-blur-xl animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{connectionToast}</span>
        </div>
      )}

      {/* 3. ALWAYS-VISIBLE TOP-RIGHT ROOM ID POPUP BADGE */}
      {/* Persists even after code is active and remote is controlling the player */}
      <div 
        id="tv-top-right-room-badge"
        className="fixed top-4 right-4 z-[10002] flex items-center gap-2 pointer-events-auto select-none animate-fadeIn"
      >
        <div 
          className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-black/85 backdrop-blur-xl border border-amber-500/60 shadow-[0_4px_30px_rgba(0,0,0,0.85)] transition-all hover:bg-black/95 hover:border-amber-400"
        >
          {/* Status Indicator Pulse */}
          <div className="flex items-center gap-1.5">
            <span 
              className={`w-2.5 h-2.5 rounded-full ${
                isConnected 
                  ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse' 
                  : 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)] animate-ping'
              }`} 
            />
          </div>

          {/* Room ID Title and Value */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
              ROOM ID:
            </span>
            <span className="text-base sm:text-lg font-mono font-black tracking-widest text-amber-400">
              #{roomCode}
            </span>
          </div>

          {/* Active / Linked Badge */}
          {isConnected ? (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ACTIVE
            </span>
          ) : (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
              PAIRING
            </span>
          )}

          {/* Copy Button */}
          <button
            type="button"
            onClick={handleCopyCode}
            tabIndex={0}
            className="interactive-element p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer focus:outline-none"
            title="Copy Room ID"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          {/* Fullscreen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            tabIndex={0}
            className="interactive-element p-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer focus:outline-none"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter TV Fullscreen'}
          >
            {isFullscreen ? <Minimize className="w-3.5 h-3.5 text-zinc-400" /> : <Maximize className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          {/* Toggle QR Overlay Button */}
          {!isQROverlayOpen && (
            <button
              type="button"
              onClick={() => setIsQROverlayOpen(true)}
              tabIndex={0}
              className="interactive-element p-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 hover:text-amber-200 transition-colors cursor-pointer border border-amber-500/30 focus:outline-none"
              title="Show Full QR Code"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
        </div>
      </div>

      {/* 4. FULL-SCREEN QR CODE & ROOM ID PAIRING DISPLAY (Active until Remote pairs) */}
      {/* Covers 100% full screen with large QR and Room ID; hides automatically when Remote activates */}
      {isQROverlayOpen && (
        <div 
          id="tv-fullscreen-pairing-overlay"
          className="fixed inset-0 w-screen h-screen min-h-screen bg-black z-[10001] flex flex-col justify-between select-none overflow-y-auto font-sans"
          style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}
        >
          {/* Subtle Ambient Glow Behind QR */}
          <div className="absolute top-1/3 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Top Bar of Full-Screen Pairing View */}
          <header className="relative z-20 w-full px-6 sm:px-12 py-5 sm:py-7 flex items-center justify-between border-b border-zinc-900 bg-black/90 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <Tv2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-wider text-white flex items-center gap-2.5">
                  <span>TV SCREEN DISPLAY</span>
                  <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 font-bold">
                    Pairing Mode
                  </span>
                </h1>
                <p className="text-xs text-zinc-400 hidden sm:block">
                  Connect mobile remote to control stream, switch movies, and manage playback
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs font-mono text-zinc-300 shadow-inner">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <span className="text-amber-300 font-semibold">Waiting for Remote</span>
            </div>
          </header>

          {/* Center Stage: Immense Full-Screen QR Code & Room ID */}
          <main className="relative z-20 flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 sm:gap-12 lg:gap-20 px-6 sm:px-12 py-6 w-full max-w-7xl mx-auto my-auto">
            {/* Left Column: Big Size High-Resolution QR Code */}
            <div className="flex flex-col items-center shrink-0">
              <div className="w-72 h-72 sm:w-84 sm:h-84 md:w-96 md:h-96 lg:w-[400px] lg:h-[400px] xl:w-[440px] xl:h-[440px] p-4 sm:p-5 rounded-3xl bg-white shadow-[0_0_80px_rgba(245,158,11,0.2)] border-4 border-amber-500/60 flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`Room QR Code ${roomCode}`}
                    className="w-full h-full object-contain rounded-2xl block"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 text-zinc-600">
                    <RefreshCw className="w-10 h-10 animate-spin text-amber-500" />
                    <span className="text-xs font-bold text-zinc-400">Generating TV QR Code...</span>
                  </div>
                )}
              </div>
              <p className="mt-3.5 text-xs sm:text-sm text-zinc-400 text-center font-medium">
                📱 Scan QR code with your phone camera to pair instantly
              </p>
            </div>

            {/* Right Column: Prominent Room ID & Pairing Steps */}
            <div className="flex-1 flex flex-col items-start justify-center max-w-xl w-full text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold uppercase tracking-wider mb-3">
                <QrCode className="w-4 h-4 text-amber-400" />
                <span>Quick TV Pairing</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight mb-2">
                Connect Remote Controller
              </h2>
              <p className="text-zinc-400 text-xs sm:text-sm lg:text-base leading-relaxed mb-5">
                Scan the QR code on the left or type this 4-digit Room ID into your remote header and tap <strong className="text-amber-400 font-semibold">Active</strong>.
              </p>

              {/* Massive ROOM ID Card */}
              <div className="w-full p-4 sm:p-6 rounded-3xl bg-zinc-950 border-2 border-amber-500/70 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex items-center justify-between gap-4 mb-6">
                <div>
                  <span className="text-[11px] sm:text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest block mb-1">
                    ROOM ID
                  </span>
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-mono font-black tracking-widest text-amber-400">
                    #{roomCode}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  tabIndex={0}
                  className="interactive-element px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-md focus:outline-none"
                  title="Copy Room ID"
                >
                  {copiedCode ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-amber-400" />
                      <span>Copy ID</span>
                    </>
                  )}
                </button>
              </div>

              {/* 3 Step Instructions */}
              <div className="w-full space-y-2.5 text-xs sm:text-sm text-zinc-300 mb-5">
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">1</span>
                  <span>Open the remote on your phone or scan the QR code</span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">2</span>
                  <span>Enter Room ID <strong className="text-amber-400 font-mono">#{roomCode}</strong> and tap <strong className="text-amber-400">Active</strong></span>
                </div>
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">3</span>
                  <span>This pairing screen will automatically hide and stream full-screen!</span>
                </div>
              </div>

              {/* Background Audio / Now Playing Indicator */}
              <div className="flex items-center gap-2.5 text-xs text-zinc-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Now playing in background: <strong className="text-zinc-200">{activeMediaItem.title}</strong></span>
              </div>
            </div>
          </main>

          {/* Bottom Mask & Footer */}
          <footer className="relative z-20 w-full px-6 sm:px-12 py-4 bg-black border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>TV Room #{roomCode} • Realtime sync active</span>
            </div>

            <div className="flex items-center gap-4">
              <a
                href={remotePageUrl}
                target="_blank"
                rel="noreferrer"
                tabIndex={0}
                className="interactive-element inline-flex items-center gap-1.5 text-amber-400/90 hover:text-amber-300 hover:underline focus:outline-none"
              >
                <span>Open remote in new window</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className="text-zinc-700">•</span>
              <button
                type="button"
                onClick={() => setIsQROverlayOpen(false)}
                tabIndex={0}
                className="interactive-element text-zinc-400 hover:text-zinc-200 underline cursor-pointer focus:outline-none"
              >
                Watch directly without remote
              </button>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
};
