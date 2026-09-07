import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Volume2, 
  VolumeX, 
  Volume1, 
  Server, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Maximize, 
  Square, 
  Tv2, 
  ExternalLink,
  Film,
  Sparkles,
  Layers,
  Unplug
} from 'lucide-react';
import { MediaItem } from '../types';
import { ALL_PLAYER_SERVERS } from '../utils/servers';
import { updateRemoteSession, RemoteSessionData } from '../services/remotePairing';
import { syncManager, SyncMessage } from '../utils/syncChannel';
import { soundFx } from '../utils/sound';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { fetchTvShowMetadata, TvShowMetadata } from '../services/tvShowData';

interface MainPageControlBarProps {
  playingMedia: MediaItem;
  pairingCode: string;
  userEmail?: string;
  serverIndex: number;
  season: number;
  episode: number;
  onServerChange: (idx: number) => void;
  onSeasonChange: (s: number) => void;
  onEpisodeChange: (e: number) => void;
  onStop: () => void;
  onDisconnectRemote?: () => void;
}

export const MainPageControlBar: React.FC<MainPageControlBarProps> = ({
  playingMedia,
  pairingCode,
  userEmail,
  serverIndex,
  season,
  episode,
  onServerChange,
  onSeasonChange,
  onEpisodeChange,
  onStop,
  onDisconnectRemote,
}) => {
  // Playback state synchronized with remote screen
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showServerMenu, setShowServerMenu] = useState<boolean>(false);
  const [tvMeta, setTvMeta] = useState<TvShowMetadata | null>(null);
  const [inputSeason, setInputSeason] = useState<number | string>(season);
  const [inputEpisode, setInputEpisode] = useState<number | string>(episode);
  const isDraggingScrubberRef = useRef<boolean>(false);

  const isSeries = playingMedia.category === 'tv' || playingMedia.category === 'anime';

  // Sync inputs when active season/episode props change
  useEffect(() => {
    setInputSeason(season);
  }, [season]);

  useEffect(() => {
    setInputEpisode(episode);
  }, [episode]);

  // Fetch TV Show metadata for exact seasons and episode counts
  useEffect(() => {
    if (!isSeries) return;
    let isMounted = true;
    fetchTvShowMetadata(playingMedia)
      .then((meta) => {
        if (isMounted && meta) {
          setTvMeta(meta);
        }
      })
      .catch((err) => console.warn('[MainPageControlBar] Meta load warning:', err));
    return () => {
      isMounted = false;
    };
  }, [playingMedia.id, isSeries]);

  // Derived season and episode counts
  const totalSeasons = Math.max(1, tvMeta?.totalSeasons || 1);
  const currentSeasonData = tvMeta?.seasons?.find((s) => s.seasonNumber === season);
  const currentSeasonEpisodes = currentSeasonData ? currentSeasonData.episodeCount : 12;

  // Max episodes for whatever season is currently typed in inputSeason
  const parsedInputSeason = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10) || season;
  const targetSeasonData = tvMeta?.seasons?.find((s) => s.seasonNumber === parsedInputSeason);
  const targetSeasonEpisodes = targetSeasonData ? targetSeasonData.episodeCount : currentSeasonEpisodes;

  // Auto-clamp episode if it exceeds current season's max episode
  useEffect(() => {
    if (isSeries && currentSeasonEpisodes > 0 && episode > currentSeasonEpisodes) {
      onEpisodeChange(1);
    }
  }, [season, currentSeasonEpisodes, episode, isSeries, onEpisodeChange]);

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('#main-page-master-control-deck')) {
        setShowServerMenu(false);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (sec: number) => {
    if (!sec || isNaN(sec) || sec < 0) return '00:00';
    const total = Math.floor(sec);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Dispatch player command to Firebase & BroadcastChannel
  const dispatchCommand = (
    command: 'play' | 'pause' | 'seek' | 'volume' | 'mute' | 'unmute' | 'fullscreen' | 'stop',
    value?: any,
    extra?: any
  ) => {
    const timestamp = Date.now();
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command,
      value,
      extra,
      timestamp,
    });
    if (pairingCode) {
      updateRemoteSession(pairingCode, {
        playerCommand: {
          command,
          value,
          extra,
          timestamp,
        },
      });
    }
  };

  // 1. Listen for real-time status updates from BroadcastChannel (same browser)
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'PLAYER_STATUS') {
        if (!isDraggingScrubberRef.current && typeof msg.currentTime === 'number') {
          setCurrentTime(msg.currentTime);
        }
        if (typeof msg.duration === 'number' && msg.duration > 0) {
          setDuration(msg.duration);
        }
        if (typeof msg.isPlaying === 'boolean') {
          setIsPlaying(msg.isPlaying);
        }
        if (typeof msg.volume === 'number') {
          setVolume(msg.volume);
        }
        if (typeof msg.isMuted === 'boolean') {
          setIsMuted(msg.isMuted);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Listen to Firestore for remote player status (cross-device TV/Monitor sync)
  useEffect(() => {
    if (!pairingCode) return;
    const sessionDocRef = doc(db, 'remote_sessions', pairingCode);
    const unsubscribe = onSnapshot(
      sessionDocRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as RemoteSessionData;
        if (data?.playerStatus) {
          const ps = data.playerStatus;
          if (!isDraggingScrubberRef.current && typeof ps.currentTime === 'number') {
            setCurrentTime(ps.currentTime);
          }
          if (typeof ps.duration === 'number' && ps.duration > 0) {
            setDuration(ps.duration);
          }
          if (typeof ps.isPlaying === 'boolean') {
            setIsPlaying(ps.isPlaying);
          }
          if (typeof ps.volume === 'number') {
            setVolume(ps.volume);
          }
          if (typeof ps.isMuted === 'boolean') {
            setIsMuted(ps.isMuted);
          }
        }
      },
      (err) => {
        console.warn('[MainPageControlBar] Firestore sync warning:', err);
      }
    );
    return () => unsubscribe();
  }, [pairingCode]);

  // 3. Smooth timer ticker: when isPlaying is true and not dragging, advance time locally by 1s
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (!isDraggingScrubberRef.current) {
        setCurrentTime((prev) => {
          if (duration > 0 && prev >= duration) return prev;
          return prev + 1;
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Controls Handlers
  const handleTogglePlay = () => {
    soundFx.playClick('ok');
    const nextPlay = !isPlaying;
    setIsPlaying(nextPlay);
    dispatchCommand(nextPlay ? 'play' : 'pause');
  };

  // Rewind or Forward 10 seconds in real-time
  const handleSeekDelta = (deltaSeconds: number) => {
    soundFx.playClick('nav');
    const target = Math.max(0, currentTime + deltaSeconds);
    setCurrentTime(target);
    dispatchCommand('seek', target, deltaSeconds);
  };

  // Stop playback on remote display in real-time
  const handleStopPlayback = () => {
    soundFx.playClick('switch');
    // 1. Broadcast locally
    syncManager.broadcast({ type: 'CLOSE_PLAYER' });
    dispatchCommand('stop');
    // 2. Clear playingItem in Firebase so Remote Display immediately exits full screen
    if (pairingCode) {
      updateRemoteSession(pairingCode, {
        playingItem: null,
        playerCommand: { command: 'stop', timestamp: Date.now() },
      });
    }
    // 3. Close local control bar
    onStop();
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
  };

  const handleScrubberCommit = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    isDraggingScrubberRef.current = false;
    const target = Number((e.target as HTMLInputElement).value);
    dispatchCommand('seek', target);
  };

  const handleToggleMute = () => {
    soundFx.playClick('switch');
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    dispatchCommand(nextMute ? 'mute' : 'unmute');
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      dispatchCommand('mute');
    } else {
      setIsMuted(false);
      dispatchCommand('volume', val);
    }
  };

  const handleVolumeDelta = (delta: number) => {
    soundFx.playClick('switch');
    const nextVal = Math.min(100, Math.max(0, (isMuted ? 0 : volume) + delta));
    setVolume(nextVal);
    if (nextVal === 0) {
      setIsMuted(true);
      dispatchCommand('mute');
    } else {
      setIsMuted(false);
      dispatchCommand('volume', nextVal);
    }
  };

  const handleSeasonInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val === '') {
      setInputSeason('');
    } else {
      const num = parseInt(val, 10);
      setInputSeason(num);
    }
  };

  const handleEpisodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val === '') {
      setInputEpisode('');
    } else {
      const num = parseInt(val, 10);
      setInputEpisode(num);
    }
  };

  const handleIncrementSeason = () => {
    let currentVal = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10) || 1;
    if (currentVal < totalSeasons) {
      const nextVal = currentVal + 1;
      setInputSeason(nextVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handleDecrementSeason = () => {
    let currentVal = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10) || 1;
    if (currentVal > 1) {
      const prevVal = currentVal - 1;
      setInputSeason(prevVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handleIncrementEpisode = () => {
    let currentVal = typeof inputEpisode === 'number' ? inputEpisode : parseInt(String(inputEpisode), 10) || 1;
    if (currentVal < targetSeasonEpisodes) {
      const nextVal = currentVal + 1;
      setInputEpisode(nextVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handleDecrementEpisode = () => {
    let currentVal = typeof inputEpisode === 'number' ? inputEpisode : parseInt(String(inputEpisode), 10) || 1;
    if (currentVal > 1) {
      const prevVal = currentVal - 1;
      setInputEpisode(prevVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handlePlayCustomSeasonEpisode = () => {
    let targetS = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10);
    if (isNaN(targetS) || targetS < 1) targetS = 1;
    if (targetS > totalSeasons) targetS = totalSeasons;

    const sData = tvMeta?.seasons?.find((s) => s.seasonNumber === targetS);
    const maxEps = sData ? sData.episodeCount : 12;

    let targetE = typeof inputEpisode === 'number' ? inputEpisode : parseInt(String(inputEpisode), 10);
    if (isNaN(targetE) || targetE < 1) targetE = 1;
    if (targetE > maxEps) targetE = maxEps;

    setInputSeason(targetS);
    setInputEpisode(targetE);
    onSeasonChange(targetS);
    onEpisodeChange(targetE);

    soundFx.playClick('ok');
    dispatchCommand('seek', 0);

    if (pairingCode) {
      updateRemoteSession(pairingCode, {
        season: targetS,
        episode: targetE,
      });
    }
  };

  const handleSeasonEpisodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlayCustomSeasonEpisode();
    }
  };

  const handleTriggerFullscreen = () => {
    soundFx.playClick('switch');
    dispatchCommand('fullscreen');
  };

  const currentServer = ALL_PLAYER_SERVERS[serverIndex] || ALL_PLAYER_SERVERS[0];

  return (
    <div 
      id="main-page-master-control-deck"
      className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-amber-500/30 backdrop-blur-2xl shadow-[0_-10px_40px_rgba(0,0,0,0.85)] px-3 py-2.5 sm:px-6 sm:py-3.5 flex flex-col gap-2 animate-in slide-in-from-bottom duration-300 select-none font-sans"
    >
      {/* 1. TOP STATUS ROW: Media Title, Remote Screen Connection Badge, TV Launcher */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-900/80 pb-2">
        {/* Media Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-12 rounded-lg bg-zinc-900 overflow-hidden shrink-0 border border-zinc-800 shadow-md">
            {playingMedia.poster ? (
              <img 
                src={playingMedia.poster} 
                alt={playingMedia.title} 
                className="w-full h-full object-cover" 
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-700">
                <Film className="w-4 h-4" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-md">
                {playingMedia.title}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] font-mono font-bold uppercase shrink-0">
                {isSeries 
                  ? `Season ${season} of ${totalSeasons} • Ep ${episode} of ${currentSeasonEpisodes}` 
                  : 'Movie'}
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span>Streaming on Remote Page ({currentServer.name})</span>
            </span>
          </div>
        </div>

        {/* Remote Pairing Info & Direct Screen Launcher */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="?view=display"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            title="Open Remote Screen in a new tab or on your TV"
          >
            <Tv2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Remote Screen</span>
            <ExternalLink className="w-3 h-3 text-amber-400" />
          </a>

          {onDisconnectRemote && (
            <button
              onClick={onDisconnectRemote}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
              title="Disconnect Remote Screen from Firebase"
            >
              <Unplug className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden lg:inline">Disconnect Display</span>
            </button>
          )}

          <button
            onClick={handleStopPlayback}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-400 text-xs font-bold transition-all cursor-pointer"
            title="Stop playback on remote display"
          >
            <Square className="w-3.5 h-3.5 fill-red-400" />
            <span className="hidden md:inline">Stop</span>
          </button>
        </div>
      </div>

      {/* 2. TIMELINE PROGRESS SCRUBBER */}
      <div className="flex items-center gap-3 w-full">
        <span className="text-xs font-mono font-semibold text-zinc-400 min-w-[45px] text-right">
          {formatTime(currentTime)}
        </span>
        <div className="relative flex-1 flex items-center">
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={1}
            value={currentTime}
            onMouseDown={() => { isDraggingScrubberRef.current = true; }}
            onTouchStart={() => { isDraggingScrubberRef.current = true; }}
            onChange={handleScrubberChange}
            onMouseUp={handleScrubberCommit}
            onTouchEnd={handleScrubberCommit}
            className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500 hover:h-2 transition-all"
          />
        </div>
        <span className="text-xs font-mono font-semibold text-zinc-500 min-w-[45px]">
          {duration > 0 ? formatTime(duration) : '--:--'}
        </span>
      </div>

      {/* 3. MAIN CONTROLS ROW: Play, Seek, Episodes, Server, Volume */}
      <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
        {/* Left: TV Series Season & Episode Navigation */}
        <div className="flex items-center gap-1.5 order-2 sm:order-1 flex-wrap">
          {isSeries && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Season Stepper Box */}
              <div 
                className="flex items-center bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-xl px-1.5 py-1 gap-1 shadow-sm transition-all"
                title={`Season Selector (Total: ${totalSeasons} Seasons)`}
              >
                <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-tight pl-0.5">
                  S
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputSeason}
                  onChange={handleSeasonInputChange}
                  onKeyDown={handleSeasonEpisodeKeyDown}
                  className="w-8 h-7 bg-black/70 border border-zinc-700/80 focus:border-amber-500 rounded-lg text-center text-xs font-mono font-bold text-amber-300 outline-none transition-colors"
                  title="Season Number (Type or use arrows, click Play to load)"
                  placeholder="1"
                />
                <div className="flex flex-col -space-y-0.5">
                  <button
                    type="button"
                    onClick={handleIncrementSeason}
                    disabled={Number(inputSeason) >= totalSeasons}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Season (Up Arrow)"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDecrementSeason}
                    disabled={Number(inputSeason) <= 1}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Season (Down Arrow)"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-[10px] font-mono font-medium text-zinc-500 pr-0.5 select-none">
                  /{totalSeasons}
                </span>
              </div>

              {/* Episode Stepper Box */}
              <div 
                className="flex items-center bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-xl px-1.5 py-1 gap-1 shadow-sm transition-all"
                title={`Episode Selector (Total: ${targetSeasonEpisodes} Episodes in this season)`}
              >
                <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-tight pl-0.5">
                  Ep
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={inputEpisode}
                  onChange={handleEpisodeInputChange}
                  onKeyDown={handleSeasonEpisodeKeyDown}
                  className="w-9 h-7 bg-black/70 border border-zinc-700/80 focus:border-amber-500 rounded-lg text-center text-xs font-mono font-bold text-amber-400 outline-none transition-colors"
                  title={`Episode Number (1 to ${targetSeasonEpisodes})`}
                  placeholder="1"
                />
                <div className="flex flex-col -space-y-0.5">
                  <button
                    type="button"
                    onClick={handleIncrementEpisode}
                    disabled={Number(inputEpisode) >= targetSeasonEpisodes}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Episode (Up Arrow)"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDecrementEpisode}
                    disabled={Number(inputEpisode) <= 1}
                    className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Episode (Down Arrow)"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-[10px] font-mono font-medium text-zinc-500 pr-0.5 select-none">
                  /{targetSeasonEpisodes}
                </span>
              </div>

              {/* Dedicated Play Episode Button */}
              <button
                type="button"
                onClick={handlePlayCustomSeasonEpisode}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-mono font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                title={`Play Season ${inputSeason} Episode ${inputEpisode} immediately`}
              >
                <Play className="w-3.5 h-3.5 fill-black" />
                <span>Play</span>
              </button>
            </div>
          )}

          {/* Server Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowServerMenu(!showServerMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-medium transition-all cursor-pointer"
            >
              <Server className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">{currentServer.name.split(' ')[0]}</span>
            </button>

            {showServerMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-2 py-1">
                  Select Remote Stream Server
                </span>
                {ALL_PLAYER_SERVERS.map((srv, idx) => (
                  <button
                    key={srv.id}
                    onClick={() => {
                      onServerChange(idx);
                      setShowServerMenu(false);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-left transition-all ${
                      serverIndex === idx 
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40' 
                        : 'hover:bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    <span>{srv.name}</span>
                    {idx === 0 && (
                      <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-bold">
                        Primary
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center: Play / Pause, Seek -10s, Seek +10s */}
        <div className="flex items-center gap-3 order-1 sm:order-2 mx-auto">
          <button
            onClick={() => handleSeekDelta(-10)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95"
            title="Rewind 10 seconds"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleTogglePlay}
            className="p-3 sm:p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-black shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all active:scale-90"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 fill-black" />
            ) : (
              <Play className="w-6 h-6 fill-black ml-0.5" />
            )}
          </button>

          <button
            onClick={() => handleSeekDelta(10)}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all active:scale-95"
            title="Forward 10 seconds"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Right: Volume Bar & Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2 order-3">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900/90 border border-zinc-800 rounded-xl px-2 sm:px-2.5 py-1.5 shadow-inner">
            <button 
              onClick={handleToggleMute} 
              className="text-zinc-400 hover:text-amber-400 transition-colors p-0.5 cursor-pointer"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : volume < 50 ? (
                <Volume1 className="w-4 h-4 text-amber-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleVolumeDelta(-10)}
              className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              title="Decrease Volume (-10%)"
            >
              -
            </button>

            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-14 sm:w-20 md:w-24 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              title={`Volume: ${isMuted ? '0%' : `${volume}%`}`}
            />

            <button
              type="button"
              onClick={() => handleVolumeDelta(10)}
              className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
              title="Increase Volume (+10%)"
            >
              +
            </button>

            <span className="text-[10px] font-mono font-bold text-zinc-400 min-w-[28px] text-right">
              {isMuted ? '0%' : `${volume}%`}
            </span>
          </div>

          <button
            onClick={handleTriggerFullscreen}
            className="p-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white transition-all cursor-pointer"
            title="Toggle Fullscreen on Remote TV"
          >
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
