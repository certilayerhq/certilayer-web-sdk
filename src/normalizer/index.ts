// Layer:  L1 -- Web SDK
// File:   src/normalizer/index.ts
// Role:   Feature extractor — converts raw captured signals into the canonical
//         34-dimensional feature vector expected by the L2 Ingestion Gateway
//         and ultimately by the L3 HCE Engine ONNX models.
//
//         Feature schema (canonical order, matches Python FEATURE_NAMES):
//           [0-3]   presence flags
//           [4-10]  keyboard timing features
//           [11-16] mouse movement features
//           [17-19] scroll features
//           [20-24] touch features  (always 0 on web)
//           [25-28] motion features (always 0 on web)
//           [29-33] navigation features
//
// Author: Youssef Emad

import type { RawSignal, KeyboardSignal, MouseSignal, ScrollSignal, NavigationSignal } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Total number of features in the canonical feature vector. */
const FEATURE_DIM = 34;

/**
 * Minimum session duration (ms) to compute meaningful timing features.
 * Sessions shorter than this produce zero-filled vectors.
 */
const MIN_SESSION_DURATION_MS = 500;

/** Smoothing epsilon — prevents division by zero in normalisation. */
const EPS = 1e-9;

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the 34-dimensional feature vector from a raw signal buffer.
 *
 * This is the ONLY function that should be called from flush() in index.ts.
 * All features are normalised to [0, 1] as required by the M4 ONNX models.
 *
 * @param signals           - All raw signals captured in this batch.
 * @param sessionDurationMs - Wall-clock duration of the capture window (ms).
 * @returns                   Float array of length 34 — safe to send to L2.
 *
 * @example
 * const fv = computeFeatureVector(buffer.drain(), Date.now() - sessionStartTs);
 * await sendBatch(endpoint, apiKey, { ...batch, features: fv });
 */
