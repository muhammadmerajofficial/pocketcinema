import React, { useState, useEffect } from 'react';
import { 
  ChevronUp, 
  ChevronDown, 
  ChevronLeft, 
  ChevronRight,
  Compass,
  Minus,
  Maximize2
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
}

export const PosterSelectorDpad: React.FC<PosterSelectorDpadProps> = ({
  items,
  selectedIndex,
  onSelectItem,
  onPlayItem,
  disabled = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const currentItem = items[selectedIndex] || items[0];

  // Collapsed Mini-Pill Mode
  if (isCollapsed) {
    return (
      <div 
        id="poster-selector-dock-collapsed"
        className="fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 select-none"
      >
        <button
          type="button"
          onClick={() => {
            soundFx.playClick('switch');
            setIsCollapsed(false);
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-zinc-950/95 backdrop-blur-xl border border-zinc-800/90 hover:border-amber-500/40 text-zinc-100 shadow-2xl shadow-black hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          title="Expand Poster Selector D-Pad"
        >
          <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:text-amber-300">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col items-start text-left">
            <span className="text-[10px] font-mono font-black uppercase text-white flex items-center gap-1">
              D-PAD
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
            <span className="text-[9px] font-mono text-amber-400 font-bold">
              #{selectedIndex + 1}
            </span>
          </div>
          <Maximize2 className="w-3 h-3 text-zinc-400 ml-1 group-hover:text-white" />
        </button>
      </div>
    );
  }

  // Expanded Full Controller Dock: Top Bar matching style, fixed at bottom-left
  return (
    <aside 
      id="poster-selector-dock"
      aria-label="Poster Selector D-Pad Controller"
      className={`fixed bottom-4 left-4 sm:bottom-6 sm:left-6 z-50 flex flex-col gap-2 p-2 sm:p-2.5 bg-zinc-950/95 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-zinc-800/90 shadow-2xl shadow-black transition-all duration-200 select-none ${
        disabled ? 'opacity-40 pointer-events-none' : 'hover:border-amber-500/40'
      }`}
      title={`Poster Selector (#${selectedIndex + 1}: ${currentItem?.title || 'Selected'})`}
    >
      {/* Deck Status Bar Header (Same aesthetic as Top Bar header) */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5">
          <div className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] sm:text-[11px] font-black tracking-wider uppercase text-white font-mono flex items-center gap-1">
              D-PAD
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Item Position Badge */}
          <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 bg-zinc-900/90 border border-zinc-800 px-1.5 py-0.5 rounded-md font-bold">
            #{selectedIndex + 1}
          </span>

          {/* Quick Collapse Button */}
          <button
            type="button"
            onClick={() => {
              soundFx.playClick('switch');
              setIsCollapsed(true);
            }}
            className="p-1 rounded-md hover:bg-zinc-900 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Minimize D-Pad"
          >
            <Minus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 1:1 Aspect Ratio D-Pad Unit */}
      <div 
        id="movie-collection-dpad"
        className="relative aspect-square w-24 h-24 sm:w-28 sm:h-28 bg-gradient-to-b from-zinc-900/95 via-zinc-950/98 to-black/98 border border-zinc-800/90 rounded-xl sm:rounded-2xl p-1 shadow-inner grid grid-cols-3 grid-rows-3 items-center justify-items-center"
      >
        {/* UP BUTTON */}
        <div className="col-start-2 row-start-1 w-full h-full flex items-center justify-center">
          <button
            id="dpad-btn-up"
            type="button"
            disabled={disabled}
            onClick={() => handleNavigate('up')}
            className="w-full h-full flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Navigate Up (Select upper poster row)"
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
            className="w-full h-full flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Navigate Left (Select previous poster)"
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
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 text-zinc-950 font-black text-[10px] sm:text-xs tracking-wider flex items-center justify-center shadow-[0_0_14px_rgba(245,158,11,0.65)] hover:brightness-110 active:scale-90 transition-all cursor-pointer border border-amber-200"
            title={`Play: ${currentItem?.title || 'Selected Media'} (OK)`}
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
            className="w-full h-full flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Navigate Right (Select next poster)"
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
            className="w-full h-full flex items-center justify-center rounded-lg hover:bg-amber-500/20 text-zinc-300 hover:text-amber-400 active:scale-85 active:bg-amber-500/30 transition-all cursor-pointer"
            title="Navigate Down (Select lower poster row)"
          >
            <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Selected Item Subtitle Bar */}
      <div className="px-1 text-center max-w-[104px] sm:max-w-[120px]">
        <p 
          className="text-[9px] sm:text-[10px] font-medium text-zinc-400 truncate"
          title={currentItem?.title || 'Selected Media'}
        >
          {currentItem?.title || 'No Media Selected'}
        </p>
      </div>
    </aside>
  );
};
