// Layer:  L1 -- Web SDK
// File:   src/config.ts
// Role:   SDK constants and default configuration values.
// Author: Youssef Emad

/** L2 Ingestion Gateway endpoint */
export const DEFAULT_ENDPOINT           = 'https://ingest.certilayer.net'
/** Flush interval in ms — matches L2 worker batch window */
export const DEFAULT_FLUSH_INTERVAL_MS  = 5_000
/** Max signals per batch — keeps payloads under 50KB */
export const DEFAULT_BATCH_SIZE         = 50
/** sessionStorage key for persisting session ID across page loads */
export const SESSION_STORAGE_KEY        = '__cl_sid'
/** Public key prefix — safe to embed in browser/mobile code */
export const PUBLIC_KEY_PREFIX          = 'certilayer_live_pk_'
/** Secret key prefix — server-side only, never in browser */
export const SECRET_KEY_PREFIX          = 'certilayer_live_sk_'
/** Test public key prefix */
export const TEST_PUBLIC_KEY_PREFIX     = 'certilayer_test_pk_'
/** Any valid key must start with one of these */
export const API_KEY_PREFIX             = 'certilayer_'
/** Mouse move throttle — emit at most once per this interval (ms) */
export const MOUSE_THROTTLE_MS          = 50
/** Minimum scroll delta to emit a signal (px) — filters micro-jitter */
export const SCROLL_MIN_DELTA_PX        = 5