export function computeFeatureVector(
  signals: RawSignal[],
  sessionDurationMs: number,
): number[] {
  const fv = new Array<number>(FEATURE_DIM).fill(0);

  // Guard: sessions under 500 ms produce no meaningful features
  if (sessionDurationMs < MIN_SESSION_DURATION_MS || signals.length === 0) {
    return fv;
  }

  // Partition signals by kind
  const kb = signals.filter(s => s.kind === 'keyboard');
  const ms = signals.filter(s => s.kind === 'mouse');
  const sc = signals.filter(s => s.kind === 'scroll');
  const nv = signals.filter(s => s.kind === 'navigation');
  // touch / motion are always 0 on web (fv[20-28] stay 0)

  // ── [0-3] Presence flags ──────────────────────────────────────────────────
  fv[0] = kb.length > 0 ? 1 : 0;   // keyboard_present
  fv[1] = ms.length > 0 ? 1 : 0;   // mouse_present
  fv[2] = 0;                         // touch_present  (never on web)
  fv[3] = sc.length > 0 ? 1 : 0;   // scroll_present

  // ── [4-10] Keyboard features ──────────────────────────────────────────────
  if (kb.length >= 2) {
    extractKeyboardFeatures(kb, fv);
  }

  // ── [11-16] Mouse features ────────────────────────────────────────────────
  if (ms.length >= 2) {
    extractMouseFeatures(ms, fv);
  }

  // ── [17-19] Scroll features ───────────────────────────────────────────────
  if (sc.length >= 1) {
    extractScrollFeatures(sc, fv);
  }

  // ── [29-33] Navigation features ───────────────────────────────────────────
  if (nv.length >= 1) {
    extractNavigationFeatures(nv, sessionDurationMs, fv);
  }

  // Final clamp: ensure all values stay in [0, 1]
  for (let i = 0; i < FEATURE_DIM; i++) {
    fv[i] = clamp01(fv[i]);
  }

  return fv;
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard feature extraction  [4-10]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract 7 keyboard timing features from keydown/keyup signal pairs.
 *
 * Features written:
 *   fv[4]  iki_mean              — mean inter-key interval (normalised, ms→[0,1])
 *   fv[5]  iki_std               — IKI standard deviation
 *   fv[6]  dwell_mean            — mean key hold duration
 *   fv[7]  dwell_std             — dwell std deviation
 *   fv[8]  flight_mean           — mean flight time between key-up and next key-down
 *   fv[9]  typing_burst_score    — proportion of fast bursts (IKI < 150 ms)
 *   fv[10] error_correction_rate — rate of Backspace usage
 *
 * @param kb  - Keyboard signals (must have >= 2 entries).
 * @param fv  - Feature vector to write into (mutated in-place).
 */
function extractKeyboardFeatures(kb: RawSignal[], fv: number[]): void {
  const downEvents = kb.filter(s => (s.data as Partial<KeyboardSignal>).up_ts === 0
    || (s.data as Partial<KeyboardSignal>).up_ts === undefined);
  const upEvents   = kb.filter(s => (s.data as Partial<KeyboardSignal>).up_ts !== undefined
    && (s.data as Partial<KeyboardSignal>).up_ts !== 0);

  // ── IKI (inter-key interval from keydown events) ──────────────────────────
  const ikis: number[] = [];
  for (let i = 1; i < downEvents.length; i++) {
    const iki = (downEvents[i].data as unknown as KeyboardSignal).iki_ms ?? 0;
    if (iki > 0 && iki < 5000) {   // discard outliers (pauses > 5 s)
      ikis.push(iki);
    }
  }

  if (ikis.length > 0) {
    const { mean, std } = meanStd(ikis);
    // Normalise: typical IKI 50–500 ms → clamp to 1000 ms ceiling
    fv[4] = normalise(mean, 0, 1000);
    fv[5] = normalise(std,  0, 500);

    // Burst score: proportion of IKIs under 150 ms (fast typists)
    const bursts = ikis.filter(v => v < 150).length;
    fv[9] = bursts / ikis.length;
  }

  // ── Dwell time (key hold duration from paired down/up events) ────────────
  const dwells: number[] = [];
  for (const up of upEvents) {
    const u = up.data as Partial<KeyboardSignal>;
    if (u.down_ts && u.up_ts && u.up_ts > u.down_ts) {
      const dwell = u.up_ts - u.down_ts;
      if (dwell > 0 && dwell < 1000) {    // discard held keys > 1 s
        dwells.push(dwell);
      }
    }
  }

  if (dwells.length > 0) {
    const { mean, std } = meanStd(dwells);
    // Normalise: typical dwell 50–200 ms → ceiling 500 ms
    fv[6] = normalise(mean, 0, 500);
    fv[7] = normalise(std,  0, 250);
  }

  // ── Flight time (gap between key-up and next key-down) ───────────────────
  const flights: number[] = [];
  for (let i = 0; i < upEvents.length - 1; i++) {
    const upTs   = (upEvents[i].data as unknown as KeyboardSignal).up_ts;
    const nextDn = downEvents.find(d => d.ts_ms > upTs);
    if (nextDn) {
      const flight = nextDn.ts_ms - upTs;
      if (flight > 0 && flight < 2000) {
        flights.push(flight);
      }
    }
  }

  if (flights.length > 0) {
    const { mean } = meanStd(flights);
    fv[8] = normalise(mean, 0, 1000);
  }

  // ── Error correction rate (Backspace events / total key events) ───────────
  const backspaces = downEvents.filter(s =>
    (s.data as unknown as KeyboardSignal).code === 'Backspace'
  ).length;
  fv[10] = downEvents.length > 0 ? backspaces / downEvents.length : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mouse feature extraction  [11-16]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract 6 mouse movement and click features.
 *
 * Features written:
 *   fv[11] mouse_velocity_mean      — mean movement velocity (px/ms)
 *   fv[12] mouse_acceleration_std   — std of acceleration between samples
 *   fv[13] movement_curvature       — mean angular change (direction entropy proxy)
 *   fv[14] micro_adjustment_score   — proportion of very small movements (< 5 px)
 *   fv[15] click_duration_mean      — mean mouse button hold time
 *   fv[16] direction_change_rate    — direction reversals per second
 *
 * @param ms  - Mouse signals (must have >= 2 entries).
 * @param fv  - Feature vector to write into (mutated in-place).
 */
function extractMouseFeatures(ms: RawSignal[], fv: number[]): void {
  const moves  = ms.filter(s => (s.data as unknown as MouseSignal).button === -1);
  const clicks = ms.filter(s => (s.data as unknown as MouseSignal).button >= 0
    && (s.data as unknown as MouseSignal).click_duration_ms > 0);

  // ── Velocity ──────────────────────────────────────────────────────────────
  const velocities = moves
    .map(s => (s.data as unknown as MouseSignal).velocity)
    .filter(v => v >= 0 && v < 10);     // px/ms ceiling — bots often hit ~0.997

  if (velocities.length > 0) {
    const { mean } = meanStd(velocities);
    // Max meaningful velocity ~3 px/ms during fast sweeps
    fv[11] = normalise(mean, 0, 3);
  }

  // ── Acceleration std ──────────────────────────────────────────────────────
  if (velocities.length >= 2) {
    const accels: number[] = [];
    for (let i = 1; i < velocities.length; i++) {
      accels.push(Math.abs(velocities[i] - velocities[i - 1]));
    }
    const { std } = meanStd(accels);
    fv[12] = normalise(std, 0, 2);
  }

  // ── Curvature (mean angular change between consecutive move vectors) ──────
  if (moves.length >= 3) {
    const angles: number[] = [];
    for (let i = 1; i < moves.length - 1; i++) {
      const p0 = moves[i - 1].data as unknown as MouseSignal;
      const p1 = moves[i].data as unknown as MouseSignal;
      const p2 = moves[i + 1].data as unknown as MouseSignal;

      const dx1 = p1.x - p0.x;
      const dy1 = p1.y - p0.y;
      const dx2 = p2.x - p1.x;
      const dy2 = p2.y - p1.y;

      const angle = Math.atan2(
        dx1 * dy2 - dy1 * dx2,
        dx1 * dx2 + dy1 * dy2,
      );
      angles.push(Math.abs(angle));
    }
    const { mean } = meanStd(angles);
    // Normalise angle [0, π] → [0, 1]
    fv[13] = mean / Math.PI;
  }

  // ── Micro-adjustment score ────────────────────────────────────────────────
  if (moves.length > 0) {
    const micro = moves.filter(s => {
      const m = s.data as unknown as MouseSignal;
      // Approximate displacement from velocity × time — we don't store dt,
      // so we use velocity as proxy: very low velocity = micro-movement
      return m.velocity < 0.05;
    }).length;
    fv[14] = micro / moves.length;
  }

  // ── Click duration ────────────────────────────────────────────────────────
  if (clicks.length > 0) {
    const durations = clicks.map(s => (s.data as unknown as MouseSignal).click_duration_ms);
    const { mean } = meanStd(durations);
    // Typical click: 80–200 ms; ceiling 500 ms
    fv[15] = normalise(mean, 0, 500);
  }

  // ── Direction change rate ─────────────────────────────────────────────────
  if (moves.length >= 3) {
    let dirChanges = 0;
    for (let i = 1; i < moves.length - 1; i++) {
      const p0 = moves[i - 1].data as unknown as MouseSignal;
      const p1 = moves[i].data as unknown as MouseSignal;
      const p2 = moves[i + 1].data as unknown as MouseSignal;

      const dx1 = p1.x - p0.x;
      const dx2 = p2.x - p1.x;
      const dy1 = p1.y - p0.y;
      const dy2 = p2.y - p1.y;

      // Dot product sign change = direction reversal
      if (dx1 * dx2 + dy1 * dy2 < 0) dirChanges++;
    }
    const durationSec = (moves[moves.length - 1].ts_ms - moves[0].ts_ms) / 1000 + EPS;
    // Normalise: ceiling 10 direction changes per second
    fv[16] = normalise(dirChanges / durationSec, 0, 10);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Scroll feature extraction  [17-19]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract 3 scroll behaviour features.
 *
 * Features written:
 *   fv[17] scroll_velocity_mean      — mean scroll speed (px/ms)
 *   fv[18] scroll_direction_entropy  — entropy of scroll direction (up vs down)
 *   fv[19] scroll_depth_ratio        — maximum depth reached [0, 1]
 *
 * @param sc  - Scroll signals (must have >= 1 entry).
 * @param fv  - Feature vector to write into (mutated in-place).
 */
function extractScrollFeatures(sc: RawSignal[], fv: number[]): void {
  const velocities = sc.map(s => (s.data as unknown as ScrollSignal).velocity);
  const deltas     = sc.map(s => (s.data as unknown as ScrollSignal).delta_y);
  const depths     = sc.map(s => (s.data as unknown as ScrollSignal).depth_ratio);

  // ── Velocity ──────────────────────────────────────────────────────────────
  if (velocities.length > 0) {
    const { mean } = meanStd(velocities.filter(v => v >= 0));
    // Typical scroll velocity 0.5–5 px/ms; ceiling 10 px/ms
    fv[17] = normalise(mean, 0, 10);
  }

  // ── Direction entropy ─────────────────────────────────────────────────────
  if (deltas.length > 0) {
    const downs = deltas.filter(d => d > 0).length;
    const ups   = deltas.filter(d => d < 0).length;
    const total = downs + ups + EPS;
    const pDown = downs / total;
    const pUp   = ups   / total;
    // Shannon entropy of a binary distribution → max at 0.5/0.5
    const entropy = -((pDown + EPS) * Math.log2(pDown + EPS)
                    + (pUp   + EPS) * Math.log2(pUp   + EPS));
    // Entropy ∈ [0, 1] naturally for binary distribution
    fv[18] = clamp01(entropy);
  }

  // ── Max depth ratio ───────────────────────────────────────────────────────
  if (depths.length > 0) {
    fv[19] = Math.max(...depths);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation feature extraction  [29-33]
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract 5 navigation and session-level features.
 *
 * Features written:
 *   fv[29] page_transition_entropy     — entropy of page transition pattern
 *   fv[30] focus_duration_mean         — mean time per page (normalised)
 *   fv[31] window_switch_rate          — visibility-change events per second
 *   fv[32] decision_latency_mean       — mean time before first interaction
 *   fv[33] interaction_consistency_score — uniformity of inter-event timing
 *
 * @param nv                - Navigation signals.
 * @param sessionDurationMs - Total session wall-clock duration (ms).
 * @param fv                - Feature vector to write into (mutated in-place).
 */
function extractNavigationFeatures(
  nv: RawSignal[],
  sessionDurationMs: number,
  fv: number[],
): void {
  const navEvents    = nv.filter(s => s.kind === 'navigation');
  const focusEvents  = nv.filter(s => s.kind === 'focus');

  // ── Page transition entropy ───────────────────────────────────────────────
  if (navEvents.length > 0) {
    // Count unique destination paths
    const pathCounts = new Map<string, number>();
    for (const e of navEvents) {
      const to = (e.data as unknown as NavigationSignal).to_path ?? '';
      pathCounts.set(to, (pathCounts.get(to) ?? 0) + 1);
    }
    const total = navEvents.length + EPS;
    let entropy = 0;
    for (const count of pathCounts.values()) {
      const p = count / total;
      entropy -= p * Math.log2(p + EPS);
    }
    // Normalise by max possible entropy (log2 of unique paths)
    const maxEntropy = Math.log2(pathCounts.size + 1);
    fv[29] = maxEntropy > 0 ? clamp01(entropy / maxEntropy) : 0;
  }

  // ── Focus duration (dwell per page) ──────────────────────────────────────
  const durations = navEvents
    .map(s => (s.data as unknown as NavigationSignal).duration_ms)
    .filter(d => d > 0 && d < 300_000);  // discard sessions > 5 min per page

  if (durations.length > 0) {
    const { mean } = meanStd(durations);
    // Normalise: 0–60 000 ms (1 minute) → [0, 1]
    fv[30] = normalise(mean, 0, 60_000);
  }

  // ── Window switch rate (visibility changes per second) ───────────────────
  if (focusEvents.length > 0 && sessionDurationMs > 0) {
    const switchRate = focusEvents.length / (sessionDurationMs / 1000);
    // Ceiling: 2 switches/sec is very high
    fv[31] = normalise(switchRate, 0, 2);
  }

  // ── Decision latency (time to first interaction after page load) ──────────
  if (navEvents.length > 0 && nv.length > 0) {
    const firstNav   = navEvents[0].ts_ms;
    const firstEvent = nv[0].ts_ms;
    const latency    = Math.max(0, firstEvent - firstNav);
    // Normalise: 0–10 000 ms (10 seconds)
    fv[32] = normalise(latency, 0, 10_000);
  }

  // ── Interaction consistency (coefficient of variation of all inter-event gaps) ──
  if (nv.length >= 3) {
    const gaps: number[] = [];
    for (let i = 1; i < nv.length; i++) {
      gaps.push(nv[i].ts_ms - nv[i - 1].ts_ms);
    }
    const { mean, std } = meanStd(gaps);
    // CV = std / mean — lower CV = more consistent (human-like)
    // Invert: consistency = 1 - normalised_CV
    const cv = mean > 0 ? std / mean : 0;
    fv[33] = clamp01(1 - normalise(cv, 0, 3));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Math utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute mean and population standard deviation of a number array.
 *
 * @param values - Non-empty array of numbers.
 * @returns Object with mean and std.
 */
function meanStd(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;

  return { mean, std: Math.sqrt(variance) };
}

/**
 * Linear normalisation of a value to [0, 1] given a [min, max] range.
 *
 * @param value - Raw value to normalise.
 * @param min   - Expected minimum.
 * @param max   - Expected maximum (ceiling).
 * @returns       Clamped normalised value in [0, 1].
 */
function normalise(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  return clamp01((value - min) / (max - min));
}

/**
 * Clamp a number to the closed interval [0, 1].
 *
 * @param v - Input value.
 * @returns   Value clamped to [0, 1].
 */
function clamp01(v: number): number {
  if (!isFinite(v) || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
