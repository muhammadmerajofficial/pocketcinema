import { CategoryType, MediaItem } from '../types';

export interface DisplaySyncState {
  currentItem: MediaItem | null;
  playingItem: MediaItem | null;
  serverIndex?: number;
  season?: number;
  episode?: number;
  activeCategory: CategoryType;
  searchQuery: string;
  selectedIndex: number;
  timestamp: number;
}

export type SyncMessage =
  | { type: 'STATE_UPDATE'; state: DisplaySyncState }
  | { type: 'SELECT_ITEM'; item: MediaItem; category?: CategoryType; index?: number }
  | { type: 'PLAY'; item: MediaItem; serverIndex?: number; season?: number; episode?: number }
  | { type: 'PLAYER_CONFIG'; serverIndex: number; season: number; episode: number }
  | { type: 'PLAYER_ACTION'; action: 'play' | 'preview' | 'next'; timestamp: number }
  | { type: 'PLAYER_COMMAND'; command: 'play' | 'pause' | 'seek' | 'rewind' | 'forward' | 'mute' | 'unmute' | 'volume' | 'fullscreen' | 'prev_ep' | 'next_ep' | 'stop'; value?: any; extra?: any; timestamp: number }
  | { type: 'PLAYER_STATUS'; isPlaying: boolean; currentTime: number; duration: number; volume: number; isMuted: boolean; activeSeason?: number; activeEpisode?: number; timestamp: number }
  | { type: 'CLOSE_PLAYER' }
  | { type: 'DISCONNECT'; timestamp?: number }
  | { type: 'CATEGORY_CHANGE'; category: CategoryType }
  | { type: 'SEARCH'; query: string }
  | { type: 'ROOM_UPDATE'; roomCode?: string; data?: any }
  | { type: 'REQUEST_STATE' };

const CHANNEL_NAME = 'cinema_live_display_sync_channel';
const STORAGE_KEY = 'cinema_display_sync_state';

class CinemaSyncManager {
  private channel: BroadcastChannel | null = null;
  private listeners: ((msg: SyncMessage) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data) {
            this.notifyListeners(event.data);
          }
        };
      } catch (err) {
        console.warn('[CinemaSyncManager] BroadcastChannel not supported:', err);
      }
    }
  }

  public broadcast(msg: SyncMessage) {
    // 1. Notify listeners in the CURRENT window/tab
    this.notifyListeners(msg);

    // 2. Broadcast to other windows/tabs in the same origin
    if (this.channel) {
      try {
        this.channel.postMessage(msg);
      } catch (err) {
        console.warn('[CinemaSyncManager] Broadcast post error:', err);
      }
    }
  }

  public subscribe(callback: (msg: SyncMessage) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(msg: SyncMessage) {
    for (const cb of this.listeners) {
      try {
        cb(msg);
      } catch (err) {
        console.error('[CinemaSyncManager] Listener error:', err);
      }
    }
  }

  public saveState(state: Partial<DisplaySyncState>) {
    if (typeof window === 'undefined') return;
    try {
      const current = this.getState() || {
        currentItem: null,
        playingItem: null,
        activeCategory: 'movies',
        searchQuery: '',
        selectedIndex: 0,
        timestamp: Date.now(),
      };
      const updated: DisplaySyncState = {
        ...current,
        ...state,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      this.broadcast({ type: 'STATE_UPDATE', state: updated });
    } catch (err) {
      console.warn('[CinemaSyncManager] saveState error:', err);
    }
  }

  public getState(): DisplaySyncState | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[CinemaSyncManager] getState error:', err);
    }
    return null;
  }
}

export const syncManager = new CinemaSyncManager();
