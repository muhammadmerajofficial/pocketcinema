import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Volume2, 
  VolumeX, 
  Tv2, 
  Bookmark, 
  ArrowUp,
  Radio,
  Eye,
  EyeOff,
  X,
  Camera,
  ExternalLink,
  Sparkles,
  Layers,
  Loader2,
  ArrowRight,
  Unplug,
  RefreshCw,
  QrCode
} from 'lucide-react';
import { CategoryType, MediaItem } from './types';
import { MEDIA_COLLECTION } from './data/mediaData';
import { loadCategoryMedia } from './services/api';
import { RemoteTopNav } from './components/RemoteTopNav';
import { RemoteSearchBar } from './components/RemoteSearchBar';
import { RemoteControlBar } from './components/RemoteControlBar';
import { TimelineView } from './components/TimelineView';
import { PosterSelectorDpad } from './components/PosterSelectorDpad';
import { MediaDetailModal } from './components/MediaDetailModal';
import { MainPageControlBar } from './components/MainPageControlBar';
import { ConnectedRemotePanel } from './components/ConnectedRemotePanel';
import { QRScannerModal } from './components/QRScannerModal';
import { LiveDisplayScreen } from './components/LiveDisplayScreen';
import { soundFx } from './utils/sound';
import { syncManager, SyncMessage } from './utils/syncChannel';
import { 
  connectToRoom, 
  updateRoom, 
  listenToRoom, 
  closeRoom, 
  RoomData, 
  generate4DigitRoomCode 
} from './services/remotePairing';

