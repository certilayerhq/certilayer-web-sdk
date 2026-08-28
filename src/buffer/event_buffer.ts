// Layer:  L1 -- Web SDK
// File:   buffer/event_buffer.ts
// Role:   Ring buffer — accumulates signals and flushes in batches.
//         Never grows beyond batchSize * 2 to cap memory usage.
// Author: Youssef Emad

import { RawSignal } from '../types';
import { DEFAULT_BATCH_SIZE } from '../config';

/** Maximum buffer size — 2x batch size to avoid unbounded growth. */
const MAX_BUFFER_SIZE = DEFAULT_BATCH_SIZE * 2;

export class EventBuffer {
  private buffer: RawSignal[] = [];
  private readonly maxSize: number;

  constructor(maxSize = MAX_BUFFER_SIZE) {
    this.maxSize = maxSize;
  }

  /** Add a signal to the buffer. Drops oldest if at capacity. */
  push(signal: RawSignal): void {
    if (this.buffer.length >= this.maxSize) {
      // Drop oldest signal — prefer recent behavioral data
      this.buffer.shift();
    }
    this.buffer.push(signal);
  }

  /** Drain up to `count` signals from the buffer and return them. */
  drain(count: number = DEFAULT_BATCH_SIZE): RawSignal[] {
    return this.buffer.splice(0, count);
  }

  /** Current number of buffered signals. */
  get size(): number {
    return this.buffer.length;
  }

  /** True if the buffer has no signals. */
  get isEmpty(): boolean {
    return this.buffer.length === 0;
  }

  /** Clear all buffered signals. */
  clear(): void {
    this.buffer = [];
  }
}
