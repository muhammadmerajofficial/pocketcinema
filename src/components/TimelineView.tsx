import React, { useEffect } from 'react';
import { 
  Radio, 
  Star, 
  Calendar, 
  Sparkles,
  Info,
  Layers,
  Loader2,
  CheckCircle2,
  Play,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { CategoryType, MediaItem } from '../types';
import { soundFx } from '../utils/sound';

interface TimelineViewProps {
  category: CategoryType;
  items: MediaItem[];
  selectedIndex: number;
  isLoading?: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  onSelectItem: (index: number) => void;
  onOpenDetails: (item: MediaItem) => void;
  onPlayItem?: (item: MediaItem) => void;
  loadMoreRef?: (node: HTMLElement | null) => void;
}

export const TimelineView: React.FC<TimelineViewProps> = ({
  category,
  items,
  selectedIndex,
  isLoading = false,
  isLoadingMore = false,
  hasMore = false,
  onSelectItem,
  onOpenDetails,
  onPlayItem,
  loadMoreRef,
}) => {
  const getGridCols = () => {
    if (typeof window === 'undefined') return 5;
    const w = window.innerWidth;
    if (w >= 1024) return 5; // lg/xl
    if (w >= 768) return 4;  // md
    if (w >= 640) return 3;  // sm
    return 2;                // mobile
  };

  const handleNavigate = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (!items || items.length === 0) return;
    soundFx.playClick('switch');

    const cols = getGridCols();
    let nextIdx = selectedIndex;

    switch (direction) {
      case 'left':
        nextIdx = Math.max(0, selectedIndex - 1);
        break;
      case 'right':
        nextIdx = Math.min(items.length - 1, selectedIndex + 1);
        break;
      case 'up':
        nextIdx = Math.max(0, selectedIndex - cols);
        break;
      case 'down':
        nextIdx = Math.min(items.length - 1, selectedIndex + cols);
        break;
    }

    if (nextIdx !== selectedIndex) {
      onSelectItem(nextIdx);
      setTimeout(() => {
        const el = document.getElementById(`media-card-${items[nextIdx]?.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        }
      }, 50);
    }
  };

  const handlePlaySelected = () => {
    if (!items || items.length === 0) return;
    const current = items[selectedIndex] || items[0];
    if (current) {
      soundFx.playClick('ok');
      if (onPlayItem) {
        onPlayItem(current);
      } else {
        onOpenDetails(current);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleNavigate('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNavigate('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleNavigate('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNavigate('down');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handlePlaySelected();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, items]);

  return (
    <section id="media-timeline-section" className="w-full flex flex-col gap-4 sm:gap-5">
      
      {/* Category banner & Counter & 1:1 D-Pad Poster Navigator */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-zinc-200">
              {category === 'movies' ? 'Movie Collection' : category === 'tv' ? 'TV Show Series' : 'Anime Chronology'}
            </h2>
          </div>

          {/* 1:1 Ratio 4-Direction Poster Controller + Center OK Button */}
          <div 
            id="movie-collection-dpad"
            className="relative aspect-square w-14 h-14 sm:w-16 sm:h-16 bg-zinc-950/90 border border-zinc-700/80 rounded-2xl p-0.5 sm:p-1 shadow-lg grid grid-cols-3 grid-rows-3 items-center justify-items-center select-none shrink-0"
            title="Poster Navigation D-Pad: Navigate posters up/down/left/right and press OK to play"
          >
            {/* UP BUTTON */}
            <div className="col-start-2 row-start-1 w-full h-full flex items-center justify-center">
              <button
                id="dpad-btn-up"
                type="button"
                onClick={() => handleNavigate('up')}
                className="w-full h-full flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 active:scale-90 transition-all cursor-pointer"
                title="Select Poster Up"
              >
                <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* LEFT BUTTON */}
            <div className="col-start-1 row-start-2 w-full h-full flex items-center justify-center">
              <button
                id="dpad-btn-left"
                type="button"
                onClick={() => handleNavigate('left')}
                className="w-full h-full flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 active:scale-90 transition-all cursor-pointer"
                title="Select Poster Left"
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* CENTER OK BUTTON */}
            <div className="col-start-2 row-start-2 w-full h-full flex items-center justify-center">
              <button
                id="dpad-btn-ok"
                type="button"
                onClick={handlePlaySelected}
                className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-[8px] sm:text-[9px] tracking-tight flex items-center justify-center shadow-md active:scale-90 transition-all cursor-pointer border border-amber-300"
                title="Play Selected Movie (OK)"
              >
                OK
              </button>
            </div>

            {/* RIGHT BUTTON */}
            <div className="col-start-3 row-start-2 w-full h-full flex items-center justify-center">
              <button
                id="dpad-btn-right"
                type="button"
                onClick={() => handleNavigate('right')}
                className="w-full h-full flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 active:scale-90 transition-all cursor-pointer"
                title="Select Poster Right"
              >
                <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>

            {/* DOWN BUTTON */}
            <div className="col-start-2 row-start-3 w-full h-full flex items-center justify-center">
              <button
                id="dpad-btn-down"
                type="button"
                onClick={() => handleNavigate('down')}
                className="w-full h-full flex items-center justify-center rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 active:scale-90 transition-all cursor-pointer"
                title="Select Poster Down"
              >
                <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isLoading ? (
            <span className="text-xs font-mono text-amber-400 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              Loading...
            </span>
          ) : (
            <span className="text-xs font-mono text-zinc-400 bg-zinc-900/90 border border-zinc-800 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
              <Layers className="w-3 h-3 text-zinc-500" />
              {items.length} titles loaded
            </span>
          )}
        </div>
      </div>

      {/* Initial Loading Skeletons */}
      {isLoading && items.length === 0 && (
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2.5 sm:gap-3">
          {Array.from({ length: 15 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="flex flex-col rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800 animate-pulse"
            >
              <div className="w-full aspect-[2/3] bg-zinc-800/80" />
              <div className="p-3 flex flex-col gap-2">
                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
                <div className="h-3 bg-zinc-800/40 rounded w-full mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="w-full flex flex-col items-center justify-center py-20 px-4 text-center bg-zinc-950/40 rounded-2xl border border-zinc-900">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-500 mb-3">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-zinc-300">No media found</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm">
            No matches found from TMDB. Try a different keyword or reset filters.
          </p>
        </div>
      )}

      {/* 5-Column Edge-to-Edge Grid without wasted side spaces */}
      {items.length > 0 && (
        <>
          <div 
            id="media-5-column-grid"
            className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2.5 sm:gap-3"
          >
            {items.map((item, index) => {
              const isSelected = selectedIndex === index;

              return (
                <article
                  key={`${item.id}-${index}`}
                  id={`media-card-${item.id}`}
                  onClick={() => {
                    soundFx.playClick('ok');
                    onSelectItem(index);
                    if (onPlayItem) {
                      onPlayItem(item);
                    } else {
                      onOpenDetails(item);
                    }
                  }}
                  className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-300 select-none ${
                    isSelected
                      ? 'bg-zinc-900/95 ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.45)] scale-[1.02] z-10'
                      : 'bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/50'
                  }`}
                >
                  {/* Active Remote Indicator Pill */}
                  {isSelected && (
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-black text-[9px] tracking-wider uppercase shadow-md">
                      <Radio className="w-2.5 h-2.5 animate-pulse text-zinc-950" />
                      <span>TARGET</span>
                    </div>
                  )}

                  {/* Poster Image Container */}
                  <div className="relative w-full aspect-[2/3] overflow-hidden bg-zinc-800">
                    <img
                      src={item.poster}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop';
                      }}
                    />
                    
                    {/* Visual Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent opacity-80 group-hover:opacity-40 transition-opacity" />

                    {/* Central Play Badge on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                      <div className="w-11 h-11 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.6)] transform group-hover:scale-110 transition-transform">
                        <Play className="w-5 h-5 fill-zinc-950 ml-0.5" />
                      </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-amber-300 text-[11px] font-bold border border-white/10 shadow z-10">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{item.rating.toFixed(1)}</span>
                    </div>

                    {/* Era / Release Year Badge */}
                    <div className="absolute bottom-2 left-2 flex items-center gap-1.5 z-10">
                      <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30">
                        {item.year}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-black/75 text-[10px] text-zinc-300 font-medium truncate max-w-[80px]">
                        {item.ageRating}
                      </span>
                    </div>
                  </div>

                  {/* Card Body Content */}
                  <div className="p-2.5 sm:p-3 flex flex-col justify-between flex-1 gap-1.5">
                    <div>
                      <h3 className={`font-bold text-xs sm:text-sm line-clamp-1 leading-tight transition-colors ${
                        isSelected ? 'text-amber-300' : 'text-zinc-100 group-hover:text-amber-300'
                      }`}>
                        {item.title}
                      </h3>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        {item.directorOrStudio}
                      </p>
                    </div>

                    {/* Tags and Play/Info Action */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 mt-0.5">
                      <span className="truncate max-w-[90px] text-zinc-400">
                        {item.genres[0] || 'Media'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          soundFx.playClick('nav');
                          onOpenDetails(item);
                        }}
                        className="text-zinc-400 hover:text-amber-300 font-mono text-[9px] shrink-0 flex items-center gap-0.5 p-1 -m-1 rounded hover:bg-zinc-800 transition-colors"
                        title="View Synopsis"
                      >
                        <Info className="w-2.5 h-2.5" />
                        Info
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Infinite Scroll Anchor & Bottom Status */}
          <div
            ref={loadMoreRef}
            id="infinite-scroll-trigger"
            className="w-full py-8 flex flex-col items-center justify-center text-center"
          >
            {isLoadingMore && (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-amber-400 text-xs font-medium shadow-lg">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Loading more {category === 'anime' ? 'anime' : category === 'tv' ? 'shows' : 'movies'}...</span>
              </div>
            )}

            {!hasMore && items.length > 0 && !isLoading && (
              <div className="flex items-center gap-1.5 text-zinc-500 text-xs font-mono py-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-zinc-600" />
                <span>You have reached the end of the collection</span>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
