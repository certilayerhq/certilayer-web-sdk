// Layer:  L1 -- Web SDK
// File:   utils/logger.ts
// Role:   Debug logger — only logs when debug mode is enabled.
// Author: Youssef Emad

let _debug = false;

/** Enable or disable debug logging. */
export function setDebug(enabled: boolean): void {
  _debug = enabled;
}

/** Log a debug message (only in debug mode). */
export function log(message: string, data?: unknown): void {
  if (!_debug) return;
  if (data !== undefined) {
    console.log(`[CertiLayer] ${message}`, data);
  } else {
    console.log(`[CertiLayer] ${message}`);
  }
}

/** Log a warning (always shown). */
export function warn(message: string): void {
  console.warn(`[CertiLayer] ${message}`);
}
