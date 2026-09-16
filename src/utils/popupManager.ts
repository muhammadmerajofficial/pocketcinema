/**
 * Global Popup & New Tab Manager
 * Intercepts new window / tab openings from video player ad triggers,
 * tracks them, and enables instant closing on Back button from any device or remote,
 * while preventing player reloads.
 */

import { syncManager } from './syncChannel';

class PopupManager {
  private openedWindows: Set<Window> = new Set();
  private isInitialized = false;
  private lastInteractionTime = 0;

  constructor() {
    this.init();
  }

  public init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    const self = this;

    // Record user interactions to detect if window.blur is caused by ad clicks
    const markInteraction = () => {
      self.lastInteractionTime = Date.now();
    };
    window.addEventListener('pointerdown', markInteraction, { capture: true, passive: true });
    window.addEventListener('touchstart', markInteraction, { capture: true, passive: true });
    window.addEventListener('click', markInteraction, { capture: true, passive: true });
    window.addEventListener('keydown', markInteraction, { capture: true, passive: true });

    // 1. Intercept window.open
    const originalOpen = window.open;

    window.open = function (...args) {
      try {
        const urlStr = args[0] ? String(args[0]) : '';
        // CRITICAL: NEVER register internal app pages or TV Screen as an ad popup!
        const isTvOrInternal =
          urlStr.includes('view=tv') ||
          urlStr.includes('view=display') ||
          urlStr.includes('view=screen') ||
          urlStr.includes('/tv') ||
          urlStr.includes('room=') ||
          urlStr.includes('cinematic') ||
          (typeof window !== 'undefined' && urlStr.includes(window.location.host));

        const newWin = originalOpen.apply(this, args as any);
        if (newWin && !isTvOrInternal) {
          self.openedWindows.add(newWin);

          // Push an ad history state so mobile back button pops this first and closes the ad!
          try {
            window.history.pushState({ isAdPopup: true, timestamp: Date.now() }, '', window.location.href);
          } catch (_) {}

          // Broadcast tab opened event across all paired devices / tabs
          try {
            syncManager.broadcast({
              type: 'PLAYER_COMMAND',
              command: 'tab_opened',
              timestamp: Date.now(),
            });
          } catch (_) {}
        }
        return newWin;
      } catch (err) {
        return originalOpen.apply(this, args as any);
      }
    };

    // 2. Intercept target="_blank" clicks in document
    document.addEventListener(
      'click',
      (e) => {
        try {
          const target = (e.target as HTMLElement)?.closest('a');
          if (target && target.getAttribute('target') === '_blank') {
            const href = target.getAttribute('href') || '';
            const isTvOrInternal =
              href.includes('view=tv') ||
              href.includes('view=display') ||
              href.includes('view=screen') ||
              href.includes('/tv') ||
              href.includes('room=') ||
              target.id === 'header-tv-player-btn' ||
              (typeof window !== 'undefined' && href.includes(window.location.host));

            // If it's the TV Screen button or internal view, let it open normally without being tracked as an ad popup!
            if (isTvOrInternal) {
              return;
            }

            if (href && !href.startsWith('javascript:')) {
              e.preventDefault();
              const win = window.open(href, '_blank');
              if (win) {
                self.openedWindows.add(win);
              }
              try {
                window.history.pushState({ isAdPopup: true, timestamp: Date.now() }, '', window.location.href);
              } catch (_) {}
            }
          }
        } catch (_) {}
      },
      true
    );

    // 3. Detect when iframe ad opens a new window/tab (window blur right after user interaction)
    window.addEventListener('blur', () => {
      if (Date.now() - self.lastInteractionTime < 3500) {
        try {
          window.history.pushState({ isAdPopup: true, timestamp: Date.now() }, '', window.location.href);
        } catch (_) {}
      }
    });

    // 4. History popstate listener for device / mobile back button
    window.addEventListener('popstate', (e) => {
      // If mobile back button is pressed, immediately close all opened ad popups/tabs
      self.closeAllOpenedTabs();

      // Refresh history state so browser stays on the player page without reloading or navigating away
      try {
        window.history.pushState({ playerScreen: true, timestamp: Date.now() }, '', window.location.href);
      } catch (_) {}

      // Keep player actively playing right where it was
      self.resumePlayerPlayback();
    });

