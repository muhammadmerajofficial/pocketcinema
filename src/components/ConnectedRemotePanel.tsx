import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  ChevronUp, 
  ChevronDown, 
  Volume2, 
  VolumeX, 
  Volume1, 
  ArrowLeft, 
  Maximize2, 
  Tv2 
} from 'lucide-react';
import { MediaItem } from '../types';
import { fetchTvShowMetadata, TvShowMetadata } from '../services/tvShowData';
import { popupManager } from '../utils/popupManager';
import { syncManager } from '../utils/syncChannel';
import { soundFx } from '../utils/sound';
import { updateRoom } from '../services/remotePairing';

interface ConnectedRemotePanelProps {
  isPlaying: boolean;
  item?: MediaItem | null;
  season?: number;
  episode?: number;
  category?: string;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  onTogglePlayPause: () => void;
  onRewind10: () => void;
  onForward10: () => void;
  onSeekTime: (seconds: number) => void;
  onPlaySeasonEpisode: (season: number, episode: number) => void;
  onCloseSession?: () => void;
  pairingCode?: string;
  variant?: 'floating' | 'embedded';
}

export const ConnectedRemotePanel: React.FC<ConnectedRemotePanelProps> = ({
  isPlaying,
  item,
  season = 1,
  episode = 1,
  category,
  volume = 100,
  onVolumeChange,
  onTogglePlayPause,
  onRewind10,
  onForward10,
  onSeekTime,
  onPlaySeasonEpisode,
  onCloseSession,
  pairingCode,
  variant = 'floating',
}) => {
  const [customMinutes, setCustomMinutes] = useState<string>('');
  const [tvMeta, setTvMeta] = useState<TvShowMetadata | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(season || 1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(episode || 1);

  const isSeries = Boolean(item && (item.category === 'tv' || item.category === 'anime')) || category === 'tv' || category === 'anime';

  // Sync selected season/episode when props change
  useEffect(() => {
    if (typeof season === 'number' && season > 0) {
      setSelectedSeason(season);
    }
  }, [season]);

  useEffect(() => {
    if (typeof episode === 'number' && episode > 0) {
      setSelectedEpisode(episode);
    }
  }, [episode]);

  // Load TV show / Anime metadata for exact seasons and episode counts
  useEffect(() => {
    if (!item || !isSeries) return;
    let isMounted = true;
    fetchTvShowMetadata(item)
      .then((meta) => {
        if (isMounted && meta) {
          setTvMeta(meta);
        }
      })
      .catch((err) => console.warn('[ConnectedRemotePanel] Meta load warning:', err));
    return () => {
      isMounted = false;
    };
  }, [item?.id, isSeries]);

  const totalSeasons = Math.max(1, tvMeta?.totalSeasons || 1);
  const currentSeasonData = tvMeta?.seasons?.find((s) => s.seasonNumber === selectedSeason);
  const totalEpisodes = currentSeasonData ? currentSeasonData.episodeCount : 12;

  const handleSeasonChange = (newS: number) => {
    const clampedS = Math.max(1, Math.min(totalSeasons, newS));
    setSelectedSeason(clampedS);
    const targetSeasonData = tvMeta?.seasons?.find((s) => s.seasonNumber === clampedS);
    const targetMaxEps = targetSeasonData ? targetSeasonData.episodeCount : 12;
    const ep = selectedEpisode > targetMaxEps ? targetMaxEps : selectedEpisode;
    if (selectedEpisode > targetMaxEps) {
      setSelectedEpisode(targetMaxEps);
    }
    onPlaySeasonEpisode(clampedS, ep);
  };

  const handleEpisodeChange = (newEp: number) => {
    const clampedEp = Math.max(1, Math.min(totalEpisodes, newEp));
    setSelectedEpisode(clampedEp);
    onPlaySeasonEpisode(selectedSeason, clampedEp);
  };

  const handleJumpToTime = () => {
    const mins = parseFloat(customMinutes);
    if (!isNaN(mins) && mins >= 0) {
      onSeekTime(mins * 60);
      if (!isPlaying) {
        onTogglePlayPause();
      }
      setCustomMinutes('');
    }
  };

  const handleToggleFullscreen = () => {
    soundFx.playClick('switch');
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command: 'fullscreen',
      timestamp: Date.now(),
    });
    const code = pairingCode || (typeof window !== 'undefined' ? (localStorage.getItem('cinematic_remote_room_code') || localStorage.getItem('active_tv_screen_code')) : '');
    if (code) {
      updateRoom(code, {
        action: 'fullscreen',
        lastCommandTimestamp: Date.now(),
      });
    }
  };

  const handleBackClick = () => {
    soundFx.playClick('switch');
    popupManager.closeAllOpenedTabs();
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command: 'back',
      timestamp: Date.now(),
    });
    const code = pairingCode || (typeof window !== 'undefined' ? (localStorage.getItem('cinematic_remote_room_code') || localStorage.getItem('active_tv_screen_code')) : '');
    if (code) {
      updateRoom(code, {
        action: 'back',
        lastCommandTimestamp: Date.now(),
      });
    }
  };

  const isEmbedded = variant === 'embedded';

  return (
    <div 
      id={isEmbedded ? "embedded-tv-player-controlbar" : "bottom-player-controlbar"}
      className={
        isEmbedded
          ? "w-full rounded-2xl sm:rounded-3xl bg-gradient-to-b from-zinc-950 via-zinc-950 to-black border border-emerald-500/40 p-3.5 sm:p-5 shadow-2xl flex flex-col gap-3.5 select-none animate-fadeIn"
          : "fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d12]/95 border-t border-zinc-800/90 backdrop-blur-xl px-3 py-2.5 sm:px-5 sm:py-3 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] select-none animate-slideUp"
      }
    >
      {/* Movie Backdrop Image (Showing the movie currently playing on TV) */}
      {isEmbedded && (
        <div 
          id="tv-playing-movie-backdrop"
          className="relative w-full aspect-[16/9] sm:aspect-[21/9] max-h-72 rounded-xl sm:rounded-2xl overflow-hidden border border-zinc-800/90 bg-zinc-950 shadow-inner group"
        >
          {item?.backdrop || item?.poster ? (
            <img
              src={item.backdrop || item.poster}
              alt={item.title || 'Now Playing on TV'}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 bg-zinc-900">
              <Tv2 className="w-12 h-12 mb-2 text-zinc-500 opacity-60" />
              <span className="text-xs font-mono uppercase tracking-wider text-zinc-500">Live TV Stream</span>
            </div>
          )}

          {/* Cinematic dark gradient overlay at bottom for smooth contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

          {/* Title and metadata badge cleanly placed on the backdrop */}
          {item?.title && (
            <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 max-w-[85%]">
              <h3 className="text-sm sm:text-base md:text-lg font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate">
                {item.title}
              </h3>
              {isSeries ? (
                <p className="text-[11px] sm:text-xs text-amber-400 font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  Season {selectedSeason} • Episode {selectedEpisode}
                </p>
              ) : item.year ? (
                <p className="text-[11px] sm:text-xs text-zinc-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                  {item.year} {item.durationOrEpisodes ? `• ${item.durationOrEpisodes}` : ''}
                </p>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className={isEmbedded ? "w-full flex flex-col gap-2.5 sm:gap-3" : "max-w-3xl mx-auto flex flex-col items-center gap-2 sm:gap-2.5 w-full"}>
        {/* ROW 1: Playback Controls (Rewind, Play/Pause, Forward) AND Custom Minute Box on the SAME LINE */}
        <div className="w-full flex items-center justify-between gap-1.5 sm:gap-3 flex-nowrap overflow-x-auto no-scrollbar">
          {/* Left: Rewind, Play/Pause, Forward, and Custom Minute Box on the SAME LINE */}
          <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 shrink-0">
            {/* Rewind 10s */}
            <button
              id="ctrl-btn-rewind-10"
              type="button"
              onClick={onRewind10}
              className="p-1.5 xs:p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
              title="Rewind 10s"
              aria-label="Rewind 10s"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </button>

            {/* Play/Pause Toggle */}
            <button
              id="ctrl-btn-play-pause"
              type="button"
              onClick={onTogglePlayPause}
              className={`px-2.5 xs:px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md shrink-0 ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black stroke-black" />
                  <span className="hidden xs:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-black stroke-black" />
                  <span className="hidden xs:inline">Play</span>
                </>
              )}
            </button>

            {/* Fast Forward 10s */}
            <button
              id="ctrl-btn-forward-10"
              type="button"
              onClick={onForward10}
              className="p-1.5 xs:p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
              title="Forward 10s"
              aria-label="Forward 10s"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </button>

            {/* Custom Minute Box (RIGHT BESIDE Rewind, Play/Pause, Forward on the SAME LINE!) */}
            <div 
              id="ctrl-custom-minute-box"
              className="flex items-center bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-xl px-1.5 sm:px-2 py-1 gap-1 focus-within:border-amber-500/60 transition-all shadow-sm shrink-0"
              title="Enter minutes to jump and play directly on TV"
            >
              <span className="text-[10px] sm:text-xs font-mono font-bold text-zinc-400 uppercase tracking-tight pl-0.5 select-none">
                Min:
              </span>
              <input
                id="ctrl-input-jump-time"
                type="number"
                min={0}
                step="any"
                placeholder="0"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleJumpToTime();
                  }
                }}
                className="w-8 xs:w-10 sm:w-12 text-center bg-transparent text-amber-400 text-xs sm:text-sm font-mono font-bold outline-none placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title="Enter minute (e.g. 5, 12, 45) and click play"
              />
              <button
                id="ctrl-btn-jump-time-play"
                type="button"
                onClick={handleJumpToTime}
                disabled={!customMinutes.trim()}
                className="p-1 sm:p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black active:scale-90 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed shadow-sm shrink-0"
                title="Play from this minute"
                aria-label="Play from this minute"
              >
                <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-black stroke-black translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* Right: Back, Full Screen, and Close Session */}
          <div className="flex items-center gap-1 xs:gap-1.5 sm:gap-2 shrink-0">
            {/* Back / Close Opened Tab Button (Remote Back) */}
            <button
              id="ctrl-btn-back-tab"
              type="button"
              onClick={handleBackClick}
              className="p-1.5 xs:px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-amber-400 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer text-xs font-semibold shadow-sm shrink-0"
              title="Back / Close Ad Tab (Remote Back)"
              aria-label="Back / Close Tab"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Full Screen Button */}
            <button
              id="ctrl-btn-fullscreen"
              type="button"
              onClick={handleToggleFullscreen}
              className="p-1.5 xs:px-2.5 sm:px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-amber-400 flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer text-xs font-semibold shadow-sm shrink-0"
              title="Toggle TV Fullscreen"
              aria-label="Toggle TV Fullscreen"
            >
              <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Full Screen</span>
            </button>
          </div>
        </div>

        {/* ROW 2 (NICHER LINE): Episode Selector AND Volumebar in ONE line ("tarnicher line a thakbe episode selector and voliumebar ek line a") */}
        <div className="w-full flex items-center justify-between gap-2 sm:gap-3 pt-2 border-t border-zinc-800/80 flex-nowrap">
          {/* Episode Selector (Season Stepper + Episode Stepper + Play Episode) */}
          {isSeries && (
            <div 
              id="ctrl-episode-selector-deck" 
              className="flex items-center gap-1 sm:gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-xl px-1.5 sm:px-2 py-0.5 sm:py-1 shadow-sm shrink-0"
            >
              {/* Season Stepper */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] sm:text-xs text-zinc-400 font-semibold font-mono">S</span>
                <div className="flex items-center bg-black/60 border border-zinc-700/80 rounded-lg px-0.5 sm:px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => handleSeasonChange(selectedSeason - 1)}
                    disabled={selectedSeason <= 1}
                    className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                    title="Decrease Season"
                  >
                    <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={totalSeasons}
                    value={selectedSeason}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) handleSeasonChange(val);
                    }}
                    className="w-5 xs:w-6 sm:w-7 text-center bg-transparent text-amber-400 text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleSeasonChange(selectedSeason + 1)}
                    disabled={selectedSeason >= totalSeasons}
                    className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                    title="Increase Season"
                  >
                    <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>

              {/* Episode Stepper */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] sm:text-xs text-zinc-400 font-semibold font-mono">Ep</span>
                <div className="flex items-center bg-black/60 border border-zinc-700/80 rounded-lg px-0.5 sm:px-1 py-0.5">
                  <button
                    type="button"
                    onClick={() => handleEpisodeChange(selectedEpisode - 1)}
                    disabled={selectedEpisode <= 1}
                    className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                    title="Decrease Episode"
                  >
                    <ChevronDown className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={totalEpisodes}
                    value={selectedEpisode}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) handleEpisodeChange(val);
                    }}
                    className="w-5 xs:w-6 sm:w-7 text-center bg-transparent text-amber-400 text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleEpisodeChange(selectedEpisode + 1)}
                    disabled={selectedEpisode >= totalEpisodes}
                    className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                    title="Increase Episode"
                  >
                    <ChevronUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>
              </div>

              {/* Play Episode Button */}
              <button
                id="btn-play-season-episode"
                type="button"
                onClick={() => onPlaySeasonEpisode(selectedSeason, selectedEpisode)}
                className="p-1 sm:px-2 sm:py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0"
                title={`Play Season ${selectedSeason} Episode ${selectedEpisode}`}
              >
                <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-black stroke-black" />
                <span className="hidden xs:inline">Play</span>
              </button>
            </div>
          )}

          {/* Volume Deck - on the same line as Episode Selector */}
          <div className={`flex items-center gap-1.5 sm:gap-2 bg-zinc-900/90 border border-zinc-800 rounded-xl px-2 sm:px-2.5 py-1 shadow-sm ${
            isSeries ? 'flex-1 max-w-[200px] xs:max-w-[240px] sm:max-w-xs justify-between sm:justify-start' : 'w-full max-w-sm justify-between sm:justify-start'
          }`}>
            <button
              id="ctrl-volume-mute-btn"
              type="button"
              onClick={() => {
                if (onVolumeChange) {
                  onVolumeChange(volume === 0 ? 100 : 0);
                }
              }}
              className="text-zinc-400 hover:text-amber-400 transition-colors p-0.5 cursor-pointer shrink-0"
              title={volume === 0 ? "Unmute" : "Mute"}
            >
              {volume === 0 ? (
                <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
              ) : volume < 50 ? (
                <Volume1 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              )}
            </button>
            <input
              id="ctrl-volume-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume}
              onChange={(e) => onVolumeChange?.(Number(e.target.value))}
              className="w-14 xs:w-20 sm:w-28 md:w-36 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              title={`Volume: ${volume}%`}
            />
            <span className="text-[10px] sm:text-xs font-mono text-zinc-400 w-6 xs:w-7 text-right font-semibold shrink-0">
              {volume}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
