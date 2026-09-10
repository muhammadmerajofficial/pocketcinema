import React from 'react';
import { 
  Radio, 
  Star, 
  Calendar, 
  Play,
  Loader2,
  CheckCircle2,
  Info
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
  disabled?: boolean;
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
  disabled = false,
  onSelectItem,
  onOpenDetails,
  onPlayItem,
  loadMoreRef,
}) => {
  return (
    <section id="media-timeline-section" className="w-full flex flex-col gap-4 sm:gap-5 pt-1">


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
                    if (disabled) return;
                    soundFx.playClick('ok');
                    onSelectItem(index);
                    if (onPlayItem) {
                      onPlayItem(item);
                    } else {
                      onOpenDetails(item);
                    }
                  }}
                  className={`relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 select-none ${
                    disabled
                      ? 'opacity-40 pointer-events-none cursor-not-allowed bg-zinc-900/40 border border-zinc-800/40'
                      : isSelected
                      ? 'group cursor-pointer bg-zinc-900/95 ring-2 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.45)] scale-[1.02] z-10'
                      : 'group cursor-pointer bg-zinc-900/60 hover:bg-zinc-900/90 border border-zinc-800/80 hover:border-zinc-700/80 hover:shadow-lg hover:shadow-black/50'
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
                        disabled={disabled}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (disabled) return;
                          soundFx.playClick('nav');
                          onOpenDetails(item);
                        }}
                        className={`text-zinc-400 hover:text-amber-300 font-mono text-[9px] shrink-0 flex items-center gap-0.5 p-1 -m-1 rounded hover:bg-zinc-800 transition-colors ${
                          disabled ? 'pointer-events-none opacity-40 cursor-not-allowed' : ''
                        }`}
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
