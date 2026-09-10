import React from 'react';
import { Film, Tv, Flame } from 'lucide-react';
import { CategoryType } from '../types';
import { soundFx } from '../utils/sound';

interface RemoteTopNavProps {
  activeCategory: CategoryType;
  onSelectCategory: (category: CategoryType) => void;
  counts: Record<CategoryType, number>;
  disabled?: boolean;
}

export const RemoteTopNav: React.FC<RemoteTopNavProps> = ({
  activeCategory,
  onSelectCategory,
  counts,
  disabled = false,
}) => {
  const categories: { id: CategoryType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'movies', label: 'Movie', icon: Film },
    { id: 'tv', label: 'TV Show', icon: Tv },
    { id: 'anime', label: 'Anime', icon: Flame },
  ];

  return (
    <div 
      id="remote-top-nav" 
      className={`w-full flex items-center justify-between gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-zinc-900/95 backdrop-blur-md rounded-xl sm:rounded-2xl border border-zinc-800/80 shadow-2xl shadow-black/60 transition-opacity duration-300 ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      }`}
    >
      {categories.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            id={`tab-btn-${cat.id}`}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (disabled) return;
              soundFx.playClick('switch');
              onSelectCategory(cat.id);
            }}
            className={`relative flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1.5 sm:px-3 rounded-lg sm:rounded-xl font-medium transition-all duration-300 select-none ${
              disabled ? 'cursor-not-allowed pointer-events-none' : 'cursor-pointer'
            } focus:outline-none focus:ring-1 sm:focus:ring-2 focus:ring-amber-500/50 ${
              isActive
                ? 'bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-red-500/10 text-amber-300 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform duration-300 ${isActive ? 'scale-110 text-amber-400' : 'text-zinc-400'}`} />
            <span className="text-xs sm:text-sm tracking-tight sm:tracking-wide truncate whitespace-nowrap font-medium">{cat.label}</span>
            <span
              className={`text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.2 sm:py-0.5 rounded-full font-mono transition-colors shrink-0 ${
                isActive
                  ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                  : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {counts[cat.id]}
            </span>

            {isActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 sm:w-8 h-0.5 sm:h-1 bg-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]" />
            )}
          </button>
        );
      })}
    </div>
  );
};
