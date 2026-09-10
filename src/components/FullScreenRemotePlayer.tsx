import React, { useEffect, useRef, useState } from 'react';
import { MediaItem } from '../types';
import { ALL_PLAYER_SERVERS, formatEmbedMasterId } from '../utils/servers';
import { updateRemoteSession, QUICK_CONNECT_CODE } from '../services/remotePairing';
import { syncManager, SyncMessage } from '../utils/syncChannel';

interface FullScreenRemotePlayerProps {
  item: MediaItem;
  serverIndex: number;
  season: number;
  episode: number;
  pairingCode: string;
  latestCommand?: { command: string; value?: any; extra?: any; timestamp: number } | null;
  onExit?: () => void;
}

export const FullScreenRemotePlayer: React.FC<FullScreenRemotePlayerProps> = ({
  item,
  serverIndex,
  season,
  episode,
  pairingCode,
  latestCommand,
  onExit,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastBroadcastRef = useRef<number>(0);
  const lastExecutedCmdTimestampRef = useRef<number>(0);
  const localCurrentTimeRef = useRef<number>(0);
  const localDurationRef = useRef<number>(item.runtime ? item.runtime * 60 : 7200);
  const localIsPlayingRef = useRef<boolean>(true);
  const [isIframeLoaded, setIsIframeLoaded] = useState(false);

  // Active session code fallback to ensure updates always go through to Firebase
  const effectivePairingCode = pairingCode || (typeof window !== 'undefined' ? localStorage.getItem('cinematic_paired_code') : '') || QUICK_CONNECT_CODE;

  // Selected server (EmbedMaster is Server 0)
  const currentServer = ALL_PLAYER_SERVERS[serverIndex] || ALL_PLAYER_SERVERS[0];

  let playerUrl = '';
  if (item.category === 'movies') {
    playerUrl = currentServer.getMovieUrl(item.id, {
      skin: 'onyx',
      welcomePage: 'off',
      autoplay: 'on',
    });
  } else if (item.category === 'anime') {
    playerUrl = currentServer.getAnimeUrl(item.id, season || 1, episode || 1, {
      skin: 'onyx',
      welcomePage: 'off',
      autoplay: 'on',
    });
  } else {
    playerUrl = currentServer.getTvUrl(item.id, season || 1, episode || 1, {
      skin: 'onyx',
      welcomePage: 'off',
      autoplay: 'on',
    });
  }

  // Exhaustive helper to send player commands using PlayerJS, player.js, JWPlayer, and EmbedMaster protocols
  const sendCommandToIframe = (command: string, value?: any, extra?: any) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    const cw = iframe.contentWindow;

    try {
      if (command === 'play') {
        localIsPlayingRef.current = true;
        // 1. PlayerJS API (raw string, json string, and object)
        cw.postMessage('play', '*');
        cw.postMessage({ api: 'play' }, '*');
        cw.postMessage(JSON.stringify({ api: 'play' }), '*');
        cw.postMessage('{"api":"play"}', '*');
        // 2. Player.js specification
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'play' }, '*');
        cw.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'play' }), '*');
        // 3. Generic / JWPlayer / VideoJS
        cw.postMessage({ event: 'command', func: 'play', args: [] }, '*');
        cw.postMessage({ action: 'play' }, '*');
        cw.postMessage({ type: 'play' }, '*');
      } else if (command === 'pause') {
        localIsPlayingRef.current = false;
        // 1. PlayerJS API (raw string, json string, and object)
        cw.postMessage('pause', '*');
        cw.postMessage({ api: 'pause' }, '*');
        cw.postMessage(JSON.stringify({ api: 'pause' }), '*');
        cw.postMessage('{"api":"pause"}', '*');
        // 2. Player.js specification
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'pause' }, '*');
        cw.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'pause' }), '*');
        // 3. Generic / JWPlayer / VideoJS
        cw.postMessage({ event: 'command', func: 'pause', args: [] }, '*');
        cw.postMessage({ action: 'pause' }, '*');
        cw.postMessage({ type: 'pause' }, '*');
      } else if (command === 'stop') {
        localIsPlayingRef.current = false;
        cw.postMessage('pause', '*');
        cw.postMessage({ api: 'pause' }, '*');
        cw.postMessage(JSON.stringify({ api: 'pause' }), '*');
        cw.postMessage('{"api":"pause"}', '*');
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'pause' }, '*');
        cw.postMessage({ event: 'command', func: 'pause', args: [] }, '*');
      } else if (command === 'seek') {
        const targetSec = Math.max(0, Number(value) || 0);
        localCurrentTimeRef.current = targetSec;

        // 1. PlayerJS seek & time commands (object and JSON string)
        cw.postMessage({ api: 'seek', set: targetSec }, '*');
        cw.postMessage({ api: 'time', set: targetSec }, '*');
        cw.postMessage(JSON.stringify({ api: 'seek', set: targetSec }), '*');
        cw.postMessage(JSON.stringify({ api: 'time', set: targetSec }), '*');
        cw.postMessage(`seek:${targetSec}`, '*');
        cw.postMessage(`time:${targetSec}`, '*');

        // Relative delta (e.g. forward 10 or rewind 10)
        if (typeof extra === 'number') {
          const delta = extra;
          const deltaCmd = delta > 0 ? 'forward' : 'rewind';
          const absVal = Math.abs(delta);
          cw.postMessage({ api: deltaCmd, set: absVal }, '*');
          cw.postMessage(JSON.stringify({ api: deltaCmd, set: absVal }), '*');
          cw.postMessage(`${deltaCmd}:${absVal}`, '*');
        }

        // 2. Player.js specification
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'setCurrentTime', value: targetSec }, '*');
        cw.postMessage(JSON.stringify({ context: 'player.js', version: '0.0.11', method: 'setCurrentTime', value: targetSec }), '*');

        // 3. JWPlayer / VideoJS / HTML5 Generic
        cw.postMessage({ event: 'command', func: 'seek', args: [targetSec] }, '*');
        cw.postMessage({ action: 'seek', time: targetSec }, '*');
        cw.postMessage({ type: 'seek', time: targetSec }, '*');
      } else if (command === 'volume') {
        const vol = Number(value);
        cw.postMessage({ api: 'volume', set: vol / 100 }, '*');
        cw.postMessage({ api: 'volume', set: vol }, '*');
        cw.postMessage(JSON.stringify({ api: 'volume', set: vol / 100 }), '*');
        cw.postMessage(JSON.stringify({ api: 'volume', set: vol }), '*');
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'setVolume', value: vol / 100 }, '*');
      } else if (command === 'mute') {
        cw.postMessage('mute', '*');
        cw.postMessage({ api: 'mute' }, '*');
        cw.postMessage(JSON.stringify({ api: 'mute' }), '*');
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'mute' }, '*');
      } else if (command === 'unmute') {
        cw.postMessage('unmute', '*');
        cw.postMessage({ api: 'unmute' }, '*');
        cw.postMessage(JSON.stringify({ api: 'unmute' }), '*');
        cw.postMessage({ context: 'player.js', version: '0.0.11', method: 'unmute' }, '*');
      }

      // Legacy fallback
      cw.postMessage(
        {
          source: 'embedmaster_player_command',
          command,
          value,
          extra,
        },
        '*'
      );
    } catch (err) {
      console.warn('[FullScreenRemotePlayer] sendCommandToIframe error:', err);
    }
  };

  // Dispatch execution and handle Stop / Exit
  const executePlayerCommand = (command: string, value?: any, extra?: any) => {
    if (command === 'stop') {
      sendCommandToIframe('stop');
      onExit?.();
      return;
    }

    if (command === 'fullscreen') {
      try {
        if (!document.fullscreenElement) {
          containerRef.current?.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      } catch (_) {}
      sendCommandToIframe('fullscreen');
      return;
    }

    if (command === 'rewind') {
      const delta = typeof extra === 'number' ? extra : -10;
      const targetSec = Math.max(0, localCurrentTimeRef.current + delta);
      localCurrentTimeRef.current = targetSec;
      sendCommandToIframe('seek', targetSec, delta);
      const now = Date.now();
      const statusData = {
        isPlaying: localIsPlayingRef.current,
        currentTime: targetSec,
        duration: localDurationRef.current,
        volume: 100,
        isMuted: false,
        activeSeason: season,
        activeEpisode: episode,
        timestamp: now,
      };
      syncManager.broadcast({ type: 'PLAYER_STATUS', ...statusData });
      if (pairingCode) {
        updateRemoteSession(pairingCode, { playerStatus: statusData });
      }
      return;
    }

    if (command === 'forward') {
      const delta = typeof extra === 'number' ? extra : 10;
      const targetSec = Math.min(localDurationRef.current, localCurrentTimeRef.current + delta);
      localCurrentTimeRef.current = targetSec;
      sendCommandToIframe('seek', targetSec, delta);
      const now = Date.now();
      const statusData = {
        isPlaying: localIsPlayingRef.current,
        currentTime: targetSec,
        duration: localDurationRef.current,
        volume: 100,
        isMuted: false,
        activeSeason: season,
        activeEpisode: episode,
        timestamp: now,
      };
      syncManager.broadcast({ type: 'PLAYER_STATUS', ...statusData });
      if (pairingCode) {
        updateRemoteSession(pairingCode, { playerStatus: statusData });
      }
      return;
    }

    if (command === 'play') {
      localIsPlayingRef.current = true;
    } else if (command === 'pause') {
      localIsPlayingRef.current = false;
    } else if (command === 'seek') {
      localIsPlayingRef.current = true;
      sendCommandToIframe('play');
    }

    sendCommandToIframe(command, value, extra);

    // If play, pause, or seek, broadcast status immediately so controller stays perfectly in sync
    if (command === 'play' || command === 'pause' || command === 'seek') {
      const now = Date.now();
      const statusData = {
        isPlaying: localIsPlayingRef.current,
        currentTime: command === 'seek' ? (Number(value) || 0) : localCurrentTimeRef.current,
        duration: localDurationRef.current,
        volume: 100,
        isMuted: false,
        activeSeason: season,
        activeEpisode: episode,
        timestamp: now,
      };
      syncManager.broadcast({ type: 'PLAYER_STATUS', ...statusData });
      if (pairingCode) {
        updateRemoteSession(pairingCode, { playerStatus: statusData });
      }
    }
  };

  // 1. React to latestCommand passed from Firebase snapshot in LiveDisplayScreen
  useEffect(() => {
    if (!latestCommand || typeof latestCommand.timestamp !== 'number') return;
    if (latestCommand.timestamp === lastExecutedCmdTimestampRef.current) return;
    lastExecutedCmdTimestampRef.current = latestCommand.timestamp;
    executePlayerCommand(latestCommand.command, latestCommand.value, latestCommand.extra);
  }, [latestCommand]);

  // 2. Listen for BroadcastChannel commands (for same-tab / local testing)
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((msg: SyncMessage) => {
      if (msg.type === 'PLAYER_COMMAND') {
        const { command, value, extra, timestamp } = msg;
        if (timestamp && timestamp === lastExecutedCmdTimestampRef.current) return;
        if (timestamp) lastExecutedCmdTimestampRef.current = timestamp;
        executePlayerCommand(command, value, extra);
      } else if (msg.type === 'CLOSE_PLAYER') {
        executePlayerCommand('stop');
      }
    });
    return () => unsubscribe();
  }, [pairingCode, season, episode]);

  // 3. Listen to postMessage events coming from the player iframe and sync back to Firebase
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data = event.data;
      if (!data) return;

      let isPlay: boolean | null = null;
      let currTime: number | null = null;
      let dur: number | null = null;
      let vol: number | null = null;
      let isMuted: boolean | null = null;

      // Handle raw string events from PlayerJS like "play", "pause", "time:12.3", "duration:540", "init"
      if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed === 'play') {
          isPlay = true;
        } else if (trimmed === 'pause') {
          isPlay = false;
        } else if (trimmed.startsWith('time:')) {
          currTime = parseFloat(trimmed.substring(5));
        } else if (trimmed.startsWith('duration:')) {
          dur = parseFloat(trimmed.substring(9));
        } else {
          try {
            data = JSON.parse(trimmed);
          } catch (_) {
            return;
          }
        }
      }

      if (typeof data === 'object' && data !== null) {
        if (data.source === 'embedmaster_player') {
          if (data.event === 'play') isPlay = true;
          if (data.event === 'pause') isPlay = false;
          if (typeof data.info?.time === 'number') currTime = data.info.time;
          if (typeof data.info?.duration === 'number') dur = data.info.duration;
          if (typeof data.info?.volume === 'number') vol = data.info.volume;
          if (typeof data.info?.muted === 'boolean') isMuted = data.info.muted;
        } else if (data.event) {
          // PlayerJS / Player.js events
          if (data.event === 'play') isPlay = true;
          if (data.event === 'pause') isPlay = false;
          if (typeof data.time === 'number') currTime = data.time;
          if (typeof data.duration === 'number') dur = data.duration;
          if (typeof data.data?.seconds === 'number') currTime = data.data.seconds;
          if (typeof data.data?.duration === 'number') dur = data.data.duration;
        } else if (data.api) {
          if (data.api === 'play') isPlay = true;
          if (data.api === 'pause') isPlay = false;
          if (typeof data.set === 'number') currTime = data.set;
        }
      }

      if (isPlay !== null) localIsPlayingRef.current = isPlay;
      if (currTime !== null && !isNaN(currTime)) localCurrentTimeRef.current = currTime;
      if (dur !== null && !isNaN(dur) && dur > 0) localDurationRef.current = dur;

      const now = Date.now();
      const isPlayPause = isPlay !== null;

      // Throttle status broadcasts to avoid spamming
      if (now - lastBroadcastRef.current > 750 || isPlayPause) {
        lastBroadcastRef.current = now;

        const statusData = {
          isPlaying: localIsPlayingRef.current,
          currentTime: localCurrentTimeRef.current,
          duration: localDurationRef.current,
          volume: vol !== null ? vol : 100,
          isMuted: isMuted !== null ? isMuted : false,
          activeSeason: season,
          activeEpisode: episode,
          timestamp: now,
        };

        syncManager.broadcast({
          type: 'PLAYER_STATUS',
          ...statusData,
        });

        if (pairingCode) {
          updateRemoteSession(pairingCode, {
            playerStatus: statusData,
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [pairingCode, season, episode]);

  // 4. Background heartbeat ticker: when iframe is loaded and playing, tick time and sync every 2 seconds
  useEffect(() => {
    if (!isIframeLoaded) return;
    const interval = setInterval(() => {
      if (localIsPlayingRef.current) {
        localCurrentTimeRef.current += 1;
        const now = Date.now();
        if (now - lastBroadcastRef.current >= 2000) {
          lastBroadcastRef.current = now;
          const statusData = {
            isPlaying: true,
            currentTime: localCurrentTimeRef.current,
            duration: localDurationRef.current,
            volume: 100,
            isMuted: false,
            activeSeason: season,
            activeEpisode: episode,
            timestamp: now,
          };
          syncManager.broadcast({ type: 'PLAYER_STATUS', ...statusData });
          if (pairingCode) {
            updateRemoteSession(pairingCode, { playerStatus: statusData });
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isIframeLoaded, pairingCode, season, episode]);

  // Request fullscreen on video load if supported
  useEffect(() => {
    // Keep screen awake via Screen Wake Lock API
    let wakeLockSentinel: any = null;
    if ('wakeLock' in navigator && (navigator as any).wakeLock) {
      (navigator as any).wakeLock.request('screen').then((lock: any) => {
        wakeLockSentinel = lock;
      }).catch(() => {});
    }

    return () => {
      if (wakeLockSentinel) wakeLockSentinel.release().catch(() => {});
    };
  }, []);

  // Force play & 100% full volume on any user touch/click/keypress to bypass browser audio restrictions
  useEffect(() => {
    const handleGesture = () => {
      sendCommandToIframe('volume', 100);
      sendCommandToIframe('unmute');
      sendCommandToIframe('play');
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);
    window.addEventListener('touchstart', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      id="remote-fullscreen-player-canvas"
      className="fixed inset-0 w-screen h-screen z-[9999] bg-black overflow-hidden flex items-center justify-center m-0 p-0"
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
      }}
    >
      {/* 
        EmbedMaster 100% Full-Screen Video Canvas
        Strictly NO controls, NO overlays, NO buttons on top of player
      */}
      <iframe
        ref={iframeRef}
        id="embedmaster_iframe"
        key={`${item.id}-${serverIndex}-${season}-${episode}`}
        src={playerUrl}
        title={item.title}
        className="w-full h-full border-0 bg-black block"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
        }}
        allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
        allowFullScreen
        onLoad={() => {
          setIsIframeLoaded(true);
          // Auto-trigger volume 100% and play commands immediately on load
          sendCommandToIframe('volume', 100);
          sendCommandToIframe('unmute');
          sendCommandToIframe('play');
          setTimeout(() => {
            sendCommandToIframe('volume', 100);
            sendCommandToIframe('unmute');
            sendCommandToIframe('play');
          }, 400);
          setTimeout(() => {
            sendCommandToIframe('volume', 100);
            sendCommandToIframe('play');
          }, 1200);
          setTimeout(() => {
            sendCommandToIframe('volume', 100);
            sendCommandToIframe('play');
          }, 2400);
        }}
      />
    </div>
  );
};
