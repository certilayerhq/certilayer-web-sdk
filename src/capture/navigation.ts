// Layer:  L1 -- Web SDK
// File:   capture/navigation.ts
// Role:   Captures page transitions + focus/blur events.
// Author: Youssef Emad

import { RawSignal, NavigationSignal } from '../types';
import { nowMs } from '../utils/time';

type Emitter = (signal: RawSignal) => void;

let emitter: Emitter | null = null;
let pageEntryTs  = 0;
let currentPath  = '';

function onVisibilityChange(): void {
  if (!emitter) return;

  const ts = nowMs();
  emitter({
    kind:   'focus',
    ts_ms:  ts,
    data:   { visible: document.visibilityState === 'visible' },
  });
}

function emitNavigation(toPath: string): void {
  if (!emitter) return;

  const ts           = nowMs();
  const duration_ms  = pageEntryTs > 0 ? ts - pageEntryTs : 0;

  const payload: NavigationSignal = {
    from_path:   currentPath,
    to_path:     toPath,
    duration_ms,
  };

  emitter({ kind: 'navigation', ts_ms: ts, data: payload as unknown as Record<string, unknown> });

  currentPath = toPath;
  pageEntryTs = ts;
}

// Intercept History API for SPA navigation
function patchHistory(): void {
  const originalPush    = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = (...args) => {
    originalPush(...args);
    emitNavigation(location.pathname);
  };

  history.replaceState = (...args) => {
    originalReplace(...args);
    emitNavigation(location.pathname);
  };

  window.addEventListener('popstate', () => emitNavigation(location.pathname));
}

export function startNavigationCapture(emit: Emitter): void {
  emitter     = emit;
  currentPath = location.pathname;
  pageEntryTs = nowMs();

  document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
  patchHistory();
}

export function stopNavigationCapture(): void {
  emitter = null;
  document.removeEventListener('visibilitychange', onVisibilityChange);
}
