import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Tv2, 
  Bookmark, 
  User as UserIcon,
  ArrowUp,
  Radio,
  Eye,
  EyeOff,
  X,
  Camera,
  ExternalLink,
  KeyRound
} from 'lucide-react';
import { CategoryType, MediaItem } from './types';
import { loadCategoryMedia } from './services/api';
import { RemoteTopNav } from './components/RemoteTopNav';
import { RemoteSearchBar } from './components/RemoteSearchBar';
import { RemoteControlBar } from './components/RemoteControlBar';
import { TimelineView } from './components/TimelineView';
import { MediaDetailModal } from './components/MediaDetailModal';
import { MainPageControlBar } from './components/MainPageControlBar';
import { AuthModal } from './components/AuthModal';
import { QRScannerModal } from './components/QRScannerModal';
import { LiveDisplayScreen } from './components/LiveDisplayScreen';
import { DevicePairingModal } from './components/DevicePairingModal';
import { auth, onAuthStateChanged, type User } from './lib/firebase';
import { soundFx } from './utils/sound';
import { syncManager } from './utils/syncChannel';
import { getOrCreateUserSession, updateRemoteSession, disconnectRemoteSession } from './services/remotePairing';

export default function App() {
  // Check if opened in dedicated Live Display mode (?view=display, ?view=screen, ?view=remote, ?view=iframe)
  const isDisplayView = typeof window !== 'undefined' && (
    new URLSearchParams(window.location.search).get('view') === 'display' ||
    new URLSearchParams(window.location.search).get('view') === 'screen' ||
    new URLSearchParams(window.location.search).get('view') === 'remote' ||
    new URLSearchParams(window.location.search).get('view') === 'iframe'
  );

  const [activeCategory, setActiveCategory] = useState<CategoryType>('movies');
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeModalItem, setActiveModalItem] = useState<MediaItem | null>(null);
  const [playingMedia, setPlayingMedia] = useState<MediaItem | null>(null);
  const [isPlayerHidden, setIsPlayerHidden] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastRemoteAction, setLastRemoteAction] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [pairingCode, setPairingCode] = useState<string>(() => {
    try {
      return localStorage.getItem('cinematic_remote_pairing_code') || '';
    } catch {
      return '';
    }
  });
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);

  // Live Player Server & Episode state for remote synchronization
  const [playerServerIndex, setPlayerServerIndex] = useState(0);
  const [playerSeason, setPlayerSeason] = useState(1);
  const [playerEpisode, setPlayerEpisode] = useState(1);
  const [playerRemoteAction, setPlayerRemoteAction] = useState<{ action: 'play' | 'preview' | 'next'; timestamp: number } | null>(null);

  // Sync pairing code with localStorage
  useEffect(() => {
    if (pairingCode) {
      try {
        localStorage.setItem('cinematic_remote_pairing_code', pairingCode);
      } catch (_) {}
    }
  }, [pairingCode]);

  // Listen to Firebase Auth state & retrieve/create pairing code stored with Gmail
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        getOrCreateUserSession(user)
          .then((code) => {
            setPairingCode(code);
            try {
              localStorage.setItem('cinematic_remote_pairing_code', code);
            } catch (_) {}
          })
          .catch((err) => console.warn('[RemotePairing] Code init warning:', err));
      }
    });
    return () => unsubscribe();
  }, []);

  // 1. Synchronize currently selected item with Live Display Screen (BroadcastChannel + Firebase)
  useEffect(() => {
    if (mediaItems.length > 0 && mediaItems[selectedIndex]) {
      const item = mediaItems[selectedIndex];
      syncManager.saveState({
        currentItem: item,
        selectedIndex,
        activeCategory,
        searchQuery,
      });
      syncManager.broadcast({
        type: 'SELECT_ITEM',
        item,
        category: activeCategory,
        index: selectedIndex,
      });

      if (pairingCode) {
        updateRemoteSession(pairingCode, {
          currentItem: item,
          selectedIndex,
          activeCategory,
          searchQuery,
        });
      }
    }
  }, [selectedIndex, mediaItems, activeCategory, searchQuery, pairingCode]);

  // 2. Synchronize playing media and player config with Live Display Screen (BroadcastChannel + Firebase)
  useEffect(() => {
    if (playingMedia) {
      syncManager.saveState({ 
        playingItem: playingMedia,
        serverIndex: playerServerIndex,
        season: playerSeason,
        episode: playerEpisode,
      });
      syncManager.broadcast({ 
        type: 'PLAY', 
        item: playingMedia,
        serverIndex: playerServerIndex,
        season: playerSeason,
        episode: playerEpisode,
      });

      if (pairingCode) {
        updateRemoteSession(pairingCode, {
          playingItem: playingMedia,
          serverIndex: playerServerIndex,
          season: playerSeason,
          episode: playerEpisode,
        });
      }
    } else {
      syncManager.saveState({ playingItem: null });
      syncManager.broadcast({ type: 'CLOSE_PLAYER' });

      if (pairingCode) {
        updateRemoteSession(pairingCode, {
          playingItem: null,
        });
      }
    }
  }, [playingMedia, playerServerIndex, playerSeason, playerEpisode, pairingCode]);

  // 3. Respond to state requests from newly opened Display Screen tabs
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg) => {
      if (msg.type === 'REQUEST_STATE') {
        const item = mediaItems[selectedIndex] || null;
        syncManager.saveState({
          currentItem: item,
          playingItem: playingMedia,
          serverIndex: playerServerIndex,
          season: playerSeason,
          episode: playerEpisode,
          activeCategory,
          searchQuery,
          selectedIndex,
        });
      } else if (msg.type === 'PLAYER_COMMAND') {
        if (pairingCode) {
          updateRemoteSession(pairingCode, {
            playerCommand: {
              command: msg.command,
              value: msg.value,
              timestamp: msg.timestamp,
            },
          });
        }
      }
    });
    return () => unsubscribe();
  }, [mediaItems, selectedIndex, playingMedia, playerServerIndex, playerSeason, playerEpisode, activeCategory, searchQuery]);
  
  // Category item count cache
  const [counts, setCounts] = useState<Record<CategoryType, number>>({
    movies: 20,
    tv: 20,
    anime: 25,
  });

  const [bookmarks, setBookmarks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('cinematic_remote_bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch initial media (Page 1) when Category or Search Query Changes
  const fetchInitialMedia = useCallback(async (cat: CategoryType, query: string) => {
    setIsLoading(true);
    setPage(1);
    isFetchingRef.current = true;
    try {
      const result = await loadCategoryMedia(cat, query, 1);
      setMediaItems(result.items);
      setHasMore(result.hasMore);
      setSelectedIndex(0);

      // Update count for current category if no search query
      if (!query.trim()) {
        setCounts((prev) => ({
          ...prev,
          [cat]: result.items.length,
        }));
      }
    } catch (err) {
      console.error('[API Fetch Error]:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Infinite Scroll: Fetch next page when user scrolls near the bottom
  const loadNextPage = useCallback(async () => {
    if (isFetchingRef.current || !hasMore || isLoading || isLoadingMore) return;

    isFetchingRef.current = true;
    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const result = await loadCategoryMedia(activeCategory, searchQuery, nextPage);
      
      setMediaItems((prev) => {
        const existingIds = new Set(prev.map((i) => i.id));
        const newItems = result.items.filter((i) => !existingIds.has(i.id));
        return [...prev, ...newItems];
      });

      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (err) {
      console.error('[Infinite Scroll Error]:', err);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [activeCategory, searchQuery, page, hasMore, isLoading, isLoadingMore]);

  // IntersectionObserver callback for infinite scrolling anchor
  const loadMoreAnchorRef = useCallback((node: HTMLElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
    if (!node) return;

    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadNextPage();
      }
    }, {
      rootMargin: '500px', // Fetch well before hitting the exact bottom
      threshold: 0.1,
    });

    observerRef.current.observe(node);
  }, [loadNextPage]);

  // Debounced initial fetch trigger on category or search changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const delay = searchQuery ? 350 : 0;
    debounceTimerRef.current = setTimeout(() => {
      fetchInitialMedia(activeCategory, searchQuery);
    }, delay);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [activeCategory, searchQuery, fetchInitialMedia]);

  // Watch window scroll for "Scroll to Top" button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 280) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    soundFx.playClick('nav');
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Toggle bookmark in local state and localStorage
  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const updated = prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id];
      try {
        localStorage.setItem('cinematic_remote_bookmarks', JSON.stringify(updated));
      } catch {
        // Storage unavailable
      }
      return updated;
    });
  };

  // Toggle remote audio clicks
  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundFx.enabled = next;
    if (next) soundFx.playClick('switch');
  };

  // Remote button press handler (Up/Down skips row, Prev/Next moves single item, Close exits player, Toggle Hide)
  const handleRemotePress = useCallback((action: 'up' | 'down' | 'prev' | 'next' | 'ok' | 'close' | 'toggle_hide') => {
    if (isScreenLocked) {
      return;
    }

    setLastRemoteAction(action);
    setTimeout(() => setLastRemoteAction(null), 250);

    if (action === 'toggle_hide') {
      if (playingMedia) {
        setIsPlayerHidden((prev) => !prev);
      }
      return;
    }

    if (action === 'close') {
      setPlayingMedia(null);
      setIsPlayerHidden(false);
      setIsScreenLocked(false);
      setActiveModalItem(null);
      return;
    }

    // When player is active on screen, OK acts as simulated mouse click, Prev as Rewind/Prev Ep, Next as Forward/Next Ep
    if (playingMedia && !isPlayerHidden) {
      if (action === 'ok') {
        const actionData = { action: 'play' as const, timestamp: Date.now() };
        setPlayerRemoteAction(actionData);
        syncManager.broadcast({ type: 'PLAYER_ACTION', action: 'play', timestamp: actionData.timestamp });
        if (pairingCode) {
          updateRemoteSession(pairingCode, { playerAction: actionData });
        }
        return;
      }
      if (action === 'prev') {
        const actionData = { action: 'preview' as const, timestamp: Date.now() };
        setPlayerRemoteAction(actionData);
        syncManager.broadcast({ type: 'PLAYER_ACTION', action: 'preview', timestamp: actionData.timestamp });
        if (pairingCode) {
          updateRemoteSession(pairingCode, { playerAction: actionData });
        }
        return;
      }
      if (action === 'next') {
        const actionData = { action: 'next' as const, timestamp: Date.now() };
        setPlayerRemoteAction(actionData);
        syncManager.broadcast({ type: 'PLAYER_ACTION', action: 'next', timestamp: actionData.timestamp });
        if (pairingCode) {
          updateRemoteSession(pairingCode, { playerAction: actionData });
        }
        return;
      }
    }

    if (mediaItems.length === 0) return;

    const cols = window.innerWidth >= 1024 ? 5 : window.innerWidth >= 768 ? 4 : window.innerWidth >= 640 ? 3 : 2;

    if (action === 'up') {
      setSelectedIndex((prev) => {
        const next = prev >= cols ? prev - cols : Math.max(0, prev - 1);
        return next;
      });
    } else if (action === 'down') {
      setSelectedIndex((prev) => {
        const next = prev + cols;
        if (next >= mediaItems.length - 5 && hasMore) {
          loadNextPage();
        }
        const target = next < mediaItems.length ? next : Math.min(mediaItems.length - 1, prev + 1);
        return target;
      });
    } else if (action === 'prev') {
      setSelectedIndex((prev) => {
        const next = Math.max(0, prev - 1);
        return next;
      });
    } else if (action === 'next') {
      setSelectedIndex((prev) => {
        const next = prev + 1;
        if (next >= mediaItems.length - 3 && hasMore) {
          loadNextPage();
        }
        const target = Math.min(mediaItems.length - 1, next);
        return target;
      });
    } else if (action === 'ok') {
      const item = mediaItems[selectedIndex];
      if (item) {
        setPlayingMedia(item);
        setIsPlayerHidden(false);
        setPlayerSeason(1);
        setPlayerEpisode(1);
      }
    }
  }, [mediaItems, selectedIndex, hasMore, loadNextPage, playingMedia, isScreenLocked]);

  // Physical Keyboard Navigation for TV/Remote feel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If screen is locked, block all keys except 'L' to toggle unlock
      if (isScreenLocked) {
        if (e.key === 'l' || e.key === 'L') {
          e.preventDefault();
          setIsScreenLocked(false);
          soundFx.playClick('ok');
        } else {
          e.preventDefault();
        }
        return;
      }

      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      if (e.key === 'l' || e.key === 'L') {
        if (playingMedia) {
          e.preventDefault();
          setIsScreenLocked(true);
          soundFx.playClick('switch');
          return;
        }
      }

      if (e.key === 'Escape') {
        if (playingMedia) {
          e.preventDefault();
          setPlayingMedia(null);
          setIsPlayerHidden(false);
          setIsScreenLocked(false);
          return;
        }
        if (activeModalItem) {
          e.preventDefault();
          setActiveModalItem(null);
          return;
        }
      }

      if (e.key === 'h' || e.key === 'H') {
        if (playingMedia) {
          e.preventDefault();
          setIsPlayerHidden((prev) => !prev);
          soundFx.playClick('switch');
          return;
        }
      }

      // If media is open/playing, block all navigation keys (arrows, enter, numbers) so movie never changes
      if (playingMedia) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' ', '1', '2', '3'].includes(e.key)) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleRemotePress('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleRemotePress('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleRemotePress('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleRemotePress('next');
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleRemotePress('ok');
      } else if (e.key === '1') {
        setActiveCategory('movies');
        setPlayingMedia(null);
        setIsPlayerHidden(false);
        soundFx.playClick('switch');
      } else if (e.key === '2') {
        setActiveCategory('tv');
        setPlayingMedia(null);
        setIsPlayerHidden(false);
        soundFx.playClick('switch');
      } else if (e.key === '3') {
        setActiveCategory('anime');
        setPlayingMedia(null);
        setIsPlayerHidden(false);
        soundFx.playClick('switch');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleRemotePress, playingMedia, activeModalItem]);

  const currentItem = mediaItems[selectedIndex];

  const handleDisconnectRemote = async () => {
    soundFx.playClick('switch');
    if (pairingCode) {
      await disconnectRemoteSession(pairingCode);
      syncManager.broadcast({ type: 'DISCONNECT', timestamp: Date.now() });
      syncManager.saveState({ playingItem: null });
      setPlayingMedia(null);
    }
  };

  // If opened in dedicated Live Display Screen mode, render the Live Display
  if (isDisplayView) {
    return <LiveDisplayScreen />;
  }

  return (
    <div className="min-h-screen w-full bg-[#08090d] text-zinc-100 font-sans antialiased selection:bg-amber-500 selection:text-black">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-amber-500/10 blur-[140px] rounded-full" />
        <div className="absolute top-1/2 -left-32 w-[500px] h-[500px] bg-orange-600/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-0 right-0 w-[600px] h-[500px] bg-red-900/5 blur-[160px] rounded-full" />
      </div>

      {/* Full Page Content Container: No extra side space on wide screens, edge-to-edge balanced */}
      <div className="relative z-10 w-full max-w-[1500px] mx-auto px-2 sm:px-4 md:px-6 py-3 sm:py-5 flex flex-col gap-4">
        
        {/* Remote Controller Deck Header Container */}
        <header id="main-remote-deck" className="flex flex-col gap-2.5 sm:gap-3 p-2.5 sm:p-4 bg-zinc-950/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-zinc-800/90 shadow-2xl shadow-black">
          
          {/* Deck Status Bar (Top mini row) */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1 sm:p-1.5 rounded-lg sm:rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Tv2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] sm:text-xs font-black tracking-wider uppercase text-white font-mono flex items-center gap-1.5">
                    CINEMA REMOTE
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-500 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 text-amber-500/80" />
                    Live: TMDB v3 API
                  </span>
                </div>
              </div>

              {/* TV Pairing Code Button */}
              <button
                id="top-tv-pairing-code-btn"
                type="button"
                onClick={() => {
                  soundFx.playClick('switch');
                  setIsPairingModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-amber-500/40 font-mono font-bold text-xs sm:text-sm tracking-wider cursor-pointer shadow-md transition-all hover:scale-105 active:scale-95"
                title="View TV Pairing Code (Firebase Sync with your Gmail)"
              >
                <KeyRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                {pairingCode ? (
                  <span className="flex items-center gap-1">
                    <span className="hidden sm:inline text-zinc-400 font-sans text-xs">Code:</span>
                    <span className="text-white font-black tracking-widest">{pairingCode}</span>
                  </span>
                ) : (
                  <span>Pair TV</span>
                )}
              </button>

              {/* Top Remote Display Button: Opens Live Display Screen in New Tab */}
              <a
                id="top-remote-display-btn"
                href={pairingCode ? `?view=display&code=${pairingCode}` : '?view=display'}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => soundFx.playClick('switch')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:brightness-110 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:scale-105 active:scale-95 transition-all cursor-pointer border border-amber-300/60"
                title="Open Live Display Screen in New Tab (Controlled live by this remote)"
              >
                <Tv2 className="w-4 h-4 stroke-[2.5]" />
                <span>Remote Display</span>
                <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
              </a>
            </div>

            {/* Utility Toggles: Audio click, reset, bookmarks */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {bookmarks.length > 0 && (
                <div 
                  className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] sm:text-xs font-semibold"
                  title="Saved in Watchlist"
                >
                  <Bookmark className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-amber-400" />
                  <span>{bookmarks.length}</span>
                </div>
              )}

              {/* QR Code Scanner Camera Button (Directly to the Left of Profile) */}
              <button
                id="camera-qr-scanner-btn"
                type="button"
                disabled={isScreenLocked}
                onClick={() => {
                  if (isScreenLocked) return;
                  soundFx.playClick('switch');
                  setIsQRScannerOpen(true);
                }}
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center ${
                  isScreenLocked 
                    ? 'opacity-30 cursor-not-allowed bg-zinc-900 text-zinc-600 border-zinc-800 pointer-events-none'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border-zinc-800 hover:border-amber-500/40 cursor-pointer shadow-sm'
                }`}
                title="Scan QR Code (Camera & Image Upload)"
              >
                <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              </button>

              {/* Login / Register User Button (Replaces Reset selection) */}
              <button
                id="user-auth-btn"
                type="button"
                disabled={isScreenLocked}
                onClick={() => {
                  if (isScreenLocked) return;
                  soundFx.playClick('switch');
                  setIsAuthModalOpen(true);
                }}
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-all flex items-center justify-center ${
                  isScreenLocked 
                    ? 'opacity-30 cursor-not-allowed bg-zinc-900 text-zinc-600 border-zinc-800 pointer-events-none'
                    : currentUser 
                      ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40 cursor-pointer shadow-md'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800 cursor-pointer'
                }`}
                title={currentUser ? `Profile: ${currentUser.displayName || currentUser.email}` : "Login / Register (Account)"}
              >
                {currentUser?.photoURL ? (
                  <img 
                    src={currentUser.photoURL} 
                    alt="Profile" 
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full object-cover" 
                  />
                ) : (
                  <UserIcon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${currentUser ? 'text-amber-400' : 'text-zinc-400'}`} />
                )}
              </button>

              <button
                id="toggle-sound-btn"
                type="button"
                disabled={isScreenLocked}
                onClick={toggleSound}
                className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-colors ${
                  isScreenLocked 
                    ? 'opacity-30 cursor-not-allowed bg-zinc-900 text-zinc-600 border-zinc-800 pointer-events-none'
                    : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border-zinc-800 cursor-pointer'
                }`}
                title={soundEnabled ? 'Mute remote click sound' : 'Enable remote sound feedback'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </button>
            </div>
          </div>

          {/* 1. TOP: Movie, TV Show, Anime 3 Buttons strictly in ONE Line */}
          <div className={isScreenLocked ? 'opacity-40 pointer-events-none' : ''}>
            <RemoteTopNav
              activeCategory={activeCategory}
              onSelectCategory={(cat) => {
                if (isScreenLocked) return;
                setActiveCategory(cat);
                setSearchQuery('');
                setPlayingMedia(null);
                setPlayerSeason(1);
                setPlayerEpisode(1);
              }}
              counts={counts}
            />
          </div>

          {/* 2. NICHE: Long Searchbar with Voice Control Icon */}
          <div className={isScreenLocked ? 'opacity-30 pointer-events-none' : ''}>
            <RemoteSearchBar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeCategory={activeCategory}
            />
          </div>
        </header>

        {/* 4. Chronological Content Grid (Clean Main Page; Single controller appears at bottom ONLY when a movie is playing) */}
        <main id="main-timeline-content" className={`w-full mt-1 ${playingMedia ? 'pb-36' : 'pb-16'}`}>
          <TimelineView
            category={activeCategory}
            items={mediaItems}
            selectedIndex={selectedIndex}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            onSelectItem={(idx) => {
              if (isScreenLocked) return;
              setSelectedIndex(idx);
            }}
            onOpenDetails={(item) => {
              if (isScreenLocked) return;
              setActiveModalItem(item);
            }}
            onPlayItem={(item) => {
              if (isScreenLocked) return;
              soundFx.playClick('ok');
              setPlayingMedia(item);
              setPlayerSeason(1);
              setPlayerEpisode(1);
              // Instant real-time Firebase & Broadcast dispatch
              syncManager.saveState({
                playingItem: item,
                serverIndex: playerServerIndex,
                season: 1,
                episode: 1,
              });
              syncManager.broadcast({
                type: 'PLAY',
                item,
                serverIndex: playerServerIndex,
                season: 1,
                episode: 1,
              });
              if (pairingCode) {
                const now = Date.now();
                updateRemoteSession(pairingCode, {
                  playingItem: item,
                  serverIndex: playerServerIndex,
                  season: 1,
                  episode: 1,
                  playerCommand: { command: 'play', timestamp: now },
                  playerStatus: {
                    isPlaying: true,
                    currentTime: 0,
                    duration: 0,
                    volume: 100,
                    isMuted: false,
                    timestamp: now,
                  },
                });
              }
            }}
            loadMoreRef={loadMoreAnchorRef}
          />
        </main>

        {/* 5. FLOATING MASTER CONTROL DECK: Real-time Firebase & Broadcast sync to Remote Screen */}
        {playingMedia && (
          <MainPageControlBar
            playingMedia={playingMedia}
            pairingCode={pairingCode}
            userEmail={currentUser?.email || undefined}
            serverIndex={playerServerIndex}
            season={playerSeason}
            episode={playerEpisode}
            onServerChange={(idx) => setPlayerServerIndex(idx)}
            onSeasonChange={(s) => setPlayerSeason(s)}
            onEpisodeChange={(e) => setPlayerEpisode(e)}
            onStop={() => {
              soundFx.playClick('switch');
              setPlayingMedia(null);
            }}
            onDisconnectRemote={handleDisconnectRemote}
          />
        )}

      </div>

      {/* Floating Scroll to Top Button (Top icon to jump to top with 1 click) */}
      <button
        id="scroll-to-top-btn"
        type="button"
        onClick={scrollToTop}
        className={`fixed bottom-6 right-6 z-50 p-3 sm:p-3.5 rounded-2xl bg-amber-500 text-black shadow-[0_0_25px_rgba(245,158,11,0.6)] hover:bg-amber-400 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer flex items-center justify-center gap-1.5 font-bold text-xs ${
          showScrollTop ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
        title="Scroll to top"
        aria-label="Back to top"
      >
        <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        <span className="hidden sm:inline uppercase tracking-wider text-[10px]">Top</span>
      </button>

      {/* Cinematic Detail Modal when info or card is opened */}
      <MediaDetailModal
        item={activeModalItem}
        onClose={() => setActiveModalItem(null)}
        isBookmarked={activeModalItem ? bookmarks.includes(activeModalItem.id) : false}
        onToggleBookmark={toggleBookmark}
        onPlay={(item) => {
          soundFx.playClick('ok');
          setPlayingMedia(item);
          setIsPlayerHidden(false);
          setPlayerSeason(1);
          setPlayerEpisode(1);
          // Instant real-time Firebase & Broadcast dispatch
          syncManager.saveState({
            playingItem: item,
            serverIndex: playerServerIndex,
            season: 1,
            episode: 1,
          });
          syncManager.broadcast({
            type: 'PLAY',
            item,
            serverIndex: playerServerIndex,
            season: 1,
            episode: 1,
          });
          if (pairingCode) {
            const now = Date.now();
            updateRemoteSession(pairingCode, {
              playingItem: item,
              serverIndex: playerServerIndex,
              season: 1,
              episode: 1,
              playerCommand: { command: 'play', timestamp: now },
              playerStatus: {
                isPlaying: true,
                currentTime: 0,
                duration: 0,
                volume: 100,
                isMuted: false,
                timestamp: now,
              },
            });
          }
        }}
      />

      {/* Firebase Authentication & User Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        pairingCode={pairingCode}
        onOpenPairingModal={() => setIsPairingModalOpen(true)}
        onDisconnectRemote={handleDisconnectRemote}
      />

      {/* Full-Screen Camera & Image QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onSearchQuery={(query) => {
          setSearchQuery(query);
          soundFx.playClick('switch');
        }}
      />

      {/* Device Pairing / TV Connect Code Modal (Firebase Sync with User Gmail) */}
      <DevicePairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        pairingCode={pairingCode}
        userEmail={currentUser?.email || ''}
        onSetActiveCode={(code) => {
          setPairingCode(code);
        }}
        onRegenerateCode={async () => {
          if (currentUser) {
            const newCode = await getOrCreateUserSession(currentUser);
            setPairingCode(newCode);
          }
        }}
        onOpenLoginModal={() => setIsAuthModalOpen(true)}
        onDisconnectRemote={handleDisconnectRemote}
      />
    </div>
  );
}
