// Layer:  L1 -- Web SDK
// File:   src/index.ts
// Role:   CertiLayer Web SDK public API entry point.
//         Initializes capture, buffer, and transport layers.
// Author: Youssef Emad
//
// Usage:
//   <script src="certilayer.min.js"></script>
//   <script>
//     CertiLayer.init({ apiKey: 'certilayer_live_pk_xxx' }) // PUBLIC key only
//   </script>

import { CertiLayerConfig, CertiLayerSDK, RawSignal } from './types';
import {
  DEFAULT_ENDPOINT,
  DEFAULT_FLUSH_INTERVAL_MS,
  DEFAULT_BATCH_SIZE,
  SESSION_STORAGE_KEY,
  API_KEY_PREFIX,
  SECRET_KEY_PREFIX,
} from './config';
import { startKeyboardCapture,  stopKeyboardCapture  } from './capture/keyboard';
import { startMouseCapture,     stopMouseCapture     } from './capture/mouse';
import { startScrollCapture,    stopScrollCapture    } from './capture/scroll';
import { startNavigationCapture,stopNavigationCapture} from './capture/navigation';
import { EventBuffer } from './buffer/event_buffer';
import { sendBatch, sendBeacon } from './transport/sender';
import { uuidv4 } from './utils/uuid';
import { setDebug, log, warn } from './utils/logger';
import { computeFeatureVector } from './normalizer/index';
import { showBadge, hideBadge } from './badge';

// ── Internal state ────────────────────────────────────────────────────────────

let _config: Required<CertiLayerConfig> | null = null;
let _sessionId  = '';
let _buffer: EventBuffer | null = null;
let _flushTimer: ReturnType<typeof setInterval> | null = null;
let _running    = false;
let _sessionStartTs = 0;

// ── Session ID ────────────────────────────────────────────────────────────────

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = uuidv4();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    // sessionStorage blocked (e.g. incognito with strict settings)
    return uuidv4();
  }
}

// ── Signal emitter ────────────────────────────────────────────────────────────

function emit(signal: RawSignal): void {
  if (!_buffer) return;
  _buffer.push(signal);
}

// ── Flush ─────────────────────────────────────────────────────────────────────

async function flush(): Promise<void> {
  if (!_config || !_buffer || _buffer.isEmpty) return;

  const signals = _buffer.drain(_config.batchSize);
  if (signals.length === 0) return;

  // Compute the 34-dim feature vector before sending to L2.
  // L2 Gateway expects `features` — raw signals are kept for audit only.
  const sessionDurationMs = _sessionStartTs > 0 ? Date.now() - _sessionStartTs : 0;
  const features = computeFeatureVector(signals, sessionDurationMs);

  const batch = {
    session_id:  _sessionId,
    org_id:      '', // resolved server-side from API key
    sdk_type:    'web' as const,
    captured_at: new Date().toISOString(),
    signals,
    features,
  };

  await sendBatch(_config.endpoint, _config.apiKey, batch);
}

// ── Beacon flush on unload ────────────────────────────────────────────────────

function onUnload(): void {
  if (!_config || !_buffer || _buffer.isEmpty) return;

  const signals = _buffer.drain();
  if (signals.length === 0) return;

  // Compute features on unload as well — beacon sends the full enriched batch.
  const sessionDurationMs = _sessionStartTs > 0 ? Date.now() - _sessionStartTs : 0;
  const features = computeFeatureVector(signals, sessionDurationMs);

  const batch = {
    session_id:  _sessionId,
    org_id:      '',
    sdk_type:    'web' as const,
    captured_at: new Date().toISOString(),
    signals,
    features,
  };

  sendBeacon(_config.endpoint, _config.apiKey, batch);
}

// ── Public API ────────────────────────────────────────────────────────────────

const sdk: CertiLayerSDK = {
  start(): void {
    if (_running) {
      warn('CertiLayer already running');
      return;
    }
    if (!_config) {
      warn('CertiLayer not initialized — call CertiLayer.init() first');
      return;
    }

    _running = true;
    log('Starting capture', { sessionId: _sessionId });

    startKeyboardCapture(emit);
    startMouseCapture(emit);
    startScrollCapture(emit);
    startNavigationCapture(emit);

    // Periodic flush
    _flushTimer = setInterval(() => {
      void flush();
    }, _config.flushInterval);

    // Flush remaining events on page unload
    window.addEventListener('pagehide', onUnload);
    window.addEventListener('beforeunload', onUnload);
  },

  async stop(): Promise<void> {
    if (!_running) return;
    _running = false;

    stopKeyboardCapture();
    stopMouseCapture();
    stopScrollCapture();
    stopNavigationCapture();

    if (_flushTimer !== null) {
      clearInterval(_flushTimer);
      _flushTimer = null;
    }

    window.removeEventListener('pagehide', onUnload);
    window.removeEventListener('beforeunload', onUnload);

    await flush();
    log('Stopped');
  },

  getSessionId(): string {
    return _sessionId;
  },

  async flush(): Promise<void> {
    await flush();
  },
};

// ── init() ────────────────────────────────────────────────────────────────────

/**
 * Initialize the CertiLayer SDK.
 *
 * Only ever pass your PUBLIC key here — this SDK runs in the visitor's
 * browser and anyone can view-source it. Never pass your secret key
 * (certilayer_live_sk_...); that key is server-side only.
 *
 * @param config - SDK configuration options.
 * @returns The SDK instance with start/stop/flush methods.
 *
 * @example
 * const cl = CertiLayer.init({ apiKey: 'certilayer_live_pk_xxx' })
 * cl.start()
 */
export function init(config: CertiLayerConfig): CertiLayerSDK {
  if (config.apiKey.startsWith(SECRET_KEY_PREFIX)) {
    throw new Error(
      'CertiLayer: refusing to initialize with a SECRET key in the browser. ' +
      'This SDK runs in the visitor\'s browser and anyone can view-source it. ' +
      'Use your PUBLIC key (certilayer_live_pk_...) instead — the secret key ' +
      '(certilayer_live_sk_...) must only ever be used server-side.'
    );
  }

  if (!config.apiKey.startsWith(API_KEY_PREFIX)) {
    warn(`API key must start with "${API_KEY_PREFIX}"`);
  }

  setDebug(config.debug ?? false);

  _config = {
    apiKey:        config.apiKey,
    endpoint:      config.endpoint      ?? DEFAULT_ENDPOINT,
    flushInterval: config.flushInterval ?? DEFAULT_FLUSH_INTERVAL_MS,
    batchSize:     config.batchSize     ?? DEFAULT_BATCH_SIZE,
    debug:         config.debug         ?? false,
  };

  _sessionId      = getOrCreateSessionId();
  _sessionStartTs = Date.now();
  _buffer    = new EventBuffer(_config.batchSize * 2);

  log('Initialized', { sessionId: _sessionId, endpoint: _config.endpoint });

  // Auto-start
  sdk.start();

  return sdk;
}

export type { CertiLayerConfig, CertiLayerSDK, RawSignal };

// ── Trust Badge ────────────────────────────────────────────────────────────
// Re-exported from ./badge — supports light/dark theme, pulse toggle,
// custom z-index, and 4 corner positions. (Previously this file had its
// own duplicate, dark-only, no-options implementation — removed in favor
// of the more capable one that already existed in badge.ts but was never
// wired in.)
export { showBadge, hideBadge };
