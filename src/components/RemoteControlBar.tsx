import React, { useState, useEffect } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2,
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Maximize2,
  Tv2,
  Sliders,
  Compass,
  ArrowRight
} from 'lucide-react';
import { soundFx } from '../utils/sound';
import { syncManager, SyncMessage } from '../utils/syncChannel';

interface RemoteControlBarProps {
  onPress: (action: 'up' | 'down' | 'prev' | 'next' | 'ok' | 'close') => void;
  activeAction: string | null;
  activeItemTitle?: string;
  totalItems: number;
  currentIndex: number;
  isPlaying?: boolean;
  isLocked?: boolean;
}

// Format seconds to mm:ss or hh:mm:ss
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export const RemoteControlBar: React.FC<RemoteControlBarProps> = ({
  onPress,
  activeAction,
  activeItemTitle,
  totalItems,
  currentIndex,
  isPlaying = false,
  isLocked = false,
}) => {
  // Remote player live state synced with the EmbedMaster player
  const [playerStatus, setPlayerStatus] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    isMuted: boolean;
    activeSeason?: number;
    activeEpisode?: number;
  }>({
    isPlaying: true,
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
  });

  // Switch between "Player Control Deck" and "Navigation D-Pad"
  const [remoteMode, setRemoteMode] = useState<'player' | 'nav'>('player');

  useEffect(() => {
    if (isPlaying) {
      setRemoteMode('player');
    } else {
      setRemoteMode('nav');
    }
  }, [isPlaying]);

  // Listen to live player status broadcast from the player screen
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'PLAYER_STATUS') {
        setPlayerStatus({
          isPlaying: msg.isPlaying,
          currentTime: msg.currentTime,
          duration: msg.duration,
          volume: msg.volume,
          isMuted: msg.isMuted,
          activeSeason: msg.activeSeason,
          activeEpisode: msg.activeEpisode,
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const sendPlayerCommand = (command: 'play' | 'pause' | 'seek' | 'mute' | 'unmute' | 'volume' | 'fullscreen' | 'prev_ep' | 'next_ep', value?: any) => {
    if (isLocked) return;
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command,
      value,
      timestamp: Date.now(),
    });
  };

  const handleNavClick = (action: 'up' | 'down' | 'prev' | 'next' | 'ok' | 'close') => {
    if (isLocked) return;
    if (action === 'ok') {
      soundFx.playClick('ok');
    } else if (action === 'close') {
      soundFx.playClick('switch');
    } else {
      soundFx.playClick('nav');
    }
    onPress(action);
  };

  // Remote Play/Pause toggle
  const handleRemoteTogglePlay = () => {
    soundFx.playClick('ok');
    if (playerStatus.isPlaying) {
      sendPlayerCommand('pause');
      setPlayerStatus((prev) => ({ ...prev, isPlaying: false }));
    } else {
      sendPlayerCommand('play');
      setPlayerStatus((prev) => ({ ...prev, isPlaying: true }));
    }
    onPress('ok');
  };

  // Remote Seek
  const handleRemoteSeekDelta = (delta: number) => {
    soundFx.playClick('nav');
    const target = Math.max(0, playerStatus.currentTime + delta);
    setPlayerStatus((prev) => ({ ...prev, currentTime: target }));
    sendPlayerCommand('seek', target);
    onPress(delta < 0 ? 'prev' : 'next');
  };

  // Remote Scrub
  const handleRemoteScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setPlayerStatus((prev) => ({ ...prev, currentTime: val }));
    sendPlayerCommand('seek', val);
  };

  // Remote Mute
  const handleRemoteMute = () => {
    soundFx.playClick('switch');
    if (playerStatus.isMuted) {
      sendPlayerCommand('unmute');
      setPlayerStatus((prev) => ({ ...prev, isMuted: false }));
    } else {
      sendPlayerCommand('mute');
      setPlayerStatus((prev) => ({ ...prev, isMuted: true }));
    }
  };

  // Remote Volume Slider
  const handleRemoteVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setPlayerStatus((prev) => ({ ...prev, volume: val, isMuted: val === 0 }));
    sendPlayerCommand('volume', val);
  };

  return (
    <div id="remote-control-bar" className="w-full flex flex-col gap-2">
      {/* Remote Mode Tabs (Player Controls vs Navigation D-Pad) */}
      {isPlaying && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setRemoteMode('player')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                remoteMode === 'player'
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Player Deck</span>
            </button>
            <button
              type="button"
              onClick={() => setRemoteMode('nav')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                remoteMode === 'nav'
                  ? 'bg-amber-500 text-black shadow-md font-bold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Browse D-Pad</span>
            </button>
          </div>

          <span className="text-[11px] font-mono text-amber-400/80 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 hidden sm:inline">
            Remote Controlling EmbedMaster
          </span>
        </div>
      )}

      {/* 1. ACTIVE PLAYER REMOTE CONTROL DECK (When Playing) */}
      {isPlaying && remoteMode === 'player' ? (
        <div 
          id="remote-player-deck"
          className={`w-full p-3 sm:p-4 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black rounded-2xl border border-amber-500/40 shadow-2xl shadow-black flex flex-col gap-3 transition-all ${
            isLocked ? 'opacity-40 pointer-events-none' : ''
          }`}
        >
          {/* Timeline Scrubber */}
          <div className="w-full flex items-center gap-3">
            <span className="text-xs font-mono font-bold text-amber-400 min-w-[44px]">
              {formatTime(playerStatus.currentTime)}
            </span>
            <input
              id="remote-scrub-slider"
              type="range"
              min={0}
              max={playerStatus.duration > 0 ? playerStatus.duration : 100}
              step={1}
              value={playerStatus.currentTime}
              onChange={handleRemoteScrub}
              className="flex-1 h-2 rounded-lg bg-zinc-800 accent-amber-400 cursor-pointer"
              title="Remote Seek Timeline"
            />
            <span className="text-xs font-mono text-zinc-400 min-w-[44px] text-right">
              {formatTime(playerStatus.duration)}
            </span>
          </div>

          {/* Primary Remote Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Playback Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Seek -10s */}
              <button
                type="button"
                onClick={() => handleRemoteSeekDelta(-10)}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold cursor-pointer transition-all active:scale-95"
                title="Rewind 10 Seconds"
              >
                <RotateCcw className="w-4 h-4 text-amber-400" />
                <span>-10s</span>
              </button>

              {/* Play / Pause Toggle */}
              <button
                type="button"
                onClick={handleRemoteTogglePlay}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-black text-sm cursor-pointer transition-all active:scale-95 shadow-lg ${
                  playerStatus.isPlaying
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                }`}
                title={playerStatus.isPlaying ? "Pause Player" : "Resume Playback"}
              >
                {playerStatus.isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-black" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black translate-x-0.5" />
                    <span>Play</span>
                  </>
                )}
              </button>

              {/* Seek +10s */}
              <button
                type="button"
                onClick={() => handleRemoteSeekDelta(10)}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold cursor-pointer transition-all active:scale-95"
                title="Forward 10 Seconds"
              >
                <span>+10s</span>
                <RotateCw className="w-4 h-4 text-amber-400" />
              </button>
            </div>

            {/* Volume Control Bar */}
            <div className="flex items-center gap-1.5 sm:gap-2 bg-zinc-900 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={handleRemoteMute}
                className="text-zinc-300 hover:text-amber-400 cursor-pointer"
                title="Toggle Mute"
              >
                {playerStatus.isMuted || playerStatus.volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : (
                  <Volume2 className="w-4 h-4 text-amber-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick('switch');
                  const nextVol = Math.max(0, playerStatus.volume - 10);
                  setPlayerStatus((prev) => ({ ...prev, volume: nextVol, isMuted: nextVol === 0 }));
                  sendPlayerCommand('volume', nextVol);
                }}
                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                title="Decrease Volume (-10%)"
              >
                -
              </button>

              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={playerStatus.isMuted ? 0 : playerStatus.volume}
                onChange={handleRemoteVolume}
                className="w-16 sm:w-24 h-1.5 bg-zinc-800 accent-amber-400 cursor-pointer"
                title={`Volume ${playerStatus.volume}%`}
              />

              <button
                type="button"
                onClick={() => {
                  soundFx.playClick('switch');
                  const nextVol = Math.min(100, playerStatus.volume + 10);
                  setPlayerStatus((prev) => ({ ...prev, volume: nextVol, isMuted: false }));
                  sendPlayerCommand('volume', nextVol);
                }}
                className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-bold transition-colors cursor-pointer"
                title="Increase Volume (+10%)"
              >
                +
              </button>

              <span className="text-[10px] font-mono text-zinc-400 min-w-[26px] text-right font-semibold">
                {playerStatus.isMuted ? '0%' : `${playerStatus.volume}%`}
              </span>
            </div>

            {/* Series Prev/Next Ep + Stop Button */}
            <div className="flex items-center gap-1.5">
              {typeof playerStatus.activeSeason === 'number' && (
                <div className="flex items-center gap-1 bg-zinc-900 px-2 py-1.5 rounded-xl border border-zinc-800 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick('nav');
                      sendPlayerCommand('prev_ep');
                    }}
                    className="px-2 py-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-amber-400 cursor-pointer"
                    title="Previous Episode"
                  >
                    &lt; Ep
                  </button>
                  <span className="text-amber-400 font-mono font-bold px-1 text-xs">
                    S{playerStatus.activeSeason}:E{playerStatus.activeEpisode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      soundFx.playClick('nav');
                      sendPlayerCommand('next_ep');
                    }}
                    className="px-2 py-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-amber-400 cursor-pointer"
                    title="Next Episode"
                  >
                    Ep &gt;
                  </button>
                </div>
              )}

              {/* Fullscreen Trigger */}
              <button
                type="button"
                onClick={() => {
                  soundFx.playClick('nav');
                  sendPlayerCommand('fullscreen');
                }}
                className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-700 cursor-pointer"
                title="Toggle Fullscreen on Display"
              >
                <Maximize2 className="w-4 h-4 text-amber-400" />
              </button>

              {/* Stop & Close */}
              <button
                type="button"
                onClick={() => handleNavClick('close')}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800/80 text-xs font-bold cursor-pointer transition-all active:scale-95"
                title="Stop Media & Close Player"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
                <span>Stop</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* 2. D-PAD NAVIGATION DECK (When browsing catalog) */
        <div className={`w-full p-2 bg-gradient-to-b from-zinc-900/95 via-zinc-950/95 to-black rounded-2xl border border-zinc-800/90 shadow-2xl shadow-black/80 transition-all ${
          isLocked ? 'opacity-40 pointer-events-none' : ''
        }`}>
          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
            {/* 1. PREV Button */}
            <button
              id="remote-btn-prev"
              type="button"
              disabled={isLocked}
              onClick={() => handleNavClick('prev')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-2 rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 active:scale-95 ${
                isLocked
                  ? 'opacity-25 cursor-not-allowed bg-zinc-900/60 text-zinc-600 border border-zinc-800/80 pointer-events-none'
                  : activeAction === 'prev'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer'
                  : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/50 cursor-pointer'
              }`}
              title="Previous Item / Rewind (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300 group-hover:text-white" />
              <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
                Prev
              </span>
            </button>

            {/* 2. UP Button */}
            <button
              id="remote-btn-up"
              type="button"
              disabled={isLocked}
              onClick={() => handleNavClick('up')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-2 rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 active:scale-95 ${
                isLocked
                  ? 'opacity-25 cursor-not-allowed bg-zinc-900/60 text-zinc-600 border border-zinc-800/80 pointer-events-none'
                  : activeAction === 'up'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer'
                  : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/50 cursor-pointer'
              }`}
              title="Up (Up Arrow)"
            >
              <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300 group-hover:text-white" />
              <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
                Up
              </span>
            </button>

            {/* 3. OK Button */}
            <button
              id="remote-btn-ok"
              type="button"
              disabled={isLocked}
              onClick={() => handleNavClick('ok')}
              className={`flex-1.2 sm:flex-1.3 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-3 rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-amber-400 active:scale-95 ${
                isLocked
                  ? 'opacity-25 cursor-not-allowed bg-zinc-900/60 text-zinc-600 border border-zinc-800/80 pointer-events-none'
                  : activeAction === 'ok'
                  ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black font-black border border-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.8)] scale-102 cursor-pointer'
                  : 'bg-gradient-to-r from-amber-500/20 via-amber-400/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.2)] cursor-pointer'
              }`}
              title="OK / Play Selected Item (Enter Key)"
            >
              <CheckCircle2 className={`w-4 h-4 sm:w-5 sm:h-5 ${activeAction === 'ok' ? 'text-black' : 'text-amber-400'}`} />
              <span className="text-xs sm:text-sm font-bold tracking-wider uppercase whitespace-nowrap">
                OK
              </span>
            </button>

            {/* 4. DOWN Button */}
            <button
              id="remote-btn-down"
              type="button"
              disabled={isLocked}
              onClick={() => handleNavClick('down')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-2 rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 active:scale-95 ${
                isLocked
                  ? 'opacity-25 cursor-not-allowed bg-zinc-900/60 text-zinc-600 border border-zinc-800/80 pointer-events-none'
                  : activeAction === 'down'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer'
                  : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/50 cursor-pointer'
              }`}
              title="Down (Down Arrow)"
            >
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300 group-hover:text-white" />
              <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
                Down
              </span>
            </button>

            {/* 5. NEXT Button */}
            <button
              id="remote-btn-next"
              type="button"
              disabled={isLocked}
              onClick={() => handleNavClick('next')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-2 rounded-xl transition-all duration-200 select-none focus:outline-none focus:ring-2 focus:ring-amber-400/40 active:scale-95 ${
                isLocked
                  ? 'opacity-25 cursor-not-allowed bg-zinc-900/60 text-zinc-600 border border-zinc-800/80 pointer-events-none'
                  : activeAction === 'next'
                  ? 'bg-amber-500/30 text-amber-300 border border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.4)] cursor-pointer'
                  : 'bg-zinc-800/70 hover:bg-zinc-700/80 text-zinc-300 hover:text-white border border-zinc-700/50 cursor-pointer'
              }`}
              title="Next Item / Fast Forward (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300 group-hover:text-white" />
              <span className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
                Next
              </span>
            </button>

            {/* 6. CLOSE Button */}
            <button
              id="remote-btn-close"
              type="button"
              disabled={isLocked}
              onClick={() => handleNavClick('close')}
              className={`flex-1 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2.5 sm:py-3 px-2 rounded-xl transition-all duration-200 select-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-400/40 active:scale-95 ${
                activeAction === 'close'
                  ? 'bg-red-500/30 text-red-300 border border-red-400/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : 'bg-zinc-800/70 hover:bg-red-950/40 text-zinc-300 hover:text-red-300 border border-zinc-700/50 hover:border-red-800/60'
              }`}
              title="Close Player or Exit (Esc Key)"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-300 group-hover:text-red-300" />
              <span className="text-[11px] sm:text-xs font-bold tracking-wider uppercase whitespace-nowrap">
                Close
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Remote Status / Active Signal Monitor */}
      <div id="remote-hud-status" className="flex items-center justify-between px-3 py-1.5 bg-zinc-950/80 rounded-xl border border-zinc-800/60 text-xs">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-amber-400' : 'bg-emerald-400'} opacity-75`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="text-zinc-200 font-medium truncate">
            {activeItemTitle || 'None'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0 text-zinc-500 font-mono text-[11px]">
          {isPlaying ? (
            <span className="text-amber-400 bg-amber-950/60 border border-amber-500/50 px-2 py-0.5 rounded text-[10px] font-sans font-bold">
              EmbedMaster Active • Controlled via Remote
            </span>
          ) : (
            <>
              <span>[{totalItems > 0 ? currentIndex + 1 : 0}/{totalItems}]</span>
              <span className="hidden sm:inline bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
                Keys: ← ↑ ↵ ↓ →
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
