/**
 * Tests for ws/batcher.ts — debounced fan-out buffer used for
 * `mempool_tx` batching (spec §8.5).
 *
 * The batcher accepts items via `add(item)` and flushes them in 100ms
 * windows. Tests use a small `flushIntervalMs` to keep the suite fast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { MessageBatcher } from '../../src/ws/batcher.js';

describe('MessageBatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('flushes buffered items in order after the window elapses', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    const flushed: number[][] = [];
    b.onFlush((items) => flushed.push(items));
    b.add(1);
    b.add(2);
    b.add(3);
    expect(flushed).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(flushed).toEqual([[1, 2, 3]]);
  });

  it('preserves insertion order across multiple flushes', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    const flushed: number[][] = [];
    b.onFlush((items) => flushed.push(items));
    b.add(1);
    b.add(2);
    vi.advanceTimersByTime(100);
    b.add(3);
    vi.advanceTimersByTime(100);
    expect(flushed).toEqual([[1, 2], [3]]);
  });

  it('manual flush() flushes immediately and resets the timer', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    const flushed: number[][] = [];
    b.onFlush((items) => flushed.push(items));
    b.add(1);
    b.flush();
    expect(flushed).toEqual([[1]]);
    // No more items, no auto-flush
    vi.advanceTimersByTime(1000);
    expect(flushed).toEqual([[1]]);
  });

  it('flushing an empty buffer is a no-op', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    const flushed: number[][] = [];
    b.onFlush((items) => flushed.push(items));
    b.flush();
    expect(flushed).toEqual([]);
  });

  it('supports multiple onFlush callbacks', () => {
    const b = new MessageBatcher<string>({ flushIntervalMs: 50 });
    const a: string[][] = [];
    const c: string[][] = [];
    b.onFlush((items) => a.push(items));
    b.onFlush((items) => c.push(items));
    b.add('x');
    vi.advanceTimersByTime(50);
    expect(a).toEqual([['x']]);
    expect(c).toEqual([['x']]);
  });

  it('stop() clears the timer and stops further flushes', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    const flushed: number[][] = [];
    b.onFlush((items) => flushed.push(items));
    b.add(1);
    b.stop();
    vi.advanceTimersByTime(1000);
    expect(flushed).toEqual([]);
  });

  it('getBufferSize reflects the current pending count', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    expect(b.getBufferSize()).toBe(0);
    b.add(1);
    b.add(2);
    expect(b.getBufferSize()).toBe(2);
    vi.advanceTimersByTime(100);
    expect(b.getBufferSize()).toBe(0);
  });

  it('does not call flush on a buffer that became empty', () => {
    const b = new MessageBatcher<number>({ flushIntervalMs: 100 });
    const flushed: number[][] = [];
    b.onFlush((items) => flushed.push(items));
    vi.advanceTimersByTime(100);
    expect(flushed).toEqual([]);
  });
});
