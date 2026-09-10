import React, { useEffect } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { MediaItem } from '../types';
import { soundFx } from '../utils/sound';

interface PosterSelectorDpadProps {
  items: MediaItem[];
  selectedIndex: number;
  onSelectItem: (index: number) => void;
  onPlayItem: (item: MediaItem) => void;
  disabled?: boolean;
  category?: string;
  hasBottomBar?: boolean;
}

export const PosterSelectorDpad: React.FC<PosterSelectorDpadProps> = ({
  items,
  selectedIndex,
  onSelectItem,
  onPlayItem,
  disabled = false,
  category,
  hasBottomBar = false,
}) => {
  const getGridCols = () => {
    if (typeof window === 'undefined') return 5;
    const w = window.innerWidth;
    if (w >= 1024) return 5; // lg/xl
    if (w >= 768) return 4;  // md
    if (w >= 640) return 3;  // sm
    return 2;                // mobile
  };

  const scrollToItem = (idx: number) => {
    if (!items || !items[idx]) return;
    setTimeout(() => {
      const el = document.getElementById(`media-card-${items[idx].id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  };

  const handleNavigate = (direction: 'up' | 'down' | 'left' | 'right') => {
    if (disabled || !items || items.length === 0) return;
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
      scrollToItem(nextIdx);
    }
  };

  const handlePlaySelected = () => {
    if (disabled || !items || items.length === 0) return;
    const current = items[selectedIndex] || items[0];
    if (current) {
      soundFx.playClick('ok');
      onPlayItem(current);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
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
  }, [selectedIndex, items, disabled]);

  // If disabled (e.g. media is playing or screen locked), completely hide the D-Pad
  if (disabled) {
    return null;
  }

  const currentItem = items[selectedIndex] || items[0];
  const isSeries = category === 'tv' || category === 'anime' || (currentItem && (currentItem.category === 'tv' || currentItem.category === 'anime'));

  return (
    <div 
      id="poster-selector-dpad-only"
      aria-label="D-Pad Controller"
      className={`fixed left-4 sm:left-6 z-50 select-none touch-manipulation transition-all animate-fadeIn ${
        hasBottomBar 
          ? (isSeries ? 'bottom-26 sm:bottom-28' : 'bottom-18 sm:bottom-20') 
          : 'bottom-4 sm:bottom-6'
      }`}
    >
      {/* 3x3 D-Pad Unit: ONLY Left, Right, Up, Down and Center OK */}
      <div 
        id="movie-collection-dpad"
        className="w-24 h-24 sm:w-28 sm:h-28 aspect-square rounded-full bg-zinc-950/85 backdrop-blur-xl border border-amber-500/30 p-1 shadow-[0_8px_30px_rgba(0,0,0,0.8)] grid grid-cols-3 grid-rows-3 items-center justify-items-center"
      >
        {/* UP BUTTON */}
        <div className="col-start-2 row-start-1 w-full h-full flex items-center justify-center">
          <button
            id="dpad-btn-up"
            type="button"
            disabled={disabled}
            onClick={() => handleNavigate('up')}
            className="w-full h-full flex items-center justify-center rounded-full hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Up"
          >
            <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* LEFT BUTTON */}
        <div className="col-start-1 row-start-2 w-full h-full flex items-center justify-center">
          <button
            id="dpad-btn-left"
            type="button"
            disabled={disabled}
            onClick={() => handleNavigate('left')}
            className="w-full h-full flex items-center justify-center rounded-full hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Left"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* CENTER OK BUTTON */}
        <div className="col-start-2 row-start-2 w-full h-full flex items-center justify-center">
          <button
            id="dpad-btn-ok"
            type="button"
            disabled={disabled}
            onClick={handlePlaySelected}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-zinc-950 font-black text-[10px] sm:text-xs tracking-wider flex items-center justify-center shadow-[0_0_12px_rgba(245,158,11,0.6)] hover:brightness-110 active:scale-85 transition-all cursor-pointer border border-amber-200"
            title={`Play: ${currentItem?.title || 'Selected'} (OK)`}
          >
            OK
          </button>
        </div>

        {/* RIGHT BUTTON */}
        <div className="col-start-3 row-start-2 w-full h-full flex items-center justify-center">
          <button
            id="dpad-btn-right"
            type="button"
            disabled={disabled}
            onClick={() => handleNavigate('right')}
            className="w-full h-full flex items-center justify-center rounded-full hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Right"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        </div>

        {/* DOWN BUTTON */}
        <div className="col-start-2 row-start-3 w-full h-full flex items-center justify-center">
          <button
            id="dpad-btn-down"
            type="button"
            disabled={disabled}
            onClick={() => handleNavigate('down')}
            className="w-full h-full flex items-center justify-center rounded-full hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Down"
          >
            <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>
    </div>
  );
};