    // 5. Initial history push state to trap hardware back button
    try {
      window.history.pushState({ playerScreen: true, timestamp: Date.now() }, '', window.location.href);
    } catch (_) {}

    // 6. When app regains focus or visibility, close any opened ad tabs automatically & resume video
    window.addEventListener('focus', () => {
      if (self.openedWindows.size > 0) {
        self.closeAllOpenedTabs();
      }
      self.resumePlayerPlayback();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        if (self.openedWindows.size > 0) {
          self.closeAllOpenedTabs();
        }
        self.resumePlayerPlayback();
      }
    });

    // 7. TV Remote Key Listener: Back / Return keys
    window.addEventListener(
      'keydown',
      (e) => {
        const keyCode = e.keyCode || e.which;
        // 10009: Samsung Tizen Return, 461: LG webOS Back, 27: Escape, 8: Backspace (when not in input)
        const isBackKey =
          keyCode === 10009 ||
          keyCode === 461 ||
          e.key === 'Back' ||
          e.key === 'BrowserBack' ||
          e.key === 'GoBack' ||
          (keyCode === 27 && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName));

        if (isBackKey) {
          // If any ad popup tabs were opened, close them on back press
          if (self.hasOpenedTabs()) {
            e.preventDefault();
            e.stopPropagation();
            self.closeAllOpenedTabs();
            self.resumePlayerPlayback();
          }
        }
      },
      true
    );

    // 8. Broadcast sync listener for remote 'close_tab' or 'back' commands
    syncManager.subscribe((msg) => {
      if (msg.type === 'PLAYER_COMMAND') {
        if (msg.command === 'close_tab' || msg.command === 'close_popups' || msg.command === 'back') {
          self.closeAllOpenedTabs();
          self.resumePlayerPlayback();
        }
      }
    });
  }

  public registerWindow(win: Window) {
    if (win) {
      this.openedWindows.add(win);
    }
  }

  public hasOpenedTabs(): boolean {
    // Clean up already closed windows
    for (const win of this.openedWindows) {
      try {
        if (win.closed) {
          this.openedWindows.delete(win);
        }
      } catch (_) {
        this.openedWindows.delete(win);
      }
    }
    return this.openedWindows.size > 0;
  }

  public resumePlayerPlayback() {
    try {
      window.focus();
      const iframe = document.getElementById('embedmaster_iframe') as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        iframe.focus();
        // Send play/resume commands to EmbedMaster & PlayerJS postMessage APIs
        iframe.contentWindow.postMessage({ event: 'command', command: 'play' }, '*');
        iframe.contentWindow.postMessage({ api: 'play' }, '*');
        iframe.contentWindow.postMessage('{"event":"command","command":"play"}', '*');
        iframe.contentWindow.postMessage('{"api":"play"}', '*');
      }
    } catch (_) {}
  }

  public closeAllOpenedTabs(): boolean {
    let closedAny = false;
    for (const win of this.openedWindows) {
      try {
        if (win && !win.closed) {
          // Extra safety guard: NEVER close TV Screen or app-internal page
          try {
            const href = win.location?.href || '';
            if (
              href.includes('view=tv') ||
              href.includes('view=display') ||
              href.includes('view=screen') ||
              href.includes('/tv') ||
              (typeof window !== 'undefined' && href.includes(window.location.host))
            ) {
              continue;
            }
          } catch (_) {}

          win.close();
          closedAny = true;
        }
      } catch (err) {
        console.warn('[PopupManager] win.close error:', err);
      }
    }
    this.openedWindows.clear();

    // Re-focus current window and iframe so player stays completely interactive without reload
    this.resumePlayerPlayback();

    // Broadcast to other paired devices / screens
    try {
      syncManager.broadcast({
        type: 'PLAYER_COMMAND',
        command: 'tabs_closed',
        timestamp: Date.now(),
      });
    } catch (_) {}

    return closedAny;
  }
}

export const popupManager = new PopupManager();
