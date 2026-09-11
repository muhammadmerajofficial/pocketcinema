/**
 * Smart TV (Android TV, Samsung Tizen, LG webOS) navigation & fullscreen utilities
 */

export function openFullscreen(targetElement: HTMLElement = document.documentElement): Promise<void> {
  const elem = targetElement as any;
  if (!elem) return Promise.resolve();

  try {
    if (elem.requestFullscreen) {
      return elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
      /* Safari / WebKit / Older TV WebViews */
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    } else if (elem.msRequestFullscreen) {
      /* IE / Edge */
      elem.msRequestFullscreen();
    }
  } catch (err) {
    // Ignore permissions/interaction block
  }
  return Promise.resolve();
}

export function closeFullscreen(): Promise<void> {
  const doc = document as any;
  try {
    if (doc.exitFullscreen) {
      return doc.exitFullscreen().catch(() => {});
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  } catch (err) {
    // Ignore
  }
  return Promise.resolve();
}

export function isFullscreenActive(): boolean {
  const doc = document as any;
  return !!(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

/**
 * Spatial D-Pad Navigation for Smart TV Remotes
 * Handles Arrow keys (37, 38, 39, 40), Enter (13), and Back keys (10009, 461, 27)
 */
export function registerTvDpadNavigation(options?: {
  onBack?: () => void;
  onPlayPauseToggle?: () => void;
  onSeekForward?: () => void;
  onSeekBackward?: () => void;
}) {
  const handleKeyDown = (e: KeyboardEvent) => {
    const keyCode = e.keyCode || e.which;

    // TV Media Play / Pause keys
    // 415: Play, 19: Pause, 179: MediaPlayPause, 413: Stop
    if (keyCode === 415 || keyCode === 19 || keyCode === 179) {
      e.preventDefault();
      options?.onPlayPauseToggle?.();
      return;
    }

    // Media Fast Forward (417, 176) & Rewind (412, 177)
    if (keyCode === 417 || keyCode === 176) {
      e.preventDefault();
      options?.onSeekForward?.();
      return;
    }
    if (keyCode === 412 || keyCode === 177) {
      e.preventDefault();
      options?.onSeekBackward?.();
      return;
    }

    // TV Back / Return keys: 10009 (Tizen), 461 (webOS), 27 (Escape), 8 (Backspace when not typing in input)
    if (keyCode === 10009 || keyCode === 461 || (keyCode === 27 && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName))) {
      e.preventDefault();
      if (options?.onBack) {
        options.onBack();
      }
      return;
    }

    // Spatial Arrow keys: 37: Left, 38: Up, 39: Right, 40: Down
    const isArrow = keyCode >= 37 && keyCode <= 40;
    if (!isArrow) {
      // Enter key (13) activates current element if focused
      if (keyCode === 13) {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body && typeof active.click === 'function') {
          active.click();
        }
      }
      return;
    }

    // Arrow navigation
    e.preventDefault();

    // Query all visible interactive candidates
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]'
      )
    ).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden' && window.getComputedStyle(el).display !== 'none';
    });

    if (focusable.length === 0) return;

    const current = document.activeElement as HTMLElement | null;
    if (!current || !focusable.includes(current)) {
      focusable[0]?.focus();
      return;
    }

    const currentRect = current.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2,
    };

    let bestCandidate: HTMLElement | null = null;
    let minDistance = Infinity;

    for (const candidate of focusable) {
      if (candidate === current) continue;
      const r = candidate.getBoundingClientRect();
      const candidateCenter = {
        x: r.left + r.width / 2,
        y: r.top + r.height / 2,
      };

      const dx = candidateCenter.x - currentCenter.x;
      const dy = candidateCenter.y - currentCenter.y;

      let isInDirection = false;
      let primaryDist = 0;
      let secondaryDist = 0;

      switch (keyCode) {
        case 37: // Left
          isInDirection = dx < -5;
          primaryDist = Math.abs(dx);
          secondaryDist = Math.abs(dy);
          break;
        case 39: // Right
          isInDirection = dx > 5;
          primaryDist = Math.abs(dx);
          secondaryDist = Math.abs(dy);
          break;
        case 38: // Up
          isInDirection = dy < -5;
          primaryDist = Math.abs(dy);
          secondaryDist = Math.abs(dx);
          break;
        case 40: // Down
          isInDirection = dy > 5;
          primaryDist = Math.abs(dy);
          secondaryDist = Math.abs(dx);
          break;
      }

      if (isInDirection) {
        // Weighted metric favoring orthogonal alignment
        const distance = primaryDist + secondaryDist * 2.5;
        if (distance < minDistance) {
          minDistance = distance;
          bestCandidate = candidate;
        }
      }
    }

    if (bestCandidate) {
      (bestCandidate as HTMLElement).focus();
      (bestCandidate as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  };

  window.addEventListener('keydown', handleKeyDown, { capture: true });
  return () => {
    window.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}
