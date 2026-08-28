// Layer:  L1 -- Web SDK
// File:   capture/keyboard.ts
// Role:   Captures keyboard events — keydown/keyup timing for IKI + dwell.
//         Never captures key values for sensitive fields (password, email).
// Author: Youssef Emad

import { RawSignal, KeyboardSignal } from '../types';
import { nowMs } from '../utils/time';

/** Sensitive input types — never capture key values from these. */
const SENSITIVE_TYPES = new Set(['password', 'email', 'tel', 'credit-card']);

/** Track keydown timestamps per key for dwell time calculation. */
const keyDownTimes = new Map<string, number>();

/** Timestamp of the previous keydown event for IKI calculation. */
let lastKeyDownTs = 0;

/** Callback to emit captured signals. */
type Emitter = (signal: RawSignal) => void;

let emitter: Emitter | null = null;

/** Handler for keydown events. */
function onKeyDown(e: KeyboardEvent): void {
  if (!emitter) return;

  const target = e.target as HTMLInputElement | null;
  const inputType = target?.type ?? '';

  // Never capture key identity from sensitive fields
  const key  = SENSITIVE_TYPES.has(inputType) ? '[redacted]' : e.key;
  const code = SENSITIVE_TYPES.has(inputType) ? '[redacted]' : e.code;

  const ts  = nowMs();
  const iki = lastKeyDownTs === 0 ? 0 : ts - lastKeyDownTs;

  keyDownTimes.set(e.code, ts);
  lastKeyDownTs = ts;

  const payload: KeyboardSignal = {
    key,
    code,
    down_ts:     ts,
    up_ts:       0,
    iki_ms:      iki,
  };

  emitter({ kind: 'keyboard', ts_ms: ts, data: payload as unknown as Record<string, unknown> });
}

/** Handler for keyup events — records dwell time. */
function onKeyUp(e: KeyboardEvent): void {
  if (!emitter) return;

  const downTs = keyDownTimes.get(e.code);
  if (downTs === undefined) return;

  const ts = nowMs();
  keyDownTimes.delete(e.code);

  // Emit a dwell update — same key, now with up_ts filled
  const payload: Partial<KeyboardSignal> = {
    code:   e.code,
    up_ts:  ts,
    down_ts: downTs,
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
