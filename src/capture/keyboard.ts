// Layer:  L1 -- Web SDK
// File:   capture/keyboard.ts
// Role:   Captures keyboard TIMING only (IKI + dwell).
//         Key identity (e.key / e.code) is never placed in any emitted payload.
//         Sensitive fields are skipped entirely.
// Author: Youssef Emad

import { RawSignal, KeyboardSignal } from '../types';
import { nowMs } from '../utils/time';

/** Fields we never observe at all. */
const SENSITIVE_SELECTOR = [
  'input[type="password"]',
  'input[type="email"]',
  'input[type="tel"]',
  'input[autocomplete^="cc-"]',
  'input[autocomplete="one-time-code"]',
  '[data-certilayer-ignore]',
].join(',');

function isSensitive(t: EventTarget | null): boolean {
  return t instanceof Element && t.closest(SENSITIVE_SELECTOR) !== null;
}

/**
 * In-memory only, used to pair keydown with keyup for dwell time.
 * The map key is never emitted or stored anywhere.
 */
const keyDownTimes = new Map<string, number>();

/** Timestamp of the previous keydown event for IKI calculation. */
let lastKeyDownTs = 0;

/** Callback to emit captured signals. */
type Emitter = (signal: RawSignal) => void;

let emitter: Emitter | null = null;

/** Handler for keydown events. */
function onKeyDown(e: KeyboardEvent): void {
  if (!emitter || isSensitive(e.target)) return;

  const ts  = nowMs();
  const iki = lastKeyDownTs === 0 ? 0 : ts - lastKeyDownTs;

  keyDownTimes.set(e.code, ts);
  lastKeyDownTs = ts;

  const payload: KeyboardSignal = {
    backspace: e.key === 'Backspace', // boolean only, for error-correction rate
    down_ts:   ts,
    up_ts:     0,
    iki_ms:    iki,
  };

  emitter({ kind: 'keyboard', ts_ms: ts, data: payload as unknown as Record<string, unknown> });
}

/** Handler for keyup events — records dwell time. */
function onKeyUp(e: KeyboardEvent): void {
  if (!emitter) return;

  const downTs = keyDownTimes.get(e.code);
  if (downTs === undefined) return;
  keyDownTimes.delete(e.code);

  if (isSensitive(e.target)) return;

  const ts = nowMs();
  const payload: Partial<KeyboardSignal> = {
    down_ts: downTs,
    up_ts:   ts,
  };

  emitter({ kind: 'keyboard', ts_ms: ts, data: payload as Record<string, unknown> });
}

/** Start capturing keyboard events. */
export function startKeyboardCapture(emit: Emitter): void {
  emitter = emit;
  document.addEventListener('keydown', onKeyDown, { passive: true });
  document.addEventListener('keyup',   onKeyUp,   { passive: true });
}

/** Stop capturing keyboard events. */
export function stopKeyboardCapture(): void {
  emitter = null;
  document.removeEventListener('keydown', onKeyDown);
  document.removeEventListener('keyup',   onKeyUp);
  keyDownTimes.clear();
  lastKeyDownTs = 0;
}
