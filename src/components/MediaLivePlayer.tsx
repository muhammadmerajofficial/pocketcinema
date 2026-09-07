import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Maximize2, 
  Tv, 
  Film, 
  Play, 
  Pause,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Sparkles,
  Server,
  Check,
  Eye,
  EyeOff,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Volume1,
  Settings,
  Subtitles,
  Activity,
  ArrowRight,
  Tv2
} from 'lucide-react';
import { MediaItem } from '../types';
import { soundFx } from '../utils/sound';
import { TMDB_API_KEY } from '../services/api';
import { syncManager, SyncMessage } from '../utils/syncChannel';

export interface PlayerServer {
  id: string;
  name: string;
  getMovieUrl: (id: string, options?: PlayerOptions) => string;
  getTvUrl: (id: string, s: number, e: number, options?: PlayerOptions) => string;
  getAnimeUrl: (id: string, s: number, e: number, options?: PlayerOptions) => string;
}

export interface PlayerOptions {
  skin?: 'onyx' | 'aurora';
  welcomePage?: 'on' | 'off';
  autoplay?: 'on' | 'off';
  subUrl?: string;
  subLabel?: string;
}

export function formatEmbedMasterId(rawId: string | number): string {
  const str = String(rawId).trim();
  if (str.startsWith('tt')) {
    return str;
  }
  const match = str.match(/tt\d+/);
  if (match) return match[0];
  const numMatch = str.match(/\d+/);
  return numMatch ? numMatch[0] : str;
}

function buildEmbedMasterQuery(opts?: PlayerOptions): string {
  const skin = opts?.skin || 'onyx';
  const welcome = opts?.welcomePage || 'off';
  const autoplay = opts?.autoplay || 'on';
  let q = `?skin=${encodeURIComponent(skin)}&welcome_page=${encodeURIComponent(welcome)}&autoplay=${encodeURIComponent(autoplay)}`;
  if (opts?.subUrl && opts?.subUrl.trim()) {
    q += `&sub_url[]=${encodeURIComponent(opts.subUrl.trim())}`;
    if (opts?.subLabel && opts?.subLabel.trim()) {
      q += `&sub_label[]=${encodeURIComponent(opts.subLabel.trim())}`;
    }
  }
  return q;
}

// Player servers with EmbedMaster as #1 (Primary & Default)
export const ALL_PLAYER_SERVERS: PlayerServer[] = [
  {
    id: 'embedmaster',
    name: 'EmbedMaster.link (Official)',
    getMovieUrl: (id, opts) => `https://embedmaster.link/movie/${formatEmbedMasterId(id)}${buildEmbedMasterQuery(opts)}`,
    getTvUrl: (id, s, e, opts) => `https://embedmaster.link/tv/${formatEmbedMasterId(id)}/${s}/${e}${buildEmbedMasterQuery(opts)}`,
    getAnimeUrl: (id, s, e, opts) => `https://embedmaster.link/tv/${formatEmbedMasterId(id)}/${s}/${e}${buildEmbedMasterQuery(opts)}`,
  },
  {
    id: 'cinemaos-in',
    name: 'CinemaOS.in',
    getMovieUrl: (id) => `https://cinemaos.in/movie/watch/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://cinemaos.in/tv/watch/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://cinemaos.in/tv/watch/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'peachify',
    name: 'Peachify.top',
    getMovieUrl: (id) => `https://peachify.top/embed/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://peachify.top/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://peachify.top/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'boredflix',
    name: 'BoredFlix.cc',
    getMovieUrl: (id) => `https://boredflix.cc/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://boredflix.cc/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://boredflix.cc/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'vidrock',
    name: 'VidRock.ru',
    getMovieUrl: (id) => `https://vidrock.ru/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://vidrock.ru/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://vidrock.ru/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'vidsrc',
    name: 'VidSrc.tw',
    getMovieUrl: (id) => `https://vidsrc.tw/embed/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://vidsrc.tw/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://vidsrc.tw/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'vidlove',
    name: 'VidLove.cc',
    getMovieUrl: (id) => `https://player.vidlove.cc/embed/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://player.vidlove.cc/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://player.vidlove.cc/embed/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
  {
    id: 'vidspark',
    name: 'VidSpark.to',
    getMovieUrl: (id) => `https://vidspark.to/movie/${formatEmbedMasterId(id)}`,
    getTvUrl: (id, s, e) => `https://vidspark.to/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
    getAnimeUrl: (id, s, e) => `https://vidspark.to/tv/${formatEmbedMasterId(id)}/${s}/${e}`,
  },
];

interface MediaLivePlayerProps {
  item: MediaItem;
  onClose: () => void;
  isPlayerHidden?: boolean;
  onToggleHide?: () => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  isFullScreenMode?: boolean;
  currentServerIndex?: number;
  currentSeason?: number;
  currentEpisode?: number;
  onPlayerConfigChange?: (config: { serverIndex: number; season: number; episode: number }) => void;
  remoteTriggerAction?: { action: 'play' | 'preview' | 'next'; timestamp: number } | null;
  onPlayerAction?: (action: 'play' | 'preview' | 'next') => void;
  onNextTrack?: () => void;
  onPrevTrack?: () => void;
}

export function extractNumericId(rawId: string | number): string {
  const str = String(rawId);
  const match = str.match(/\d+/);
  return match ? match[0] : str;
}

interface SeasonData {
  seasonNumber: number;
  episodeCount: number;
}

// Format seconds to mm:ss or hh:mm:ss
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
}

