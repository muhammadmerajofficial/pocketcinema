import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  X,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { MediaItem } from '../types';
import { fetchTvShowMetadata, TvShowMetadata } from '../services/tvShowData';

interface ConnectedRemotePanelProps {
  isPlaying: boolean;
  item?: MediaItem | null;
  season?: number;
  episode?: number;
  category?: string;
  onTogglePlayPause: () => void;
  onRewind10: () => void;
  onForward10: () => void;
  onSeekTime: (seconds: number) => void;
  onPlaySeasonEpisode: (season: number, episode: number) => void;
  onCloseSession: () => void;
}

export const ConnectedRemotePanel: React.FC<ConnectedRemotePanelProps> = ({
  isPlaying,
  item,
  season = 1,
  episode = 1,
  category,
  onTogglePlayPause,
  onRewind10,
  onForward10,
  onSeekTime,
  onPlaySeasonEpisode,
  onCloseSession,
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
      setCustomMinutes('');
    }
  };

  return (
    <div 
      id="bottom-player-controlbar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d12]/95 border-t border-zinc-800/90 backdrop-blur-xl px-3 py-2 sm:px-4 sm:py-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.85)] select-none animate-slideUp"
    >
      <div className="max-w-xl mx-auto flex flex-col items-center gap-2 w-full">
        {/* Line 1: Season & Episode Bar (ONLY for TV Shows and Anime - between D-pad and Controls) */}
        {isSeries && (
          <div 
            id="remote-season-episode-bar"
            className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 w-full bg-zinc-950/85 border border-zinc-800/80 rounded-xl px-2.5 py-1.5 shadow-inner"
          >
            {/* Season Selector with Total count & Up/Down arrows */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs text-zinc-400 font-semibold whitespace-nowrap">
                Season <span className="text-zinc-500 text-[10px]">(Total: {totalSeasons})</span>:
              </span>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => handleSeasonChange(selectedSeason - 1)}
                  disabled={selectedSeason <= 1}
                  className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                  title="Decrease Season"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
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
                  className="w-7 sm:w-8 text-center bg-transparent text-amber-400 text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => handleSeasonChange(selectedSeason + 1)}
                  disabled={selectedSeason >= totalSeasons}
                  className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                  title="Increase Season"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <span className="text-zinc-700 hidden xs:inline">•</span>

            {/* Episode Selector with Total count & Up/Down arrows */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] sm:text-xs text-zinc-400 font-semibold whitespace-nowrap">
                Episode <span className="text-zinc-500 text-[10px]">(Total: {totalEpisodes})</span>:
              </span>
              <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => handleEpisodeChange(selectedEpisode - 1)}
                  disabled={selectedEpisode <= 1}
                  className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                  title="Decrease Episode"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
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
                  className="w-7 sm:w-8 text-center bg-transparent text-amber-400 text-xs font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  type="button"
                  onClick={() => handleEpisodeChange(selectedEpisode + 1)}
                  disabled={selectedEpisode >= totalEpisodes}
                  className="p-0.5 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                  title="Increase Episode"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Play Season/Episode Button */}
            <button
              id="btn-play-season-episode"
              type="button"
              onClick={() => onPlaySeasonEpisode(selectedSeason, selectedEpisode)}
              className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-sm shrink-0"
              title={`Play Season ${selectedSeason} Episode ${selectedEpisode}`}
            >
              <Play className="w-3.5 h-3.5 fill-black stroke-black" />
              <span className="hidden sm:inline">Play</span>
            </button>
          </div>
        )}

        {/* Line 2: Playback Controls Line */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 w-full">
          {/* Rewind 10s - Amber icon only */}
          <button
            id="ctrl-btn-rewind-10"
            type="button"
            onClick={onRewind10}
            className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
            title="Rewind 10s"
            aria-label="Rewind 10s"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
          </button>

          {/* Play/Pause Toggle */}
          <button
            id="ctrl-btn-play-pause"
            type="button"
            onClick={onTogglePlayPause}
            className={`px-4 sm:px-6 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer shadow-md shrink-0 ${
              isPlaying
                ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/20'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
            }`}
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-black stroke-black" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-black stroke-black" />
                <span>Play</span>
              </>
            )}
          </button>

          {/* Fast Forward 10s - Amber icon only */}
          <button
            id="ctrl-btn-forward-10"
            type="button"
            onClick={onForward10}
            className="p-2 sm:p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 flex items-center justify-center cursor-pointer active:scale-95 transition-all shadow-sm shrink-0"
            title="Forward 10s"
            aria-label="Forward 10s"
          >
            <RotateCw className="w-4 h-4 text-amber-400" />
          </button>

          {/* Custom Time Jump Box + Play Icon */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl px-1.5 sm:px-2 py-1 gap-1 focus-within:border-amber-500/60 transition-colors">
            <input
              id="ctrl-input-jump-time"
              type="number"
              min={0}
              step="any"
              placeholder="Min"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleJumpToTime();
                }
              }}
              className="w-9 sm:w-11 text-center bg-transparent text-amber-400 text-xs font-mono font-bold outline-none placeholder:text-zinc-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              title="Enter minutes (e.g. 10 or 20) and click play"
            />
            <span className="text-[10px] text-zinc-500 font-mono select-none">m</span>
            <button
              id="ctrl-btn-jump-time-play"
              type="button"
              onClick={handleJumpToTime}
              disabled={!customMinutes.trim()}
              className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-400 hover:text-black active:scale-90 transition-all cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed"
              title="Jump to time and play"
            >
              <Play className="w-3 h-3 fill-current stroke-current" />
            </button>
          </div>

          {/* Close Button - ONLY Close Icon (no text) */}
          <button
            id="ctrl-btn-close-session"
            type="button"
            onClick={onCloseSession}
            className="p-2 sm:p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/70 border border-red-500/40 text-red-300 hover:text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer shrink-0"
            title="Close Player"
            aria-label="Close Player"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
