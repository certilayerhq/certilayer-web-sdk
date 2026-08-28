/**
 * @file event_buffer.test.ts
 * @layer L1 — Web SDK tests
 */

import { EventBuffer } from '../src/buffer/event_buffer';
import type { RawSignal } from '../src/types';

function sig(i: number): RawSignal {
  return { kind: 'mouse', ts_ms: i, data: {} };
}

describe('EventBuffer', () => {
  it('starts empty', () => {
    const buf = new EventBuffer(10);
    expect(buf.isEmpty).toBe(true);
    expect(buf.size).toBe(0);
  });

  it('push increases size, drain empties it', () => {
    const buf = new EventBuffer(10);
    buf.push(sig(1));
    buf.push(sig(2));
    expect(buf.size).toBe(2);

    const drained = buf.drain(10);
    expect(drained).toHaveLength(2);
    expect(buf.isEmpty).toBe(true);
  });

  it('drops the oldest signal once maxSize is reached', () => {
    const buf = new EventBuffer(2);
    buf.push(sig(1));
    buf.push(sig(2));
    buf.push(sig(3)); // should evict signal 1

    const drained = buf.drain(10);
    expect(drained).toHaveLength(2);
    expect((drained[0].ts_ms)).toBe(2);
    expect((drained[1].ts_ms)).toBe(3);
  });

  it('drain(count) only removes up to count items', () => {
    const buf = new EventBuffer(10);
    for (let i = 0; i < 5; i++) buf.push(sig(i));

    const first = buf.drain(2);
    expect(first).toHaveLength(2);
    expect(buf.size).toBe(3);
  });

  it('clear() empties the buffer', () => {
    const buf = new EventBuffer(10);
    buf.push(sig(1));
    buf.clear();
    expect(buf.isEmpty).toBe(true);
  });
});
