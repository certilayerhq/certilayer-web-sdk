/**
 * @file normalizer.test.ts
 * @layer L1 — Web SDK tests
 * @description Tests for the 34-dim feature vector computation — the
 * highest-value thing to test here since a bug directly corrupts what
 * the scoring models see. No prior test suite existed for this SDK.
 */

import { computeFeatureVector } from '../src/normalizer/index';
import type { RawSignal } from '../src/types';

describe('computeFeatureVector', () => {
  it('returns an all-zero 34-dim vector for a too-short session', () => {
    const fv = computeFeatureVector([], 100);
    expect(fv).toHaveLength(34);
    expect(fv.every(v => v === 0)).toBe(true);
  });

  it('returns an all-zero vector when there are no signals at all', () => {
    const fv = computeFeatureVector([], 5000);
    expect(fv.every(v => v === 0)).toBe(true);
  });

  it('sets keyboard_present (fv[0]) when keyboard signals exist', () => {
    const signals: RawSignal[] = [
      { kind: 'keyboard', ts_ms: 0,   data: { backspace: false, down_ts: 0,   up_ts: 0,  iki_ms: 0 } },
      { kind: 'keyboard', ts_ms: 200, data: { backspace: false, down_ts: 200, up_ts: 0,  iki_ms: 200 } },
    ];
    const fv = computeFeatureVector(signals, 1000);
    expect(fv[0]).toBe(1); // keyboard_present
    expect(fv[1]).toBe(0); // mouse_present
    expect(fv[2]).toBe(0); // touch_present (always 0 on web)
  });

  it('sets mouse_present (fv[1]) and computes a bounded velocity mean', () => {
    const signals: RawSignal[] = [
      { kind: 'mouse', ts_ms: 0,   data: { x: 0,   y: 0,   velocity: 0.5, button: -1, click_duration_ms: 0 } },
      { kind: 'mouse', ts_ms: 50,  data: { x: 10,  y: 10,  velocity: 0.3, button: -1, click_duration_ms: 0 } },
    ];
    const fv = computeFeatureVector(signals, 1000);
    expect(fv[1]).toBe(1); // mouse_present
    expect(fv[11]).toBeGreaterThanOrEqual(0);
    expect(fv[11]).toBeLessThanOrEqual(1);
  });

  it('every output value stays clamped to [0, 1]', () => {
    const signals: RawSignal[] = [
      { kind: 'mouse', ts_ms: 0,   data: { x: 0, y: 0, velocity: 999999, button: -1, click_duration_ms: 0 } },
      { kind: 'mouse', ts_ms: 10,  data: { x: 1, y: 1, velocity: -50,    button: -1, click_duration_ms: 0 } },
    ];
    const fv = computeFeatureVector(signals, 1000);
    for (const v of fv) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('scroll_present (fv[3]) and depth ratio reflect scroll signals', () => {
    const signals: RawSignal[] = [
      { kind: 'scroll', ts_ms: 0,   data: { delta_y: 100, delta_x: 0, velocity: 1, depth_ratio: 0.4 } },
      { kind: 'scroll', ts_ms: 100, data: { delta_y: 100, delta_x: 0, velocity: 1, depth_ratio: 0.8 } },
    ];
    const fv = computeFeatureVector(signals, 1000);
    expect(fv[3]).toBe(1);   // scroll_present
    expect(fv[19]).toBe(0.8); // max depth ratio reached
  });

  it('touch/motion features (fv[20-28]) always stay 0 on web', () => {
    const signals: RawSignal[] = [
      { kind: 'keyboard', ts_ms: 0, data: { backspace: false, down_ts: 0, up_ts: 0, iki_ms: 0 } },
    ];
    const fv = computeFeatureVector(signals, 1000);
    for (let i = 20; i <= 28; i++) expect(fv[i]).toBe(0);
  });
});
