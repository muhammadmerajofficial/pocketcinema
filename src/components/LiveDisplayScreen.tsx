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
  QrCode
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

export const LiveDisplayScreen: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  // 1. Generate or read 4-digit roomCode
  const [roomCode] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = urlParams.get('room') || urlParams.get('code');
      if (fromUrl && fromUrl.trim().length === 4) {
        return fromUrl.trim();
      }
      return generate4DigitRoomCode();
    } catch {
      return generate4DigitRoomCode();
    }
  });

  const [roomStatus, setRoomStatus] = useState<'waiting' | 'connected' | 'closed'>('waiting');
  const [playingItem, setPlayingItem] = useState<MediaItem | null>(null);
  const [serverIndex, setServerIndex] = useState<number>(0);
  const [season, setSeason] = useState<number>(1);
  const [episode, setEpisode] = useState<number>(1);
  const [volume, setVolume] = useState<number>(100);
  const [latestCommand, setLatestCommand] = useState<{ command: string; value?: any; extra?: any; timestamp: number } | null>(null);
  const lastActionTimestampRef = useRef<number>(0);

  // 2. Generate QR code pointing to remote page with ?room={roomCode}
  useEffect(() => {
    if (!roomCode) return;
    const remoteUrl = `${window.location.origin}/?room=${roomCode}`;
    QRCode.toDataURL(remoteUrl, {
      width: 320,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('[LiveDisplayScreen] QR code generation error:', err));
  }, [roomCode]);

  // 3. Initialize Firebase room node at rooms/{roomCode} on page load
  useEffect(() => {
    initRoom(roomCode, {
      status: 'waiting',
      isPlaying: false,
      currentTime: 0,
      action: 'none',
      volume: 1,
    });

    const handleBeforeUnload = () => {
      closeRoom(roomCode);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleBeforeUnload);
    };
  }, [roomCode]);

  // 4. Firebase Listener for rooms/{roomCode}
  useEffect(() => {
    const unsubscribe = listenToRoom(roomCode, (data: RoomData | null) => {
      if (!data) return;

      // Status changes: when 'connected', auto play default movie if none is playing
      if (data.status) {
        setRoomStatus(data.status);
        if (data.status === 'connected' && !data.playingItem && data.action !== 'close') {
          setPlayingItem(MEDIA_COLLECTION[0]);
          setVolume(100);
        }
      }

      // Incoming movie/show to stream
      if ('playingItem' in data) {
        if (data.playingItem) {
          setPlayingItem((prev) => (prev?.id === data.playingItem?.id ? prev : data.playingItem));
          setVolume(100);
        } else if (data.status === 'connected' && data.action !== 'close') {
          setPlayingItem((prev) => prev || MEDIA_COLLECTION[0]);
          setVolume(100);
        } else {
          setPlayingItem(null);
        }
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
      if (msg.type === 'PLAY') {
        setPlayingItem(msg.item);
        if (typeof msg.serverIndex === 'number') setServerIndex(msg.serverIndex);
        if (typeof msg.season === 'number') setSeason(msg.season);
        if (typeof msg.episode === 'number') setEpisode(msg.episode);
        setRoomStatus('connected');
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
  }, []);

  // Auto fullscreen when player is active
  useEffect(() => {
    if (playingItem) {
      const enterFs = () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      };
      enterFs();
      window.addEventListener('click', enterFs, { once: true });
      window.addEventListener('keydown', enterFs, { once: true });
      return () => {
        window.removeEventListener('click', enterFs);
        window.removeEventListener('keydown', enterFs);
      };
    }
  }, [playingItem]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
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

  // Remote URL link for sharing or opening in new tab
  const remotePageUrl = `${window.location.origin}/?room=${roomCode}`;

  // When a movie is playing (e.g. automatically upon remote connection):
  // Render ONLY the full-screen player - NO text above or below, NO headers, NO footers, NO extra buttons
  if (playingItem) {
    return (
      <div
        ref={containerRef}
        id="live-display-screen-player-active"
        className="fixed inset-0 w-screen h-screen min-h-screen overflow-hidden bg-black text-white m-0 p-0 z-50 select-none"
        style={{ width: '100vw', height: '100vh', margin: 0, padding: 0 }}
      >
        <FullScreenRemotePlayer
          item={playingItem}
          serverIndex={serverIndex}
          season={season}
          episode={episode}
          pairingCode={roomCode}
          latestCommand={latestCommand}
          onExit={() => {
            setPlayingItem(null);
            updateRoom(roomCode, { playingItem: null, action: 'close', isPlaying: false });
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="live-display-screen"
      className="relative w-screen h-screen min-h-screen overflow-hidden bg-black text-white flex flex-col justify-between select-none font-sans"
    >
      {/* 1. CINEMATIC AMBIENT BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden w-full h-full">
        <div className="w-full h-full relative flex items-center justify-center bg-gradient-to-br from-[#0c0d12] via-[#08080c] to-black">
          {/* Ambient Lighting */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        </div>
      </div>

      {/* 2. TOP BAR - FULLSCREEN & ROOM CODE BADGE */}
      <header className="relative z-30 flex items-center justify-between px-4 py-3 sm:px-8 sm:py-4 bg-gradient-to-b from-black/90 via-black/40 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Tv2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold tracking-wider text-zinc-100 flex items-center gap-2">
              <span>TV Screen</span>
              {isConnected ? (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Remote Connected
                </span>
              ) : (
                <span className="text-[11px] font-mono text-amber-400/90 font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
                  Waiting for Remote
                </span>
              )}
            </h1>
            <p className="text-[11px] text-zinc-400 font-mono">
              Room Code: <strong className="text-white">#{roomCode}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* TV Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-md"
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
        </div>
      </header>

      {/* 3. CENTER OVERLAY: PROMINENT QR CODE & 4-DIGIT ROOM CODE */}
      {/* When status changes to 'connected', this overlay is hidden! */}
      {!isConnected && (
        <div className="relative z-30 flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-zinc-950/90 border border-zinc-800/90 p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center animate-fadeIn">
            {/* Top Icon Badge */}
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 mb-4">
              <QrCode className="w-7 h-7" />
            </div>

            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight mb-1">
              Connect Your Remote Control
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm mb-6">
              Scan QR code & connect your remote
            </p>

            {/* Prominent QR Code container */}
            <div className="relative mx-auto w-64 h-64 sm:w-72 sm:h-72 p-4 rounded-2xl bg-white flex items-center justify-center shadow-xl border border-zinc-200">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt={`Room QR Code ${roomCode}`}
                  className="w-full h-full object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-600">
                  <RefreshCw className="w-6 h-6 animate-spin text-zinc-500" />
                  <span className="text-xs font-medium">Generating QR...</span>
                </div>
              )}
            </div>

            {/* Numeric 4-digit Room Code display */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="px-5 py-2.5 rounded-2xl bg-zinc-900 border border-zinc-700/80 flex items-center gap-2.5 shadow-inner">
                <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">Room Code:</span>
                <span className="text-xl sm:text-2xl font-mono font-black tracking-widest text-amber-400">
                  {roomCode}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="p-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Copy Room Code"
              >
                {copiedCode ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-zinc-400" />
                )}
              </button>
            </div>

            {/* Direct Open in New Tab Button (for desktop or phone browser testing) */}
            <div className="mt-5">
              <a
                href={remotePageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-400/90 hover:text-amber-300 font-medium hover:underline transition-colors"
              >
                <span>Or open Remote page in new window</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* 4. WHEN CONNECTED BUT NO MOVIE SELECTED YET: STANDBY HERO */}
      {isConnected && !playingItem && (
        <div className="relative z-20 flex-1 flex flex-col items-center justify-center p-6 text-center animate-fadeIn">
          <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-4 animate-bounce">
            <Film className="w-8 h-8" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide mb-2">
            TV Screen Ready • Room #{roomCode}
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">
            Your phone remote is connected! Browse the movie collection, TV shows, or anime chronology on your mobile device and tap any poster to play.
          </p>
        </div>
      )}

      {/* 5. BOTTOM STATUS BAR */}
      <footer className="relative z-30 flex items-center justify-between px-4 py-2.5 sm:px-8 sm:py-3 bg-gradient-to-t from-black/90 via-black/40 to-transparent text-[11px] text-zinc-400">
        <div className="flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Realtime Sync Active</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono">Volume: {volume}%</span>
          {isConnected && (
            <button
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                closeRoom(roomCode);
                setRoomStatus('waiting');
                setPlayingItem(null);
              }}
              className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
            >
              <Unplug className="w-3 h-3" />
              <span>Reset TV</span>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
};
