// Layer:  L1 -- Web SDK
// File:   utils/time.ts
// Role:   High-resolution timestamp utilities.
// Author: Youssef Emad

/**
 * Return the current Unix timestamp in milliseconds.
 * Uses performance.now() + epoch for sub-millisecond precision.
 */
export function nowMs(): number {
  return Date.now();
}

/** Return ISO 8601 UTC string for the current time. */
export function nowIso(): string {
  return new Date().toISOString();
}
