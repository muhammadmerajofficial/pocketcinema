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

  constructor() {
    this.init();
  }

  public init() {
    if (typeof window === 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // 1. Intercept window.open
    const originalOpen = window.open;
    const self = this;

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
            }
          }
        } catch (_) {}
      },
      true
    );

    // 3. History popstate listener for device / browser back button
    window.addEventListener('popstate', () => {
      // If we have opened ad/popup tabs, close them!
      if (self.openedWindows.size > 0) {
        self.closeAllOpenedTabs();
      }
      // Re-push state so user doesn't navigate away or reload the player
      try {
        window.history.pushState({ playerScreen: true }, '', window.location.href);
      } catch (_) {}
    });

    // 4. Initial history push state to catch hardware back button
    try {
      window.history.pushState({ playerScreen: true }, '', window.location.href);
    } catch (_) {}

    // 5. TV Remote Key Listener: Back / Return keys
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
          }
        }
      },
      true
    );

    // 6. Broadcast sync listener for remote 'close_tab' or 'back' commands
    syncManager.subscribe((msg) => {
      if (msg.type === 'PLAYER_COMMAND') {
        if (msg.command === 'close_tab' || msg.command === 'close_popups' || msg.command === 'back') {
          self.closeAllOpenedTabs();
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
    try {
      window.focus();
      const iframe = document.getElementById('embedmaster_iframe') as HTMLIFrameElement | null;
      if (iframe) {
        iframe.focus();
      }
    } catch (_) {}

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
