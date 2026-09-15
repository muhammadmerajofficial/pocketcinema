import React from 'react';
import { 
  Radio, 
  Star, 
  Calendar, 
  Play,
  Loader2,
  CheckCircle2,
  Info,
  User,
  Film,
  Sparkles,
  ArrowLeft,
  Clapperboard,
  Tv,
  Eye
} from 'lucide-react';
import { CategoryType, MediaItem, PersonItem } from '../types';
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
  
  // Person search & profile props
  persons?: PersonItem[];
  onSelectPerson?: (person: PersonItem) => void;
  activePerson?: PersonItem | null;
  onClearPerson?: () => void;
  personCategoryFilter?: 'all' | CategoryType;
  onPersonCategoryFilterChange?: (cat: 'all' | CategoryType) => void;
  isPersonLoading?: boolean;
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
  persons = [],
  onSelectPerson,
  activePerson = null,
  onClearPerson,
  personCategoryFilter = 'all',
  onPersonCategoryFilterChange,
  isPersonLoading = false,
}) => {
  // Filter items if person category filter is active (e.g. within an artist's filmography)
  const displayItems = activePerson && personCategoryFilter !== 'all'
    ? items.filter((item) => item.category === personCategoryFilter)
    : items;

  return (
    <section id="media-timeline-section" className="w-full flex flex-col gap-4 sm:gap-5 pt-1">
      
      {/* ACTIVE PERSON FILMOGRAPHY PROFILE BANNER */}
      {activePerson && (
        <div 
          id="person-profile-header-banner"
          className="w-full rounded-2xl bg-gradient-to-r from-zinc-900/90 via-zinc-900/70 to-zinc-950 border border-amber-500/30 p-3.5 sm:p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4"
        >
          {/* Subtle Ambient Background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          
          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Left: Back button & Artist identity */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Back to search button */}
              <button
                type="button"
                id="back-to-search-btn"
                onClick={() => {
                  soundFx.playClick('nav');
                  onClearPerson?.();
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-400 hover:text-amber-300 text-xs font-bold transition-all border border-zinc-700/60 shadow hover:scale-105 active:scale-95"
                title="Return to search results"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              {/* Profile Avatar / Photo */}
              <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-xl overflow-hidden bg-zinc-800 border-2 border-amber-400/60 shrink-0 shadow-md">
                {activePerson.profilePath ? (
                  <img
                    src={activePerson.profilePath}
                    alt={activePerson.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-400">
                    <User className="w-6 h-6" />
                  </div>
                )}
              </div>

              {/* Artist Name & Info */}
              <div className="flex flex-col">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-xl font-black text-zinc-100 tracking-tight">
                    {activePerson.name}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-black text-[9px] sm:text-[10px] tracking-wider uppercase shadow-sm">
                    {activePerson.roleTitle || activePerson.knownForDepartment}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {items.length} Works in Filmography • Tap any poster to instantly play in player
                </p>
              </div>
            </div>

            {/* Right: Works Category Tabs inside Artist Profile */}
            {onPersonCategoryFilterChange && items.length > 0 && (
              <div className="flex items-center gap-1.5 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800 self-stretch sm:self-auto justify-center sm:justify-start">
                {(['all', 'movies', 'tv', 'anime'] as const).map((cat) => {
                  const isCatActive = personCategoryFilter === cat;
                  const catCount = cat === 'all' 
                    ? items.length 
                    : items.filter((i) => i.category === cat).length;

                  if (cat !== 'all' && catCount === 0) return null;

                  return (
                    <button
                      key={`person-filter-${cat}`}
                      type="button"
                      onClick={() => {
                        soundFx.playClick('switch');
                        onPersonCategoryFilterChange(cat);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all capitalize flex items-center gap-1 ${
                        isCatActive
                          ? 'bg-amber-400 text-zinc-950 shadow-md scale-105'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                      }`}
                    >
                      <span>{cat === 'all' ? 'All' : cat === 'movies' ? 'Movies' : cat === 'tv' ? 'TV' : 'Anime'}</span>
                      <span className={`text-[10px] font-mono px-1 rounded ${
                        isCatActive ? 'bg-black/20 text-zinc-950' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {catCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading state for Person Credits */}
      {isPersonLoading && (
        <div className="w-full flex flex-col items-center justify-center py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400 mb-3" />
          <p className="text-sm font-semibold text-zinc-300">Loading filmography & works...</p>
        </div>
      )}

      {/* Initial Loading Skeletons */}
      {isLoading && items.length === 0 && !isPersonLoading && (
        <div className="w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3">
          {Array.from({ length: 18 }).map((_, idx) => (
            <div
              key={`skeleton-${idx}`}
              className="flex flex-col rounded-xl overflow-hidden bg-zinc-900/60 border border-zinc-800 animate-pulse"
            >
              <div className="w-full aspect-[2/3] bg-zinc-800/80" />
              <div className="p-2 sm:p-2.5 flex flex-col gap-1.5">
                <div className="h-3.5 bg-zinc-800 rounded w-3/4" />
                <div className="h-2.5 bg-zinc-800/60 rounded w-1/2" />
                <div className="h-2 bg-zinc-800/40 rounded w-full mt-1" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isPersonLoading && displayItems.length === 0 && persons.length === 0 && (
        <div className="w-full flex flex-col items-center justify-center py-20 px-4 text-center bg-zinc-950/40 rounded-2xl border border-zinc-900">
          <div className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 text-zinc-500 mb-3">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-zinc-300">No media or artist found</h3>
          <p className="text-sm text-zinc-500 mt-1 max-w-sm">
            No matches found from TMDB. Try searching by actor, actress, director, producer, or media title.
          </p>
        </div>
      )}

      {/* Responsive Grid: 6 columns on desktop, 3 columns on mobile */}
      {(!isLoading && !isPersonLoading && (displayItems.length > 0 || (!activePerson && persons.length > 0))) && (
        <>
          <div 
            id="media-responsive-grid"
            className="w-full grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3"
          >
            {/* 1. MATCHING PERSON PROFILE CARDS (Actor, Actress, Director, Producer) - SAME POSTER SIZE */}
            {!activePerson && persons.length > 0 && persons.map((person) => {
              return (
                <article
                  key={`person-card-${person.id}`}
                  id={`person-card-${person.id}`}
                  onClick={() => {
                    if (disabled) return;
                    soundFx.playClick('ok');
                    onSelectPerson?.(person);
                  }}
                  className={`relative flex flex-col rounded-xl overflow-hidden transition-all duration-300 select-none ${
                    disabled
                      ? 'opacity-40 pointer-events-none cursor-not-allowed bg-zinc-900/40 border border-zinc-800/40'
                      : 'group cursor-pointer bg-gradient-to-b from-zinc-900/90 to-zinc-950 border-2 border-amber-500/40 hover:border-amber-400 hover:shadow-[0_0_25px_rgba(245,158,11,0.4)] hover:scale-[1.02] z-10'
                  }`}
                  title={`View all movies & shows with ${person.name}`}
                >
                  {/* Person Role Badge Pill */}
                  <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-black text-[8px] sm:text-[9px] tracking-wider uppercase shadow-lg">
                    <Sparkles className="w-2.5 h-2.5 text-zinc-950" />
                    <span>{person.roleTitle}</span>
                  </div>

                  {/* Profile Indicator Badge */}
                  <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-md text-amber-300 text-[9px] sm:text-[10px] font-bold border border-amber-500/30 shadow z-10">
                    <User className="w-2.5 h-2.5 text-amber-400" />
                    <span className="hidden sm:inline">ARTIST</span>
                  </div>

                  {/* Person Photo Container (Exact same aspect-[2/3] ratio as media posters) */}
                  <div className="relative w-full aspect-[2/3] overflow-hidden bg-zinc-800">
                    {person.profilePath ? (
                      <img
                        src={person.profilePath}
                        alt={person.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-800 text-zinc-500 gap-2">
                        <User className="w-12 h-12 text-zinc-500" />
                        <span className="text-[10px] text-zinc-400 font-medium">No Photo</span>
                      </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/30 to-transparent opacity-85 group-hover:opacity-50 transition-opacity" />

                    {/* Central Hover Explore Icon */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 bg-black/40 backdrop-blur-[1px]">
                      <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.7)] transform group-hover:scale-110 transition-transform">
                        <Film className="w-4 h-4 sm:w-5 sm:h-5 fill-zinc-950 ml-0.5" />
                      </div>
                      <span className="text-[10px] font-black text-amber-300 mt-1.5 uppercase tracking-wider">
                        Explore Works
                      </span>
                    </div>

                    {/* Department Tag at Bottom of Poster */}
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 flex items-center gap-1 z-10">
                      <span className="px-1 sm:px-1.5 py-0.5 rounded bg-black/85 backdrop-blur-md text-[8px] sm:text-[9px] font-bold text-amber-300 border border-amber-500/30">
                        {person.knownForDepartment}
                      </span>
                    </div>
                  </div>

                  {/* Person Card Body Content */}
                  <div className="p-2 sm:p-2.5 md:p-3 flex flex-col justify-between flex-1 gap-1">
                    <div>
                      <h3 className="font-bold text-[11px] sm:text-xs md:text-sm line-clamp-1 leading-tight text-zinc-100 group-hover:text-amber-300 transition-colors">
                        {person.name}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-amber-400/90 truncate mt-0.5">
                        {person.roleTitle}
                      </p>
                    </div>

                    {/* Known Titles & Explore action */}
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 mt-0.5">
                      <span className="truncate text-zinc-400 max-w-[85px] sm:max-w-[100px]">
                        {person.knownForTitles.length > 0 ? person.knownForTitles.slice(0, 2).join(', ') : 'Filmography'}
                      </span>
                      <span className="text-amber-400 font-semibold text-[9px] shrink-0 flex items-center gap-0.5">
                        <Eye className="w-2.5 h-2.5" />
                        View
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}

            {/* 2. MEDIA POSTER CARDS (Movies, TV Shows, Anime) */}
            {displayItems.map((item, index) => {
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
                    <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md bg-amber-400 text-zinc-950 font-black text-[8px] sm:text-[9px] tracking-wider uppercase shadow-md">
                      <Radio className="w-2 sm:w-2.5 h-2 sm:h-2.5 animate-pulse text-zinc-950" />
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
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.6)] transform group-hover:scale-110 transition-transform">
                        <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-zinc-950 ml-0.5" />
                      </div>
                    </div>

                    {/* Rating Badge */}
                    <div className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 flex items-center gap-0.5 sm:gap-1 px-1 sm:px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-amber-300 text-[10px] sm:text-[11px] font-bold border border-white/10 shadow z-10">
                      <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-amber-400 text-amber-400" />
                      <span>{item.rating.toFixed(1)}</span>
                    </div>

                    {/* Era / Release Year Badge */}
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 flex items-center gap-1 z-10">
                      <span className="px-1 sm:px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] sm:text-[10px] font-mono font-bold text-amber-300 border border-amber-500/30">
                        {item.year}
                      </span>
                      <span className="hidden sm:inline px-1.5 py-0.5 rounded bg-black/75 text-[9px] sm:text-[10px] text-zinc-300 font-medium truncate max-w-[60px]">
                        {item.ageRating}
                      </span>
                    </div>
                  </div>

                  {/* Card Body Content */}
                  <div className="p-2 sm:p-2.5 md:p-3 flex flex-col justify-between flex-1 gap-1">
                    <div>
                      <h3 className={`font-bold text-[11px] sm:text-xs md:text-sm line-clamp-1 leading-tight transition-colors ${
                        isSelected ? 'text-amber-300' : 'text-zinc-100 group-hover:text-amber-300'
                      }`}>
                        {item.title}
                      </h3>
                      <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate mt-0.5">
                        {item.directorOrStudio}
                      </p>
                    </div>

                    {/* Tags and Play/Info Action */}
                    <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 mt-0.5">
                      <span className="truncate max-w-[75px] sm:max-w-[90px] text-zinc-400">
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

          {/* Infinite Scroll Anchor & Bottom Status (only for standard catalog pagination, not active person) */}
          {!activePerson && (
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
          )}
        </>
      )}
    </section>
  );
};

