// Layer:  L1 -- Web SDK
// File:   capture/mouse.ts
// Role:   Captures mouse movement + click events with velocity calculation.
//         Throttled to MOUSE_THROTTLE_MS for performance.
// Author: Youssef Emad

import { RawSignal, MouseSignal } from '../types';
import { MOUSE_THROTTLE_MS } from '../config';
import { nowMs } from '../utils/time';

type Emitter = (signal: RawSignal) => void;

let emitter: Emitter | null = null;
let lastX       = 0;
let lastY       = 0;
let lastMoveTs  = 0;
let clickDownTs = 0;

function onMouseMove(e: MouseEvent): void {
  if (!emitter) return;

  const ts = nowMs();
  if (ts - lastMoveTs < MOUSE_THROTTLE_MS) return;

  const dt       = ts - lastMoveTs;
  const dx       = e.clientX - lastX;
  const dy       = e.clientY - lastY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const velocity = dt > 0 ? distance / dt : 0;

  lastX      = e.clientX;
  lastY      = e.clientY;
  lastMoveTs = ts;

  const payload: MouseSignal = {
    x: e.clientX,
    y: e.clientY,
    velocity,
    button: -1,
    click_duration_ms: 0,
  };

  emitter({ kind: 'mouse', ts_ms: ts, data: payload as unknown as Record<string, unknown> });
}

function onMouseDown(_e: MouseEvent): void {
  clickDownTs = nowMs();
}

function onMouseUp(e: MouseEvent): void {
  if (!emitter || clickDownTs === 0) return;

  const ts             = nowMs();
  const click_duration = ts - clickDownTs;
  clickDownTs          = 0;

  const payload: MouseSignal = {
    x: e.clientX,
    y: e.clientY,
    velocity: 0,
    button: e.button,
    click_duration_ms: click_duration,
  };

  emitter({ kind: 'mouse', ts_ms: ts, data: payload as unknown as Record<string, unknown> });
}

export function startMouseCapture(emit: Emitter): void {
  emitter = emit;
  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mousedown', onMouseDown, { passive: true });
  document.addEventListener('mouseup',   onMouseUp,   { passive: true });
}

export function stopMouseCapture(): void {
  emitter = null;
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mousedown', onMouseDown);
  document.removeEventListener('mouseup',   onMouseUp);
}
