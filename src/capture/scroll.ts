// Layer:  L1 -- Web SDK
// File:   capture/scroll.ts
// Role:   Captures scroll velocity + depth ratio.
// Author: Youssef Emad

import { RawSignal, ScrollSignal } from '../types';
import { SCROLL_MIN_DELTA_PX } from '../config';
import { nowMs } from '../utils/time';

type Emitter = (signal: RawSignal) => void;

let emitter: Emitter | null = null;
let lastScrollTs  = 0;
let lastScrollY   = 0;

function onScroll(): void {
  if (!emitter) return;

  const ts      = nowMs();
  const scrollY = window.scrollY;
  const deltaY  = scrollY - lastScrollY;

  if (Math.abs(deltaY) < SCROLL_MIN_DELTA_PX) return;

  const dt       = ts - lastScrollTs;
  const velocity = dt > 0 ? Math.abs(deltaY) / dt : 0;

  // Depth ratio: how far down the page the user has scrolled
  const maxScroll  = document.body.scrollHeight - window.innerHeight;
  const depthRatio = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0;

  lastScrollY  = scrollY;
  lastScrollTs = ts;

  const payload: ScrollSignal = {
    delta_y:     deltaY,
    delta_x:     0,
    velocity,
    depth_ratio: depthRatio,
  };

  emitter({ kind: 'scroll', ts_ms: ts, data: payload as unknown as Record<string, unknown> });
}

export function startScrollCapture(emit: Emitter): void {
  emitter      = emit;
  lastScrollY  = window.scrollY;
  lastScrollTs = nowMs();
  window.addEventListener('scroll', onScroll, { passive: true });
}

export function stopScrollCapture(): void {
  emitter = null;
  window.removeEventListener('scroll', onScroll);
}
