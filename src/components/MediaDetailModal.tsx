import React, { useEffect } from 'react';
import { 
  X, 
  Play, 
  Plus, 
  Check, 
  Star, 
  Calendar, 
  Clock, 
  Film, 
  Volume2, 
  Share2,
  Tv,
  Flame
} from 'lucide-react';
import { MediaItem } from '../types';
import { soundFx } from '../utils/sound';

interface MediaDetailModalProps {
  item: MediaItem | null;
  onClose: () => void;
  isBookmarked: boolean;
  onToggleBookmark: (id: string) => void;
  onPlay?: (item: MediaItem) => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  item,
  onClose,
  isBookmarked,
  onToggleBookmark,
  onPlay,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!item) return null;

  const getCategoryIcon = () => {
    if (item.category === 'movies') return <Film className="w-4 h-4 text-amber-400" />;
    if (item.category === 'tv') return <Tv className="w-4 h-4 text-amber-400" />;
    return <Flame className="w-4 h-4 text-amber-400" />;
  };

  return (
    <div 
      id="media-detail-backdrop" 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="media-detail-dialog"
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-zinc-950 rounded-3xl border border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.9)] text-zinc-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Backdrop Hero Header */}
        <div className="relative h-64 sm:h-80 w-full overflow-hidden shrink-0">
          <img 
            src={item.backdrop} 
            alt={item.title} 
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent" />

          {/* Close Button */}
          <button
            id="close-detail-modal-btn"
            type="button"
            onClick={() => {
              soundFx.playClick('nav');
              onClose();
            }}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/10 transition-colors cursor-pointer z-20 backdrop-blur-md"
            title="Close (ESC / Back)"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top category badge */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-semibold text-zinc-200">
            {getCategoryIcon()}
            <span className="uppercase tracking-widest">{item.category}</span>
          </div>

          {/* Content title overlay at bottom of backdrop */}
          <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-4 z-10">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-mono font-medium text-amber-400 uppercase tracking-widest">
                {item.timelineEra}
              </span>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white drop-shadow-md">
                {item.title}
              </h1>
              {item.tagline && (
                <p className="text-xs sm:text-sm text-zinc-300 italic font-serif">
                  "{item.tagline}"
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Details & Actions Body */}
        <div className="p-5 sm:p-7 flex flex-col gap-6">
          
          {/* Quick Meta Row */}
          <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-zinc-400 border-b border-zinc-800/80 pb-4">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span>{item.rating.toFixed(1)}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>{item.year}</span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 font-medium">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              <span>{item.durationOrEpisodes}</span>
            </div>

            <span className="px-2 py-0.5 rounded border border-zinc-700 text-[11px] font-semibold tracking-wider text-zinc-300">
              {item.ageRating}
            </span>

            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="text-zinc-600">•</span>
              <span>{item.directorOrStudio}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              id="detail-play-stream-btn"
              type="button"
              onClick={() => {
                soundFx.playClick('ok');
                onClose();
                if (onPlay && item) {
                  onPlay(item);
                }
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-bold text-sm tracking-wide shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer select-none"
            >
              <Play className="w-4 h-4 fill-zinc-950 text-zinc-950" />
              <span>Watch Now</span>
            </button>

            <button
              id="detail-bookmark-btn"
              type="button"
              onClick={() => {
                soundFx.playClick('nav');
                onToggleBookmark(item.id);
              }}
              className={`flex items-center gap-2 px-4 py-3.5 rounded-2xl border text-sm font-medium transition-colors cursor-pointer select-none ${
                isBookmarked 
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                  : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
              }`}
            >
              {isBookmarked ? <Check className="w-4 h-4 text-emerald-400" /> : <Plus className="w-4 h-4 text-zinc-400" />}
              <span>{isBookmarked ? 'In Watchlist' : 'Add Watchlist'}</span>
            </button>

            <button
              id="detail-audio-btn"
              type="button"
              onClick={() => soundFx.playClick('nav')}
              className="p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Soundtrack & Audio"
            >
              <Volume2 className="w-4 h-4" />
            </button>

            <button
              id="detail-share-btn"
              type="button"
              onClick={() => soundFx.playClick('nav')}
              className="p-3.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              title="Share Title"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Genre Badges */}
          <div className="flex flex-wrap gap-2">
            {item.genres.map((genre) => (
              <span 
                key={genre}
                className="px-3 py-1 rounded-full text-xs font-medium bg-zinc-900/90 text-zinc-300 border border-zinc-800"
              >
                {genre}
              </span>
            ))}
          </div>

          {/* Synopsis */}
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-bold tracking-wider uppercase text-zinc-400">
              Overview & Timeline Context
            </h3>
            <p className="text-sm sm:text-base leading-relaxed text-zinc-300">
              {item.synopsis}
            </p>
          </div>

          {/* Cast & Team */}
          {item.cast && item.cast.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold tracking-wider uppercase text-zinc-400">
                Key Cast & Performers
              </h3>
              <div className="flex flex-wrap gap-2">
                {item.cast.map((actor) => (
                  <span 
                    key={actor} 
                    className="px-3 py-1 rounded-xl bg-zinc-900 text-xs text-zinc-300 border border-zinc-800/80"
                  >
                    {actor}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline Node Info Footer */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
            <span>Released: <strong className="text-zinc-200">{item.releaseDate}</strong></span>
            <span>Remote Navigator: <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">ESC / Back</kbd></span>
          </div>

        </div>
      </div>
    </div>
  );
};