export default function App() {
  // Check if opened in dedicated Live Display mode (/tv, ?view=tv, ?view=display, ?view=screen, ?view=player, #/tv, etc.)
  const isDisplayView = typeof window !== 'undefined' && (
    window.location.pathname.toLowerCase() === '/tv' ||
    window.location.pathname.toLowerCase() === '/tv/' ||
    window.location.pathname.toLowerCase().endsWith('/tv') ||
    window.location.pathname.toLowerCase().endsWith('/tv/') ||
    new URLSearchParams(window.location.search).get('view') === 'tv' ||
    new URLSearchParams(window.location.search).get('view') === 'display' ||
    new URLSearchParams(window.location.search).get('view') === 'screen' ||
    new URLSearchParams(window.location.search).get('view') === 'player' ||
    window.location.pathname.endsWith('/player') ||
    window.location.hash.toLowerCase().includes('tv') ||
    window.location.hash.toLowerCase().includes('display') ||
    window.location.hash.toLowerCase().includes('screen')
  );

  // Dynamic TV screen URL that opens fresh TV Display view
  const tvDisplayUrl = typeof window !== 'undefined'
    ? (() => {
        try {
          const u = new URL(window.location.href);
          u.searchParams.set('view', 'tv');
          u.searchParams.delete('room');
          u.searchParams.delete('code');
          const currentMedia = playingMedia || (mediaItems.length > 0 ? mediaItems[selectedIndex] : null);
          if (currentMedia) {
            u.searchParams.set('mediaId', String(currentMedia.id));
            u.searchParams.set('category', currentMedia.category);
          }
          u.hash = '';
          return u.toString();
        } catch {
          return '?view=tv';
        }
      })()
    : '?view=tv';

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
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [lastRemoteAction, setLastRemoteAction] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // 4-digit Room Code pairing state (empty by default until connected)
  const [pairingCode, setPairingCode] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = urlParams.get('room') || urlParams.get('code');
      if (fromUrl && fromUrl.trim().length === 4) {
        return fromUrl.trim();
      }
      return '';
    } catch {
      return '';
    }
  });

  const [isRemotePlaying, setIsRemotePlaying] = useState<boolean>(false);
  const [remoteVolume, setRemoteVolume] = useState<number>(100);
  const [mainPageCodeInput, setMainPageCodeInput] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const fromUrl = urlParams.get('room') || urlParams.get('code');
      if (fromUrl && fromUrl.trim().length === 4) {
        return fromUrl.trim();
      }
      return '';
    } catch {
      return '';
    }
  });
  const [isConnectingMainPage, setIsConnectingMainPage] = useState<boolean>(false);
  const [mainPageConnectFeedback, setMainPageConnectFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  // Live Player Server & Episode state for remote synchronization
  const [playerServerIndex, setPlayerServerIndex] = useState(0);
  const [playerSeason, setPlayerSeason] = useState(1);
  const [playerEpisode, setPlayerEpisode] = useState(1);

  // Synchronized refs to avoid re-triggering effects on state updates
  const pairingCodeRef = useRef(pairingCode);
  pairingCodeRef.current = pairingCode;

  const playingMediaRef = useRef(playingMedia);
  playingMediaRef.current = playingMedia;

  const playerServerIndexRef = useRef(playerServerIndex);
  playerServerIndexRef.current = playerServerIndex;

  const autoPlayCategoryChangeRef = useRef(false);

  // Sync mainPageCodeInput whenever pairingCode changes
  useEffect(() => {
    if (pairingCode) {
      setMainPageCodeInput(pairingCode);
    }
  }, [pairingCode]);

  // Auto-connect if URL has ?room=XXXX or ?code=XXXX on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room') || urlParams.get('code');
    if (roomParam && roomParam.trim().length === 4) {
      const clean = roomParam.trim();
      connectToRoom(clean).then((res) => {
        if (res.success && res.data) {
          setPairingCode(clean);
          setMainPageConnectFeedback({
            success: true,
            msg: `Connected to TV Room #${clean}!`
          });

          // If TV already has a movie playing in the background, adopt it so it continues uninterrupted!
          if (res.data.playingItem) {
            setPlayingMedia(res.data.playingItem);
            setIsRemotePlaying(true);
            setRemoteVolume(100);
            updateRoom(clean, {
              status: 'connected',
              action: 'play',
              isPlaying: true,
              volume: 100,
              lastCommandTimestamp: Date.now(),
            });
          } else {
            // Auto play default selected movie with 100% volume if TV had no item
            const defaultItem = (mediaItems && mediaItems.length > 0 ? mediaItems[selectedIndex] : null) || MEDIA_COLLECTION[0];
            if (defaultItem) {
              handlePlayMedia(defaultItem, 1, 1);
              setRemoteVolume(100);
              updateRoom(clean, {
                status: 'connected',
                playingItem: defaultItem,
                isPlaying: true,
                action: 'play',
                volume: 100,
                currentTime: 0,
                serverIndex: 0,
                season: 1,
                episode: 1,
                lastCommandTimestamp: Date.now(),
              });
            }
          }
        }
      });
    }
  }, []);

  // Sync active room code to localStorage
  useEffect(() => {
    if (pairingCode) {
      try {
        localStorage.setItem('cinematic_remote_room_code', pairingCode);
      } catch (_) {}
    } else {
      try {
        localStorage.removeItem('cinematic_remote_room_code');
      } catch (_) {}
    }
  }, [pairingCode]);

  // Real-time listener for the connected TV Room
  useEffect(() => {
    if (!pairingCode || pairingCode.length !== 4) return;

    const unsubscribe = listenToRoom(pairingCode, (data: RoomData | null) => {
      if (!data) return;

      if (data.status === 'closed') {
        setPairingCode('');
        setMainPageCodeInput('');
        setPlayingMedia(null);
        setIsRemotePlaying(false);
        try {
          localStorage.removeItem('cinematic_remote_room_code');
        } catch (_) {}
        setMainPageConnectFeedback({
          success: false,
          msg: 'TV Screen was closed. Remote disconnected.'
        });
        return;
      }

      if ('isPlaying' in data && typeof data.isPlaying === 'boolean') {
        setIsRemotePlaying(data.isPlaying);
      }

      if (typeof data.volume === 'number') {
        setRemoteVolume(data.volume);
      }

      if ('playingItem' in data) {
        setPlayingMedia((prev) => {
          if (!data.playingItem && !prev) return null;
          if (data.playingItem && prev && data.playingItem.id === prev.id) {
            return prev;
          }
          return data.playingItem || null;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [pairingCode]);

  // Local BroadcastChannel listener for instant disconnect when TV tab closes
  useEffect(() => {
    const unsub = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'DISCONNECT') {
        setPairingCode('');
        setMainPageCodeInput('');
        setPlayingMedia(null);
        setIsRemotePlaying(false);
        try {
          localStorage.removeItem('cinematic_remote_room_code');
        } catch (_) {}
        setMainPageConnectFeedback({
          success: false,
          msg: 'TV Screen closed. Remote disconnected.'
        });
      } else if (msg.type === 'ROOM_UPDATE') {
        const updateData = (msg as any).data;
        if (updateData?.status === 'closed') {
          setPairingCode('');
          setMainPageCodeInput('');
          setPlayingMedia(null);
          setIsRemotePlaying(false);
          try {
            localStorage.removeItem('cinematic_remote_room_code');
          } catch (_) {}
          setMainPageConnectFeedback({
            success: false,
            msg: 'TV Screen closed. Remote disconnected.'
          });
        }
      }
    });
    return unsub;
  }, []);

  // Centralized robust Play Trigger for TV and remote
  const handlePlayMedia = useCallback((item: MediaItem, season = 1, episode = 1) => {
    if (isScreenLocked) return;
    soundFx.playClick('ok');
    setPlayingMedia(item);
    setIsPlayerHidden(false);
    setIsRemotePlaying(true);
    setRemoteVolume(100);
    setPlayerSeason(season);
    setPlayerEpisode(episode);

    const now = Date.now();
    const currentServerIndex = playerServerIndexRef.current;
    // 1. Local state & BroadcastChannel
    syncManager.saveState({
      playingItem: item,
      serverIndex: currentServerIndex,
      season,
      episode,
    });
    syncManager.broadcast({
      type: 'PLAY',
      item,
      serverIndex: currentServerIndex,
      season,
      episode,
    });

    // 2. Firebase live dispatch to TV Display Room
    const currentCode = pairingCodeRef.current || (typeof window !== 'undefined' ? localStorage.getItem('cinematic_remote_room_code') : '') || '';
    if (currentCode) {
      updateRoom(currentCode, {
        status: 'connected',
        playingItem: item,
        isPlaying: true,
        action: 'play',
        volume: 100,
        currentTime: 0,
        serverIndex: currentServerIndex,
        season,
        episode,
        lastCommandTimestamp: now,
      });
    }
  }, [isScreenLocked]);

  const handlePlayMediaRef = useRef(handlePlayMedia);
  handlePlayMediaRef.current = handlePlayMedia;

  // Direct connect handler for 4-digit Room Code
  const handleConnectRoomCode = async (code: string) => {
    const clean = code.trim();
    if (!clean || clean.length !== 4) {
      setMainPageConnectFeedback({
        success: false,
        msg: 'Please enter a 4-digit numeric room code (e.g. 4829).'
      });
      return;
    }

    setIsConnectingMainPage(true);
    setMainPageConnectFeedback(null);
    soundFx.playClick('switch');

    try {
      const res = await connectToRoom(clean);
      if (res.success && res.data) {
        soundFx.playClick('ok');
        setPairingCode(res.data.roomCode);
        setMainPageConnectFeedback({
          success: true,
          msg: `Connected to TV Room #${res.data.roomCode}!`
        });
        setMainPageCodeInput('');

        // If TV screen already has a movie playing in the background, adopt it so it continues uninterrupted!
        if (res.data.playingItem) {
          setPlayingMedia(res.data.playingItem);
          setIsRemotePlaying(true);
          setRemoteVolume(100);
          updateRoom(res.data.roomCode, {
            status: 'connected',
            action: 'play',
            isPlaying: true,
            volume: 100,
            lastCommandTimestamp: Date.now(),
          });
        } else {
          // If TV had no item playing, auto-play selected or focused movie with full sound
          const targetItem = playingMedia || (mediaItems && mediaItems.length > 0 ? mediaItems[selectedIndex] : null) || MEDIA_COLLECTION[0];
          if (targetItem) {
            handlePlayMedia(targetItem, playerSeason, playerEpisode);
            setRemoteVolume(100);
            updateRoom(res.data.roomCode, {
              status: 'connected',
              playingItem: targetItem,
              isPlaying: true,
              action: 'play',
              volume: 100,
              currentTime: 0,
              serverIndex: playerServerIndex,
              season: playerSeason,
              episode: playerEpisode,
              lastCommandTimestamp: Date.now(),
            });
          }
        }
      } else {
        soundFx.playClick('switch');
        setMainPageConnectFeedback({
          success: false,
          msg: res.message || 'Room not found. Check code on your TV.'
        });
      }
    } catch (err: any) {
      soundFx.playClick('switch');
      setMainPageConnectFeedback({
        success: false,
        msg: err?.message || 'Error connecting to TV Room.'
      });
    } finally {
      setIsConnectingMainPage(false);
    }
  };

  const handleMainPageConnect = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await handleConnectRoomCode(mainPageCodeInput);
  };

  // Remote Control Deck Actions
  const handleTogglePlayPause = () => {
    const nextPlaying = !isRemotePlaying;
    setIsRemotePlaying(nextPlaying);
    if (pairingCode) {
      updateRoom(pairingCode, {
        isPlaying: nextPlaying,
        action: nextPlaying ? 'play' : 'pause',
        lastCommandTimestamp: Date.now()
      });
    }
  };

  const handleRewind10 = () => {
    const code = pairingCodeRef.current || (typeof window !== 'undefined' ? localStorage.getItem('cinematic_remote_room_code') : '') || '';
    const ts = Date.now();
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command: 'rewind',
      extra: -10,
      timestamp: ts,
    });
    if (code) {
      updateRoom(code, {
        action: 'rewind',
        lastCommandTimestamp: ts,
      });
    }
  };

  const handleForward10 = () => {
    const code = pairingCodeRef.current || (typeof window !== 'undefined' ? localStorage.getItem('cinematic_remote_room_code') : '') || '';
    const ts = Date.now();
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command: 'forward',
      extra: 10,
      timestamp: ts,
    });
    if (code) {
      updateRoom(code, {
        action: 'forward',
        lastCommandTimestamp: ts,
      });
    }
  };

  const handleSeekTime = (seconds: number) => {
    const code = pairingCodeRef.current || (typeof window !== 'undefined' ? localStorage.getItem('cinematic_remote_room_code') : '') || '';
    const ts = Date.now();
    syncManager.broadcast({
      type: 'PLAYER_COMMAND',
      command: 'seek',
      value: seconds,
      timestamp: ts,
    });
    if (code) {
      updateRoom(code, {
        action: 'seek',
        currentTime: seconds,
        lastCommandTimestamp: ts,
      });
    }
  };

  const handlePlaySeasonEpisode = (seasonNum: number, episodeNum: number) => {
    const targetItem = playingMedia || (mediaItems && mediaItems.length > 0 ? mediaItems[selectedIndex] : null);
    if (targetItem) {
      handlePlayMedia(targetItem, seasonNum, episodeNum);
    }
  };

  const handleCloseSession = () => {
    soundFx.playClick('switch');
    setPlayingMedia(null);
    setIsRemotePlaying(false);
    syncManager.broadcast({ type: 'CLOSE_PLAYER' });
    const code = pairingCodeRef.current || (typeof window !== 'undefined' ? localStorage.getItem('cinematic_remote_room_code') : '') || '';
    if (code) {
      updateRoom(code, {
        action: 'close',
        isPlaying: false,
        playingItem: null,
        lastCommandTimestamp: Date.now(),
      });
    }
  };

  const handleDisconnectRemote = () => {
    soundFx.playClick('switch');
    if (pairingCode) {
      closeRoom(pairingCode);
    }
    setPairingCode('');
    setPlayingMedia(null);
    setIsRemotePlaying(false);
    setMainPageConnectFeedback({
      success: true,
      msg: 'Disconnected from TV Display.'
    });
    setTimeout(() => setMainPageConnectFeedback(null), 3000);
  };

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

  const hasMountedRef = useRef(false);

  // Fetch initial media (Page 1) when Category or Search Query Changes
  const fetchInitialMedia = useCallback(async (cat: CategoryType, query: string, shouldAutoPlay = true) => {
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

      // Auto-play selected item of this category on TV if requested
      if (shouldAutoPlay && result.items.length > 0) {
        handlePlayMediaRef.current(result.items[0], 1, 1);
      }
    } catch (err) {
      console.error('[API Fetch Error]:', err);
    } finally {
      setIsLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  // Fetch more media (Infinite Scrolling)
  const fetchMoreMedia = useCallback(async () => {
    if (isLoadingMore || !hasMore || isFetchingRef.current) return;
    setIsLoadingMore(true);
    isFetchingRef.current = true;
    const nextPage = page + 1;
    try {
      const result = await loadCategoryMedia(activeCategory, searchQuery, nextPage);
      if (result.items.length === 0) {
        setHasMore(false);
      } else {
        setMediaItems((prev) => [...prev, ...result.items]);
        setPage(nextPage);
        setHasMore(result.hasMore);
      }
    } catch (err) {
      console.error('[API Pagination Error]:', err);
    } finally {
      setIsLoadingMore(false);
      isFetchingRef.current = false;
    }
  }, [activeCategory, searchQuery, page, hasMore, isLoadingMore]);

  // Load initial content on mount & handle category/search changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchQuery) {
      debounceTimerRef.current = setTimeout(() => {
        fetchInitialMedia(activeCategory, searchQuery, false);
      }, 350);
    } else {
      autoPlayCategoryChangeRef.current = false;
      fetchInitialMedia(activeCategory, '', true);
    }

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [activeCategory, searchQuery, fetchInitialMedia]);

  // IntersectionObserver for seamless infinite scrolling
  const loadMoreAnchorRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading || isLoadingMore) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore) {
          fetchMoreMedia();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isLoading, isLoadingMore, hasMore, fetchMoreMedia]
  );

  // Keyboard navigation for TV remote feel (D-Pad & Shortcuts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable key navigation if screen locked or inside text input
      if (isScreenLocked) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = Math.min(selectedIndex + 1, mediaItems.length - 1);
        setSelectedIndex(next);
        soundFx.playClick('switch');
        if (mediaItems[next]) {
          handlePlayMediaRef.current(mediaItems[next], 1, 1);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = Math.max(selectedIndex - 1, 0);
        setSelectedIndex(next);
        soundFx.playClick('switch');
        if (mediaItems[next]) {
          handlePlayMediaRef.current(mediaItems[next], 1, 1);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(selectedIndex + 4, mediaItems.length - 1);
        setSelectedIndex(next);
        soundFx.playClick('switch');
        if (mediaItems[next]) {
          handlePlayMediaRef.current(mediaItems[next], 1, 1);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const next = Math.max(selectedIndex - 4, 0);
        setSelectedIndex(next);
        soundFx.playClick('switch');
        if (mediaItems[next]) {
          handlePlayMediaRef.current(mediaItems[next], 1, 1);
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (mediaItems[selectedIndex]) {
          soundFx.playClick('ok');
          handlePlayMediaRef.current(mediaItems[selectedIndex], 1, 1);
        }
      } else if (e.key === 'Escape') {
        if (activeModalItem) {
          setActiveModalItem(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mediaItems, selectedIndex, activeModalItem, isScreenLocked]);

  // Scroll listener for back to top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    soundFx.playClick('switch');
  };

  const handleToggleBookmark = (id: string) => {
    soundFx.playClick('switch');
    setBookmarks((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem('cinematic_remote_bookmarks', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // If URL indicates dedicated TV Display view, render LiveDisplayScreen
  if (isDisplayView) {
    return <LiveDisplayScreen />;
  }

  return (
    <div 
      id="app-root" 
      className="min-h-screen bg-[#08080c] text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black"
    >
      {/* 1. TOP STATUS & NAVIGATION BAR */}
      <header className="sticky top-0 z-40 bg-[#0c0d12]/90 backdrop-blur-md border-b border-zinc-800/80 px-3 py-2.5 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
          {/* Status Logo Indicator (Name removed per user request) */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="p-1.5 sm:p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-black shadow-lg shadow-amber-500/20">
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
          </div>

          {/* Header Controls: Room Code Input + Active Button + Camera QR + TV Player + Sound */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Room code input box & active button directly before camera icon */}
            <form onSubmit={handleMainPageConnect} className="flex items-center gap-1 sm:gap-1.5">
              <input
                id="header-room-code-input"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={mainPageCodeInput}
                onChange={(e) => setMainPageCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Code"
                className={`w-14 sm:w-18 text-center font-mono text-xs font-bold py-1.5 px-1 sm:px-2 bg-zinc-900 border rounded-xl placeholder:text-zinc-600 focus:outline-none transition-all ${
                  pairingCode && pairingCode === mainPageCodeInput
                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30 text-emerald-400'
                    : 'border-zinc-800 focus:border-amber-500/60 text-amber-400'
                }`}
                title="Enter 4-digit TV room code"
              />
              <button
                id="header-room-active-btn"
                type="submit"
                disabled={isConnectingMainPage || mainPageCodeInput.trim().length !== 4}
                className={`px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm ${
                  pairingCode && pairingCode === mainPageCodeInput
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black'
                    : 'bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-40 disabled:cursor-not-allowed'
                }`}
                title={pairingCode && pairingCode === mainPageCodeInput ? 'Room is Active' : 'Activate TV Room'}
              >
                {isConnectingMainPage ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    {pairingCode && pairingCode === mainPageCodeInput && (
                      <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                    )}
                    <span>Active</span>
                  </>
                )}
              </button>
            </form>

            {/* Scan QR Code Button (Camera icon) */}
            <button
              id="header-scan-qr-btn"
              type="button"
              onClick={() => {
                soundFx.playClick('switch');
                setIsQRScannerOpen(true);
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              title="Scan TV Screen QR Code with Camera"
            >
              <Camera className="w-4 h-4" />
              <span className="hidden md:inline">Scan QR</span>
            </button>

            {/* Open TV Display View in New Tab */}
            <a
              id="header-tv-player-btn"
              href={tvDisplayUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                soundFx.playClick('ok');
                const target = playingMediaRef.current || (mediaItems.length > 0 ? mediaItems[selectedIndex] : null);
                if (target) {
                  handlePlayMedia(target, playerSeason, playerEpisode);
                }
              }}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
              title="Open TV Screen in a new tab"
            >
              <Tv2 className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">TV Screen</span>
              <ExternalLink className="w-3 h-3 text-amber-400/80" />
            </a>
          </div>
        </div>

        {/* Connection Feedback Banner */}
        {mainPageConnectFeedback && (
          <div 
            className={`mt-2 max-w-7xl mx-auto p-2 rounded-xl text-xs flex items-center justify-between gap-2 animate-fadeIn ${
              mainPageConnectFeedback.success
                ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                : 'bg-red-950/40 border border-red-500/40 text-red-300'
            }`}
          >
            <span>{mainPageConnectFeedback.msg}</span>
            <button 
              type="button" 
              onClick={() => setMainPageConnectFeedback(null)}
              className="text-zinc-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </header>

      {/* 3. MAIN CONTENT CONTAINER */}
      <div className={`max-w-7xl mx-auto w-full px-4 sm:px-6 py-4 flex-1 flex flex-col gap-4 transition-all ${
        pairingCode || playingMedia ? 'pb-16 sm:pb-20' : 'pb-12'
      }`}>
        {/* Category Navigation (Movies, TV Shows, Anime) in 1 clean line */}
        <RemoteTopNav
          activeCategory={activeCategory}
          counts={counts}
          disabled={isScreenLocked}
          onSelectCategory={(cat) => {
            if (isScreenLocked) return;
            soundFx.playClick('switch');
            autoPlayCategoryChangeRef.current = true;
            if (cat === activeCategory) {
              fetchInitialMedia(cat, '', true);
            } else {
              setActiveCategory(cat);
              setSearchQuery('');
            }
          }}
        />

        {/* Search Bar with voice search */}
        <RemoteSearchBar
          searchQuery={searchQuery}
          onSearchChange={(query) => {
            if (isScreenLocked) return;
            setSearchQuery(query);
          }}
          onClearSearch={() => {
            if (isScreenLocked) return;
            setSearchQuery('');
          }}
          disabled={isScreenLocked}
        />

        {/* Media Posters Catalog in Chronological Timeline */}
        <main className="flex-1">
          <TimelineView
            category={activeCategory}
            items={mediaItems}
            selectedIndex={selectedIndex}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore}
            disabled={isScreenLocked}
            onSelectItem={(idx) => {
              if (isScreenLocked) return;
              setSelectedIndex(idx);
              const target = mediaItems[idx];
              if (target) {
                handlePlayMedia(target, 1, 1);
              }
            }}
            onOpenDetails={(item) => {
              if (isScreenLocked) return;
              handlePlayMedia(item, 1, 1);
            }}
            onPlayItem={(item) => {
              if (isScreenLocked) return;
              handlePlayMedia(item, 1, 1);
            }}
            loadMoreRef={loadMoreAnchorRef}
          />
        </main>
      </div>

      {/* 4. POSTER SELECTOR D-PAD CONTROLLER */}
      <PosterSelectorDpad
        items={mediaItems}
        selectedIndex={selectedIndex}
        category={activeCategory}
        hasBottomBar={Boolean(pairingCode || playingMedia)}
        disabled={isScreenLocked}
        onSelectItem={(idx) => {
          if (isScreenLocked) return;
          setSelectedIndex(idx);
          const target = mediaItems[idx];
          if (target) {
            handlePlayMedia(target, 1, 1);
          }
        }}
        onPlayItem={(item) => {
          if (isScreenLocked) return;
          handlePlayMedia(item, 1, 1);
        }}
      />

      {/* 5. SLEEK BOTTOM PLAYER CONTROL BAR (Thin, simple, 1 line on bottom) */}
      {(pairingCode || playingMedia) && (
        <ConnectedRemotePanel
          isPlaying={isRemotePlaying}
          item={playingMedia || mediaItems[selectedIndex]}
          season={playerSeason}
          episode={playerEpisode}
          category={activeCategory}
          onTogglePlayPause={handleTogglePlayPause}
          onRewind10={handleRewind10}
          onForward10={handleForward10}
          onSeekTime={handleSeekTime}
          onPlaySeasonEpisode={handlePlaySeasonEpisode}
          onCloseSession={handleCloseSession}
        />
      )}

      {/* Media Detail Modal */}
      {activeModalItem && (
        <MediaDetailModal
          item={activeModalItem}
          isBookmarked={bookmarks.includes(activeModalItem.id)}
          onToggleBookmark={() => handleToggleBookmark(activeModalItem.id)}
          onClose={() => setActiveModalItem(null)}
          onPlay={(season, episode) => {
            handlePlayMedia(activeModalItem, season, episode);
            setActiveModalItem(null);
          }}
        />
      )}

      {/* Full-Screen Camera & Image QR Code Scanner Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onSearchQuery={(query) => {
          setSearchQuery(query);
          soundFx.playClick('switch');
        }}
        onConnectRoom={(code) => {
          handleConnectRoomCode(code);
        }}
      />

      {/* Floating Scroll to Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className={`fixed right-5 z-30 p-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black shadow-xl shadow-amber-500/20 active:scale-95 transition-all cursor-pointer ${
            pairingCode || playingMedia ? 'bottom-22 sm:bottom-24' : 'bottom-6'
          }`}
          title="Scroll to Top"
        >
          <ArrowUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}
