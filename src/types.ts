// Layer:  L1 -- Web SDK
// File:   src/types.ts
// Role:   All TypeScript types for the CertiLayer Web SDK.
// Author: Youssef Emad

/**
 * Configuration passed to CertiLayer.init().
 * Use your PUBLIC key here (certilayer_live_pk_...).
 * Never use your secret key in browser code.
 */
export interface CertiLayerConfig {
  apiKey:        string
  endpoint?:     string
  flushInterval?: number
  batchSize?:    number
  debug?:        boolean
}

/** Public SDK surface returned by init() */
export interface CertiLayerSDK {
  start(): void
  stop(): Promise<void>
  getSessionId(): string
  flush(): Promise<void>
}

/** A single captured behavioral signal */
export interface RawSignal {
  kind:  'keyboard' | 'mouse' | 'scroll' | 'navigation' | 'focus'
  ts_ms: number
  data:  Record<string, unknown>
}

/** Keyboard event signal — IKI + dwell time, no sensitive key values */
export interface KeyboardSignal {
  key:     string
  code:    string
  down_ts: number
  up_ts:   number
  iki_ms:  number
}

/** Mouse movement + click signal — velocity derived from position delta */
export interface MouseSignal {
  x:                 number
  y:                 number
  velocity:          number
  button:            number   // -1 = move, 0 = left, 1 = middle, 2 = right
  click_duration_ms: number
}

/** Scroll signal — delta, velocity, and page depth ratio */
export interface ScrollSignal {
  delta_y:     number
  delta_x:     number
  velocity:    number
  depth_ratio: number   // 0.0 – 1.0
}

/** Navigation signal — SPA page transitions and dwell duration */
export interface NavigationSignal {
  from_path:   string
  to_path:     string
  duration_ms: number
}

/**
 * Batch of signals sent to the L2 Ingestion Gateway.
 * org_id is resolved server-side from the API key.
 */
export interface EventBatch {
  session_id:  string
  org_id:      string
  sdk_type:    'web'
  captured_at: string
  signals:     RawSignal[]
}
