/**
 * Debounced fan-out buffer.
 *
 * Spec §8.5: mempool messages are batched at 100ms windows to avoid
 * message storms during high activity. The batcher accepts items via
 * `add(item)` and emits a single batch every `flushIntervalMs`.
 *
 * Design notes:
 *   - Pure class with no module-level state. Tests inject the
 *     `flushIntervalMs` so a 100ms default doesn't slow the suite.
 *   - The buffer is flushed in insertion order. Multiple `onFlush`
 *     listeners are supported; all see the same batch.
 *   - `flush()` is a manual "send now" trigger that also resets the
 *     auto-flush timer.
 *   - `stop()` is a teardown helper used by the server's shutdown path
 *     to ensure no stray timers keep the process alive.
 */
export type FlushCallback<T> = (items: T[]) => void;

export interface MessageBatcherOptions<T> {
  /** Window length in ms. Default 100 (spec §8.5). */
  flushIntervalMs?: number;
  /** Test hook: override `setInterval` / `clearInterval`. */
  scheduler?: {
    setInterval: typeof setInterval;
    clearInterval: typeof clearInterval;
  };
  /** Marker — the type parameter `T` is used for `add(item)`. */
  _typeMarker?: T;
}

const DEFAULT_FLUSH_MS = 100;

/**
 * Generic time-windowed message batcher. Type parameter `T` is the
 * payload type being buffered; the hub converts it into a WSMessage
 * before broadcasting.
 */
export class MessageBatcher<T> {
  private readonly flushIntervalMs: number;
  private readonly scheduler: Pick<typeof globalThis, 'setInterval' | 'clearInterval'>;
  private buffer: T[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushListeners: Array<FlushCallback<T>> = [];

  constructor(opts: MessageBatcherOptions<T> = {}) {
    this.flushIntervalMs = opts.flushIntervalMs ?? DEFAULT_FLUSH_MS;
    this.scheduler = opts.scheduler ?? { setInterval, clearInterval };
  }

  /** Register a flush callback. Returns an unsubscribe function. */
  onFlush(cb: FlushCallback<T>): () => void {
    this.flushListeners.push(cb);
    return () => {
      this.flushListeners = this.flushListeners.filter((f) => f !== cb);
    };
  }

  /** Buffer an item; starts the auto-flush timer on the first item. */
  add(item: T): void {
    this.buffer.push(item);
    if (this.timer === null) this.startTimer();
  }

  /** Number of items currently buffered (not yet flushed). */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Flush the current buffer immediately to all `onFlush` listeners
   * and reset the auto-flush window. No-op if the buffer is empty.
   */
  flush(): void {
    if (this.buffer.length === 0) return;
    const items = this.buffer;
    this.buffer = [];
    // Reset the timer so the next add() starts a fresh window.
    if (this.timer !== null) {
      this.scheduler.clearInterval(this.timer);
      this.timer = null;
    }
    for (const cb of this.flushListeners) {
      try {
        cb(items);
      } catch {
        // listeners must not break the batcher
      }
    }
  }

  /**
   * Tear down: clear the timer. Does NOT invoke any callbacks.
   * Idempotent.
   */
  stop(): void {
    if (this.timer !== null) {
      this.scheduler.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private startTimer(): void {
    this.timer = this.scheduler.setInterval(() => this.flush(), this.flushIntervalMs);
  }
}