export const MediaLivePlayer: React.FC<MediaLivePlayerProps> = ({ 
  item, 
  onClose,
  isPlayerHidden = false,
  onToggleHide,
  isLocked = false,
  onToggleLock,
  isFullScreenMode = false,
  currentServerIndex = 0,
  currentSeason = 1,
  currentEpisode = 1,
  onPlayerConfigChange,
  remoteTriggerAction,
  onPlayerAction,
  onNextTrack,
  onPrevTrack,
}) => {
  const [serverIndex, setServerIndex] = useState(
    typeof currentServerIndex === 'number' && currentServerIndex >= 0 && currentServerIndex < ALL_PLAYER_SERVERS.length
      ? currentServerIndex
      : 0
  );
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);

  // Player Options
  const [playerSkin, setPlayerSkin] = useState<'onyx' | 'aurora'>('onyx');
  const [welcomePage, setWelcomePage] = useState<'on' | 'off'>('off');
  const [autoplay, setAutoplay] = useState<'on' | 'off'>('on');
  const [customSubUrl, setCustomSubUrl] = useState('');
  const [customSubLabel, setCustomSubLabel] = useState('English');
  const [directIdInput, setDirectIdInput] = useState('');
  const [activeMediaId, setActiveMediaId] = useState<string>(item.id);

  // Series Season & Episode
  const [activeSeason, setActiveSeason] = useState(currentSeason || 1);
  const [activeEpisode, setActiveEpisode] = useState(currentEpisode || 1);
  const [inputSeason, setInputSeason] = useState<number | string>(currentSeason || 1);
  const [inputEpisode, setInputEpisode] = useState<number | string>(currentEpisode || 1);

  // Sync inputs when activeSeason/activeEpisode changes
  useEffect(() => {
    setInputSeason(activeSeason);
  }, [activeSeason]);

  useEffect(() => {
    setInputEpisode(activeEpisode);
  }, [activeEpisode]);

  // Real-time Playback State received via postMessage from EmbedMaster
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<string>('Ready');
  const [eventTime, setEventTime] = useState<number>(Date.now());

  // Metadata
  const [seasonsData, setSeasonsData] = useState<SeasonData[]>([]);
  const [totalSeasons, setTotalSeasons] = useState(1);
  const [totalEpisodes, setTotalEpisodes] = useState(12);
  const [isIframeLoading, setIsIframeLoading] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const serverMenuRef = useRef<HTMLDivElement>(null);
  const lastHandledRemoteTimestampRef = useRef<number>(0);
  const lastBroadcastTimeRef = useRef<number>(0);

  // Maintain refs for message listener to avoid re-attaching listeners and render cascades
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const durationRef = useRef(duration);
  durationRef.current = duration;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef(isMuted);
  isMutedRef.current = isMuted;
  const activeSeasonRef = useRef(activeSeason);
  activeSeasonRef.current = activeSeason;
  const activeEpisodeRef = useRef(activeEpisode);
  activeEpisodeRef.current = activeEpisode;

  // Sync active media ID when item prop changes
  useEffect(() => {
    setActiveMediaId(item.id);
  }, [item.id]);

  // Sync seasons & episodes when props change
  useEffect(() => {
    if (typeof currentSeason === 'number' && currentSeason > 0) {
      setActiveSeason(currentSeason);
      setInputSeason(currentSeason);
    }
  }, [currentSeason]);

  useEffect(() => {
    if (typeof currentEpisode === 'number' && currentEpisode > 0) {
      setActiveEpisode(currentEpisode);
      setInputEpisode(currentEpisode);
    }
  }, [currentEpisode]);

  // EMBEDMASTER POSTMESSAGE COMMAND DISPATCHER
  const sendEmbedMasterCommand = useCallback((command: string, value?: any) => {
    const frame = iframeRef.current || (document.getElementById('embedmaster_iframe') as HTMLIFrameElement | null);
    if (!frame || !frame.contentWindow) return;

    try {
      frame.contentWindow.postMessage({
        source: 'embedmaster_player_command',
        command: command,
        value: value
      }, '*');
    } catch (err) {
      console.warn('[EmbedMaster] sendCommand error:', err);
    }
  }, []);

  // Listen to EmbedMaster events coming from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.source !== 'embedmaster_player') return;

      setLastEvent(data.event || 'message');
      setEventTime(Date.now());

      let currentPlayingState = isPlayingRef.current;

      if (data.event === 'play') {
        setIsPlaying(true);
        currentPlayingState = true;
      } else if (data.event === 'pause') {
        setIsPlaying(false);
        currentPlayingState = false;
      } else if (data.event === 'time' && data.info) {
        if (typeof data.info.time === 'number') {
          setCurrentTime(data.info.time);
        }
        if (typeof data.info.duration === 'number' && data.info.duration > 0) {
          setDuration(data.info.duration);
        }
      } else if (data.event === 'volume' && data.info) {
        if (typeof data.info.volume === 'number') {
          setVolume(data.info.volume);
        }
        if (typeof data.info.muted === 'boolean') {
          setIsMuted(data.info.muted);
        }
      }

      // Throttled broadcast so Remote Controller receives real-time progress & state without render thrashing
      const now = Date.now();
      if (now - lastBroadcastTimeRef.current > 400 || data.event === 'play' || data.event === 'pause') {
        lastBroadcastTimeRef.current = now;
        syncManager.broadcast({
          type: 'PLAYER_STATUS',
          isPlaying: currentPlayingState,
          currentTime: data.info?.time ?? currentTimeRef.current,
          duration: data.info?.duration ?? durationRef.current,
          volume: data.info?.volume ?? volumeRef.current,
          isMuted: data.info?.muted ?? isMutedRef.current,
          activeSeason: activeSeasonRef.current,
          activeEpisode: activeEpisodeRef.current,
          timestamp: now,
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handlePrevEpisode = () => {
    setActiveEpisode((prev) => {
      if (prev <= 1) return 1;
      const newEp = prev - 1;
      setInputEpisode(newEp);
      setIsIframeLoading(true);
      onPlayerConfigChange?.({ serverIndex, season: activeSeason, episode: newEp });
      return newEp;
    });
  };

  const handleNextEpisode = () => {
    setActiveEpisode((prev) => {
      if (prev >= totalEpisodes) return prev;
      const newEp = prev + 1;
      setInputEpisode(newEp);
      setIsIframeLoading(true);
      onPlayerConfigChange?.({ serverIndex, season: activeSeason, episode: newEp });
      return newEp;
    });
  };

  // Listen for BroadcastChannel commands from Remote Controller
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'PLAYER_COMMAND') {
        const { command, value } = msg;
        if (command === 'play') {
          sendEmbedMasterCommand('play');
          setIsPlaying(true);
        } else if (command === 'pause') {
          sendEmbedMasterCommand('pause');
          setIsPlaying(false);
        } else if (command === 'seek') {
          sendEmbedMasterCommand('seek', value);
          if (typeof value === 'number') setCurrentTime(value);
        } else if (command === 'mute') {
          sendEmbedMasterCommand('mute');
          setIsMuted(true);
        } else if (command === 'unmute') {
          sendEmbedMasterCommand('unmute');
          setIsMuted(false);
        } else if (command === 'volume') {
          sendEmbedMasterCommand('volume', value);
          if (typeof value === 'number') setVolume(value);
        } else if (command === 'fullscreen') {
          sendEmbedMasterCommand('fullscreen');
        } else if (command === 'prev_ep') {
          handlePrevEpisode();
        } else if (command === 'next_ep') {
          handleNextEpisode();
        }
      }
    });

    return () => unsubscribe();
  }, [sendEmbedMasterCommand]);

  // Screen Wake Lock API and Background Sleep Prevention
  useEffect(() => {
    let wakeLockSentinel: any = null;
    let isSubscribed = true;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator && (navigator as any).wakeLock) {
          wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        }
      } catch {}
    };

    requestWakeLock();

    return () => {
      isSubscribed = false;
      if (wakeLockSentinel) wakeLockSentinel.release().catch(() => {});
    };
  }, []);

  const numericId = extractNumericId(activeMediaId);
  const isSeries = item.category === 'tv' || item.category === 'anime';

  // Fetch exact seasons and episode counts from TMDB for TV and Anime
  useEffect(() => {
    if (!isSeries || !numericId) return;

    let isMounted = true;
    const key = (typeof window !== 'undefined' && window.CINEMATIC_CONFIG?.TMDB_API_KEY) || TMDB_API_KEY;

    fetch(`https://api.themoviedb.org/3/tv/${numericId}?api_key=${key}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const rawSeasons: any[] = data.seasons || [];
        const valid = rawSeasons.filter((s) => s.season_number > 0);
        const mapped: SeasonData[] = (valid.length > 0 ? valid : rawSeasons).map((s) => ({
          seasonNumber: s.season_number,
          episodeCount: Math.max(1, s.episode_count || 1),
        }));

        const numSeasons = mapped.length > 0 ? mapped.length : Math.max(1, data.number_of_seasons || 1);
        setSeasonsData(mapped);
        setTotalSeasons(numSeasons);

        const s1 = mapped.find((s) => s.seasonNumber === activeSeason);
        const eps = s1 ? s1.episodeCount : 12;
        setTotalEpisodes(eps);
      })
      .catch(() => {
        setTotalSeasons(4);
        setTotalEpisodes(12);
      });

    return () => {
      isMounted = false;
    };
  }, [numericId, isSeries, activeSeason]);

  // Construct iframe embed URL
  const currentServer = ALL_PLAYER_SERVERS[serverIndex] || ALL_PLAYER_SERVERS[0];
  const playerOptions: PlayerOptions = {
    skin: playerSkin,
    welcomePage: welcomePage,
    autoplay: autoplay,
    subUrl: customSubUrl,
    subLabel: customSubLabel,
  };

  let playerUrl = '';
  if (item.category === 'movies') {
    playerUrl = currentServer.getMovieUrl(activeMediaId, playerOptions);
  } else if (item.category === 'tv') {
    playerUrl = currentServer.getTvUrl(activeMediaId, activeSeason, activeEpisode, playerOptions);
  } else {
    playerUrl = currentServer.getAnimeUrl(activeMediaId, activeSeason, activeEpisode, playerOptions);
  }

  // Play / Pause Toggle
  const handleTogglePlay = () => {
    soundFx.playClick('ok');
    if (isPlaying) {
      sendEmbedMasterCommand('pause');
      setIsPlaying(false);
    } else {
      sendEmbedMasterCommand('play');
      setIsPlaying(true);
    }
  };

  // Seek relative (-10s / +10s)
  const handleSeek = (deltaSeconds: number) => {
    soundFx.playClick('nav');
    const target = Math.max(0, currentTime + deltaSeconds);
    setCurrentTime(target);
    sendEmbedMasterCommand('seek', target);
  };

  // Scrubber change
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = Number(e.target.value);
    setCurrentTime(target);
    sendEmbedMasterCommand('seek', target);
  };

  // Volume & Mute
  const handleToggleMute = () => {
    soundFx.playClick('switch');
    if (isMuted) {
      sendEmbedMasterCommand('unmute');
      setIsMuted(false);
    } else {
      sendEmbedMasterCommand('mute');
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (val === 0) {
      setIsMuted(true);
      sendEmbedMasterCommand('mute');
    } else {
      if (isMuted) {
        setIsMuted(false);
        sendEmbedMasterCommand('unmute');
      }
      sendEmbedMasterCommand('volume', val);
    }
  };

  // Dynamic max episodes calculation for whatever season is typed
  const parsedLiveInputSeason = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10) || activeSeason;
  const liveTargetSeasonData = seasonsData.find((s) => s.seasonNumber === parsedLiveInputSeason);
  const liveTargetSeasonEpisodes = liveTargetSeasonData ? liveTargetSeasonData.episodeCount : totalEpisodes;

  const handleLiveSeasonInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val === '') {
      setInputSeason('');
    } else {
      const num = parseInt(val, 10);
      setInputSeason(num);
    }
  };

  const handleLiveEpisodeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    if (val === '') {
      setInputEpisode('');
    } else {
      const num = parseInt(val, 10);
      setInputEpisode(num);
    }
  };

  const handleIncrementSeason = () => {
    let currentVal = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10) || 1;
    if (currentVal < totalSeasons) {
      const nextVal = currentVal + 1;
      setInputSeason(nextVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handleDecrementSeason = () => {
    let currentVal = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10) || 1;
    if (currentVal > 1) {
      const prevVal = currentVal - 1;
      setInputSeason(prevVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handleIncrementEpisode = () => {
    let currentVal = typeof inputEpisode === 'number' ? inputEpisode : parseInt(String(inputEpisode), 10) || 1;
    if (currentVal < liveTargetSeasonEpisodes) {
      const nextVal = currentVal + 1;
      setInputEpisode(nextVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handleDecrementEpisode = () => {
    let currentVal = typeof inputEpisode === 'number' ? inputEpisode : parseInt(String(inputEpisode), 10) || 1;
    if (currentVal > 1) {
      const prevVal = currentVal - 1;
      setInputEpisode(prevVal);
      soundFx.playClick('nav');
    } else {
      soundFx.playClick('switch');
    }
  };

  const handlePlayCustomSeasonEpisode = () => {
    let targetS = typeof inputSeason === 'number' ? inputSeason : parseInt(String(inputSeason), 10);
    if (isNaN(targetS) || targetS < 1) targetS = 1;
    if (targetS > totalSeasons) targetS = totalSeasons;

    const sData = seasonsData.find((s) => s.seasonNumber === targetS);
    const maxEps = sData ? sData.episodeCount : 12;

    let targetE = typeof inputEpisode === 'number' ? inputEpisode : parseInt(String(inputEpisode), 10);
    if (isNaN(targetE) || targetE < 1) targetE = 1;
    if (targetE > maxEps) targetE = maxEps;

    setInputSeason(targetS);
    setInputEpisode(targetE);
    setActiveSeason(targetS);
    setActiveEpisode(targetE);
    setIsIframeLoading(true);
    soundFx.playClick('ok');

    onPlayerConfigChange?.({ serverIndex, season: targetS, episode: targetE });
  };

  const handleSeasonEpisodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePlayCustomSeasonEpisode();
    }
  };

  // Fullscreen
  const handleFullscreen = () => {
    soundFx.playClick('nav');
    sendEmbedMasterCommand('fullscreen');
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  // Direct ID launcher
  const handleLaunchDirectId = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = directIdInput.trim();
    if (!clean) return;
    soundFx.playClick('ok');
    setActiveMediaId(clean);
    setIsIframeLoading(true);
  };

  // Cycle Server
  const handleCycleServer = () => {
    soundFx.playClick('switch');
    setIsIframeLoading(true);
    const nextServer = (serverIndex + 1) % ALL_PLAYER_SERVERS.length;
    setServerIndex(nextServer);
    onPlayerConfigChange?.({ serverIndex: nextServer, season: activeSeason, episode: activeEpisode });
  };

  const handleSelectServer = (idx: number) => {
    soundFx.playClick('switch');
    setIsIframeLoading(true);
    setServerIndex(idx);
    setShowServerMenu(false);
    onPlayerConfigChange?.({ serverIndex: idx, season: activeSeason, episode: activeEpisode });
  };

  // Listen to remoteTriggerAction prop
  useEffect(() => {
    if (
      remoteTriggerAction &&
      remoteTriggerAction.action &&
      remoteTriggerAction.timestamp &&
      remoteTriggerAction.timestamp > lastHandledRemoteTimestampRef.current
    ) {
      lastHandledRemoteTimestampRef.current = remoteTriggerAction.timestamp;
      if (remoteTriggerAction.action === 'play') {
        handleTogglePlay();
      } else if (remoteTriggerAction.action === 'preview') {
        if (isSeries) handlePrevEpisode();
        else handleSeek(-10);
      } else if (remoteTriggerAction.action === 'next') {
        if (isSeries) handleNextEpisode();
        else handleSeek(10);
      }
    }
  }, [remoteTriggerAction?.timestamp, remoteTriggerAction?.action]);

  return (
    <div 
      id="embedmaster-cinema-container"
      ref={containerRef}
      className={`w-full flex flex-col items-center select-none font-sans ${
        isFullScreenMode 
          ? 'fixed inset-0 z-50 w-screen h-screen bg-black justify-between' 
          : 'max-w-[1100px] mx-auto gap-3'
      }`}
    >
      {/* 1. TOP TITLE & SERVER BAR (Discreet & Sleek) */}
      <header className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-zinc-950/90 rounded-2xl border border-zinc-800/80 shadow-md">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
            {item.category === 'movies' ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider font-black text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                EmbedMaster
              </span>
              <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                {item.category === 'movies' ? 'Movie' : isSeries ? `S${activeSeason} E${activeEpisode}` : 'Stream'}
              </span>
              <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
                ID: {formatEmbedMasterId(activeMediaId)}
              </span>
            </div>
            <h2 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-sm">
              {item.title}
            </h2>
          </div>
        </div>

        {/* Server & Options Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Server Switcher */}
          <div className="relative" ref={serverMenuRef}>
            <div className="flex items-center gap-1">
              <button
                id="player-server-cycle-btn"
                type="button"
                onClick={handleCycleServer}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-300 border border-amber-500/30 text-xs font-semibold cursor-pointer transition-all active:scale-95"
                title="Switch Player Server"
              >
                <Server className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate max-w-[110px] sm:max-w-none text-white font-mono text-[11px]">
                  {currentServer.name}
                </span>
                <RefreshCw className="w-3 h-3 text-amber-400 shrink-0" />
              </button>

              <button
                id="player-server-dropdown-btn"
                type="button"
                onClick={() => setShowServerMenu(!showServerMenu)}
                className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 cursor-pointer text-xs"
                title="Choose server from list"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {showServerMenu && (
              <div className="absolute top-full right-0 mt-1.5 w-64 max-h-72 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl p-1.5 z-50 flex flex-col gap-1 backdrop-blur-xl">
                <div className="px-2.5 py-1 text-[10px] font-mono text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                  Select Video Server
                </div>
                {ALL_PLAYER_SERVERS.map((srv, idx) => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => handleSelectServer(idx)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      idx === serverIndex
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                        : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                    }`}
                  >
                    <span>{srv.name}</span>
                    {idx === serverIndex && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Player Settings Drawer Toggle */}
          <button
            id="player-settings-toggle-btn"
            type="button"
            onClick={() => setShowSettingsDrawer(!showSettingsDrawer)}
            className={`p-1.5 sm:px-2 sm:py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
              showSettingsDrawer 
                ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]' 
                : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
            }`}
            title="EmbedMaster Options (Skin, Subtitles, Autoplay, Custom ID)"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Options</span>
          </button>

          {/* Lock / Unlock Controls */}
          {onToggleLock && (
            <button
              id="player-lock-toggle-btn"
              type="button"
              onClick={() => {
                soundFx.playClick(isLocked ? 'ok' : 'switch');
                onToggleLock();
              }}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                isLocked 
                  ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)] animate-pulse' 
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
              }`}
              title={isLocked ? "Screen & Controls Locked (L)" : "Lock Screen Controls (L)"}
            >
              {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Hide / Show */}
          {onToggleHide && (
            <button
              id="player-hide-toggle-btn"
              type="button"
              disabled={isLocked}
              onClick={onToggleHide}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 text-xs cursor-pointer transition-colors"
              title={isPlayerHidden ? "Show Player" : "Hide Player to Background"}
            >
              {isPlayerHidden ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Close / Stop */}
          <button
            id="player-close-btn"
            type="button"
            disabled={isLocked}
            onClick={() => {
              soundFx.playClick('switch');
              onClose();
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-200 border border-red-800/60 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
            title="Stop & Close Player"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>
      </header>

      {/* OPTIONAL: EMBEDMASTER SETTINGS DRAWER (Skin, Subtitles, Custom IMDb/TMDB ID) */}
      {showSettingsDrawer && (
        <div 
          id="embedmaster-settings-drawer"
          className="w-full bg-zinc-950/95 border border-amber-500/30 rounded-2xl p-3 sm:p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-400 font-mono">
                EmbedMaster Player Settings
              </span>
            </div>
            <button 
              type="button" 
              onClick={() => setShowSettingsDrawer(false)}
              className="text-zinc-500 hover:text-zinc-200 text-xs cursor-pointer"
            >
              Done
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            {/* Skin Switcher */}
            <div className="flex flex-col gap-1.5 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
              <label className="font-semibold text-zinc-300">Player Skin</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPlayerSkin('onyx')}
                  className={`flex-1 py-1 px-2 rounded-lg font-mono text-[11px] transition-all cursor-pointer border ${
                    playerSkin === 'onyx' 
                      ? 'bg-amber-500 text-black font-bold border-amber-400' 
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  Onyx (Dark/Flat)
                </button>
                <button
                  type="button"
                  onClick={() => setPlayerSkin('aurora')}
                  className={`flex-1 py-1 px-2 rounded-lg font-mono text-[11px] transition-all cursor-pointer border ${
                    playerSkin === 'aurora' 
                      ? 'bg-amber-500 text-black font-bold border-amber-400' 
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  Aurora (Vibrant)
                </button>
              </div>
            </div>

            {/* Welcome Page & Autoplay */}
            <div className="flex flex-col gap-1.5 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
              <label className="font-semibold text-zinc-300">Autoplay & Welcome</label>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setAutoplay(autoplay === 'on' ? 'off' : 'on')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-mono border cursor-pointer ${
                    autoplay === 'on' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  Autoplay: {autoplay.toUpperCase()}
                </button>
                <button
                  type="button"
                  onClick={() => setWelcomePage(welcomePage === 'on' ? 'off' : 'on')}
                  className={`flex-1 py-1 px-2 rounded-lg text-[11px] font-mono border cursor-pointer ${
                    welcomePage === 'on' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  Welcome Page: {welcomePage.toUpperCase()}
                </button>
              </div>
            </div>

            {/* Custom Subtitles Loader */}
            <div className="flex flex-col gap-1.5 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800 sm:col-span-2 md:col-span-1">
              <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Subtitles className="w-3.5 h-3.5 text-amber-400" />
                <span>Custom Subtitle URL (.vtt)</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="https://example.com/sub.vtt"
                  value={customSubUrl}
                  onChange={(e) => setCustomSubUrl(e.target.value)}
                  className="flex-1 bg-black px-2 py-1 rounded-lg border border-zinc-700 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-400"
                />
                <input
                  type="text"
                  placeholder="Label"
                  value={customSubLabel}
                  onChange={(e) => setCustomSubLabel(e.target.value)}
                  className="w-16 bg-black px-1.5 py-1 rounded-lg border border-zinc-700 text-[11px] text-zinc-200 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          </div>

          {/* Instant Play Any IMDb / TMDB ID */}
          <form onSubmit={handleLaunchDirectId} className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/80">
            <span className="text-zinc-400 text-xs font-semibold">
              Instant Stream any ID:
            </span>
            <input
              type="text"
              placeholder="e.g. tt31193180 or 575265"
              value={directIdInput}
              onChange={(e) => setDirectIdInput(e.target.value)}
              className="flex-1 min-w-[180px] bg-black px-3 py-1.5 rounded-xl border border-amber-500/40 text-xs text-amber-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-400 font-mono"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer transition-all flex items-center gap-1.5"
            >
              <span>Stream ID</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* 2. FULL SCREEN PLAYER ONLY (100% UNTOUCHED, NO OVERLAYS ON TOP OF VIDEO) */}
      <div 
        id="embedmaster-player-stage"
        className={`w-full relative bg-black overflow-hidden shadow-2xl border-2 border-zinc-800/90 ${
          isFullScreenMode 
            ? 'flex-1 rounded-none border-none' 
            : 'aspect-video rounded-2xl sm:rounded-3xl'
        }`}
      >
        {/* Loading spinner while iframe connects */}
        {isIframeLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-zinc-950/95 backdrop-blur-sm pointer-events-none">
            <div className="relative">
              <div className="w-14 h-14 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin" />
              <Play className="w-6 h-6 text-amber-400 absolute inset-0 m-auto" />
            </div>
            <span className="text-xs font-mono text-zinc-400">
              Loading {item.title} on {currentServer.name}...
            </span>
          </div>
        )}

        {/* The EmbedMaster iframe: 100% width, 100% height, full screen player */}
        <iframe
          id="embedmaster_iframe"
          ref={iframeRef}
          key={`${playerUrl}-${activeSeason}-${activeEpisode}`}
          src={playerUrl}
          title={`${item.title} EmbedMaster Player`}
          className="w-full h-full border-0 absolute inset-0 block"
          allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
          allowFullScreen
          referrerPolicy="origin"
          onLoad={() => setIsIframeLoading(false)}
        />
      </div>

      {/* 3. DEDICATED SEPARATE BOTTOM CONTROL BAR ("player control bar alada thakbe niche") */}
      <div 
        id="embedmaster-bottom-control-bar"
        className={`w-full bg-gradient-to-b from-zinc-950 via-zinc-950 to-black border border-zinc-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xl flex flex-col gap-3 transition-opacity ${
          isLocked ? 'opacity-30 pointer-events-none' : ''
        }`}
      >
        {/* TIMELINE PROGRESS SCRUBBER ROW */}
        <div className="w-full flex items-center gap-2.5 sm:gap-4">
          <span className="text-[11px] sm:text-xs font-mono font-bold text-amber-400 shrink-0 min-w-[42px]">
            {formatTime(currentTime)}
          </span>

          {/* Interactive Scrub Bar */}
          <div className="relative flex-1 flex items-center group py-1">
            <input
              id="embedmaster-scrub-slider"
              type="range"
              min={0}
              max={duration > 0 ? duration : 100}
              step={1}
              value={currentTime}
              onChange={handleScrubberChange}
              className="w-full h-2 rounded-lg bg-zinc-800 accent-amber-400 hover:accent-amber-300 cursor-pointer appearance-none focus:outline-none transition-all"
              title="Click or drag to seek"
            />
          </div>

          <span className="text-[11px] sm:text-xs font-mono text-zinc-400 shrink-0 min-w-[42px] text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* MAIN CONTROLS ROW */}
        <div className="w-full flex flex-wrap items-center justify-between gap-2.5">
          {/* Left: Playback Controls (Play/Pause, Rewind, Fast Forward) */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Seek -10s */}
            <button
              id="player-control-rewind-btn"
              type="button"
              onClick={() => handleSeek(-10)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 cursor-pointer transition-all active:scale-95 text-xs font-semibold"
              title="Rewind 10 seconds"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              <span className="hidden sm:inline">-10s</span>
            </button>

            {/* Primary PLAY / PAUSE Button */}
            <button
              id="player-control-play-pause-btn"
              type="button"
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-2xl font-black text-xs sm:text-sm cursor-pointer transition-all active:scale-95 shadow-lg ${
                isPlaying
                  ? 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-[0_0_20px_rgba(245,158,11,0.5)]'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)]'
              }`}
              title={isPlaying ? "Pause Video" : "Play Video"}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-black" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-black translate-x-0.5" />
                  <span>Play</span>
                </>
              )}
            </button>

            {/* Seek +10s */}
            <button
              id="player-control-forward-btn"
              type="button"
              onClick={() => handleSeek(10)}
              className="flex items-center gap-1 px-2.5 sm:px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 cursor-pointer transition-all active:scale-95 text-xs font-semibold"
              title="Forward 10 seconds"
            >
              <span className="hidden sm:inline">+10s</span>
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </button>
          </div>

          {/* Middle: Volume & Mute Deck */}
          <div className="flex items-center gap-2 bg-zinc-900/90 px-3 py-1.5 rounded-2xl border border-zinc-800">
            <button
              id="player-control-mute-btn"
              type="button"
              onClick={handleToggleMute}
              className="p-1 rounded-lg text-zinc-300 hover:text-amber-400 transition-colors cursor-pointer"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-red-400" />
              ) : volume < 50 ? (
                <Volume1 className="w-4 h-4 text-amber-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-amber-400" />
              )}
            </button>

            <input
              id="player-control-volume-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 sm:w-24 h-1.5 rounded-lg bg-zinc-800 accent-amber-400 cursor-pointer"
              title={`Volume: ${isMuted ? 'Muted' : `${volume}%`}`}
            />

            <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">
              {isMuted ? '0%' : `${volume}%`}
            </span>
          </div>

          {/* Right: Fullscreen & Series Episode Controls */}
          <div className="flex items-center gap-2">
            {/* TV/Anime Season & Episode Box Controls */}
            {isSeries && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Season Stepper Box */}
                <div 
                  className="flex items-center bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-xl px-1.5 py-1 gap-1 shadow-sm transition-all text-xs"
                  title={`Season Selector (Total: ${totalSeasons} Seasons)`}
                >
                  <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-tight pl-0.5">
                    S
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inputSeason}
                    onChange={handleLiveSeasonInputChange}
                    onKeyDown={handleSeasonEpisodeKeyDown}
                    className="w-8 h-7 bg-black/70 border border-zinc-700/80 focus:border-amber-500 rounded-lg text-center text-xs font-mono font-bold text-amber-300 outline-none transition-colors"
                    title="Season Number (Type or use arrows, click Play to load)"
                    placeholder="1"
                  />
                  <div className="flex flex-col -space-y-0.5">
                    <button
                      type="button"
                      onClick={handleIncrementSeason}
                      disabled={Number(inputSeason) >= totalSeasons}
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Next Season (Up Arrow)"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDecrementSeason}
                      disabled={Number(inputSeason) <= 1}
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Previous Season (Down Arrow)"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-zinc-500 pr-0.5 select-none">
                    /{totalSeasons}
                  </span>
                </div>

                {/* Episode Stepper Box */}
                <div 
                  className="flex items-center bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 rounded-xl px-1.5 py-1 gap-1 shadow-sm transition-all text-xs"
                  title={`Episode Selector (Total: ${liveTargetSeasonEpisodes} Episodes in this season)`}
                >
                  <span className="text-[11px] font-mono font-bold text-zinc-400 uppercase tracking-tight pl-0.5">
                    Ep
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={inputEpisode}
                    onChange={handleLiveEpisodeInputChange}
                    onKeyDown={handleSeasonEpisodeKeyDown}
                    className="w-9 h-7 bg-black/70 border border-zinc-700/80 focus:border-amber-500 rounded-lg text-center text-xs font-mono font-bold text-amber-400 outline-none transition-colors"
                    title={`Episode Number (1 to ${liveTargetSeasonEpisodes})`}
                    placeholder="1"
                  />
                  <div className="flex flex-col -space-y-0.5">
                    <button
                      type="button"
                      onClick={handleIncrementEpisode}
                      disabled={Number(inputEpisode) >= liveTargetSeasonEpisodes}
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Next Episode (Up Arrow)"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDecrementEpisode}
                      disabled={Number(inputEpisode) <= 1}
                      className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Previous Episode (Down Arrow)"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-zinc-500 pr-0.5 select-none">
                    /{liveTargetSeasonEpisodes}
                  </span>
                </div>

                {/* Dedicated Play Episode Button */}
                <button
                  type="button"
                  onClick={handlePlayCustomSeasonEpisode}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black font-mono font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
                  title={`Play Season ${inputSeason} Episode ${inputEpisode} immediately`}
                >
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>Play</span>
                </button>
              </div>
            )}

            {/* Fullscreen Button */}
            <button
              id="player-control-fullscreen-btn"
              type="button"
              onClick={handleFullscreen}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 hover:text-white border border-zinc-700 text-xs font-bold cursor-pointer transition-all active:scale-95 shadow-sm"
              title="Fullscreen Player (F)"
            >
              <Maximize2 className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline">Fullscreen</span>
            </button>
          </div>
        </div>

        {/* BOTTOM HUD STATUS BAR (EmbedMaster Connection Indicator) */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-900 text-xs text-zinc-500 font-mono">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-zinc-300 font-sans font-semibold">
              EmbedMaster Player Active
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-zinc-400 hidden sm:inline">
              Event: <strong className="text-amber-400">{lastEvent}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-[11px] hidden sm:inline">
              External Controls via Remote & Deck
            </span>
            <span className="text-amber-500/80 bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">
              PostMessage Connected
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
