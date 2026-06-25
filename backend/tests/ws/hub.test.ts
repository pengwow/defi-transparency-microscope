/**
 * Tests for ws/hub.ts — WebSocket connection registry + broadcast.
 *
 * Spec §8 covers the protocol; this file is the per-socket registry:
 *   - register / unregister sockets
 *   - subscribe / unsubscribe per topic
 *   - broadcast filtering by topic
 *   - 30s heartbeat (pings sockets, drops silent ones)
 *   - getStats() for observability
 *
 * We stub the WebSocket (a `ws.WebSocket`-shaped object) to keep tests
 * fast and deterministic. The hub is otherwise real: timers are real
 * but we use short intervals in tests to avoid CI slowness.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WSHub, type HubSocket } from '../../src/ws/hub.js';
import { WSTopic, type WSMessage } from '../../src/ws/topics.js';

type WSLike = HubSocket;

/** Build a stub WebSocket that records sends and exposes the readyState. */
function makeSocket(opts: { readyState?: number; open?: boolean } = {}): WSLike & {
  sent: string[];
  terminate: ReturnType<typeof vi.fn>;
  ping: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
} {
  const sent: string[] = [];
  const terminate = vi.fn();
  const ping = vi.fn();
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
  const on = vi.fn((event: string, fn: (...args: unknown[]) => void) => {
    (handlers[event] ??= []).push(fn);
  });
  return {
    readyState: opts.readyState ?? (opts.open === false ? 3 : 1),
    OPEN: 1,
    CLOSED: 3,
    send: (data: string) => {
      sent.push(data);
    },
    sent,
    terminate,
    ping,
    on,
  };
}

describe('WSHub', () => {
  let hub: WSHub;
  beforeEach(() => {
    hub = new WSHub({ heartbeatMs: 30_000 });
  });
  afterEach(() => {
    hub.stop();
  });

  it('starts with zero subscribers and zero messages', () => {
    const stats = hub.getStats();
    expect(stats.subscriberCount).toBe(0);
    expect(stats.messagesSent).toBe(0);
    expect(stats.messagesDropped).toBe(0);
  });

  it('register/unregister tracks sockets', () => {
    const s = makeSocket();
    hub.register(s as never);
    expect(hub.getStats().subscriberCount).toBe(1);
    hub.unregister(s as never);
    expect(hub.getStats().subscriberCount).toBe(0);
  });

  it('unregister is a no-op for unknown sockets', () => {
    const s = makeSocket();
    expect(() => hub.unregister(s as never)).not.toThrow();
    expect(hub.getStats().subscriberCount).toBe(0);
  });

  it('subscribe stores the topics for the socket', () => {
    const s = makeSocket();
    hub.register(s as never);
    hub.subscribe(s as never, [WSTopic.Mempool, WSTopic.Liquidations]);
    const subs = hub.getSubscribers(s as never);
    expect(subs.has(WSTopic.Mempool)).toBe(true);
    expect(subs.has(WSTopic.Liquidations)).toBe(true);
    expect(subs.has(WSTopic.AmmSync)).toBe(false);
  });

  it('subscribe replaces the prior topic set', () => {
    const s = makeSocket();
    hub.register(s as never);
    hub.subscribe(s as never, [WSTopic.Mempool]);
    hub.subscribe(s as never, [WSTopic.AmmSync]);
    const subs = hub.getSubscribers(s as never);
    expect(subs.has(WSTopic.Mempool)).toBe(false);
    expect(subs.has(WSTopic.AmmSync)).toBe(true);
  });

  it('broadcast only delivers to sockets subscribed to the message topic', () => {
    const a = makeSocket();
    const b = makeSocket();
    hub.register(a as never);
    hub.register(b as never);
    hub.subscribe(a as never, [WSTopic.Mempool]);
    // b has no subscriptions — should not receive
    const msg: WSMessage = {
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'aa'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        type: 'normal',
        timestamp: 0,
      },
    };
    hub.broadcast(WSTopic.Mempool, msg);
    expect(a.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0);
    expect(hub.getStats().messagesSent).toBe(1);
  });

  it('broadcast increments dropped count for failed sends', () => {
    const s = {
      readyState: 1,
      OPEN: 1,
      CLOSED: 3,
      send: vi.fn(() => {
        throw new Error('socket closed mid-send');
      }),
      on: vi.fn(),
    };
    hub.register(s as never);
    hub.subscribe(s as never, [WSTopic.Mempool]);
    hub.broadcast(WSTopic.Mempool, {
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'aa'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        type: 'normal',
        timestamp: 0,
      },
    });
    expect(hub.getStats().messagesDropped).toBe(1);
    expect(hub.getStats().messagesSent).toBe(0);
  });

  it('broadcast filters by topic and serialises the envelope as JSON', () => {
    const s = makeSocket();
    hub.register(s as never);
    hub.subscribe(s as never, [WSTopic.BlockConfirm]);
    hub.broadcast(WSTopic.BlockConfirm, {
      type: 'block_confirm',
      data: { number: 100, timestamp: 1700000000, txCount: 5, gasUsed: 21000n },
    });
    expect(s.sent).toHaveLength(1);
    const payload = JSON.parse(s.sent[0]!);
    expect(payload.type).toBe('block_confirm');
    // BigInt serialised as decimal string
    expect(payload.data.gasUsed).toBe('21000');
  });

  it('skips sockets whose readyState is not OPEN', () => {
    const open = makeSocket({ readyState: 1 });
    const closed = makeSocket({ readyState: 3 });
    hub.register(open as never);
    hub.register(closed as never);
    hub.subscribe(open as never, [WSTopic.Mempool]);
    hub.subscribe(closed as never, [WSTopic.Mempool]);
    hub.broadcast(WSTopic.Mempool, {
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'aa'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        type: 'normal',
        timestamp: 0,
      },
    });
    expect(open.sent).toHaveLength(1);
    expect(closed.sent).toHaveLength(0);
  });

  it('startHeartbeat pings every interval; stopHeartbeat halts the timer', () => {
    vi.useFakeTimers();
    const h = new WSHub({ heartbeatMs: 1000 });
    const s = makeSocket();
    h.register(s as never);
    h.startHeartbeat();
    vi.advanceTimersByTime(1000);
    expect(s.ping).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(s.ping).toHaveBeenCalledTimes(2);
    h.stopHeartbeat();
    vi.advanceTimersByTime(5000);
    // After stop, no more pings
    expect(s.ping).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('startHeartbeat terminates sockets that have not responded in 2x heartbeat', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const h = new WSHub({ heartbeatMs: 1000 });
    const s = makeSocket();
    h.register(s as never);
    h.startHeartbeat();
    // First tick: ping
    vi.advanceTimersByTime(1000);
    expect(s.ping).toHaveBeenCalledTimes(1);
    expect(s.terminate).not.toHaveBeenCalled();
    // Second tick: still within 2x window (silent=2000ms == 2x1000ms, not strictly >)
    vi.advanceTimersByTime(1000);
    expect(s.ping).toHaveBeenCalledTimes(2);
    expect(s.terminate).not.toHaveBeenCalled();
    // Third tick: silent=3000ms > 2x1000ms, terminate
    vi.advanceTimersByTime(1000);
    expect(s.terminate).toHaveBeenCalledTimes(1);
    expect(h.getStats().subscriberCount).toBe(0);
    vi.useRealTimers();
  });

  it('markAlive resets the silent timer for a socket', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    const h = new WSHub({ heartbeatMs: 1000 });
    const s = makeSocket();
    h.register(s as never); // lastPong = 0
    h.startHeartbeat();
    vi.advanceTimersByTime(1000); // tick #1 at t=1000; cutoff=-1000; 0 < -1000? no; ping
    h.markAlive(s as never); // lastPong = 1000
    vi.advanceTimersByTime(1000); // tick #2 at t=2000; cutoff=0; 1000 < 0? no; ping
    h.markAlive(s as never); // lastPong = 2000
    vi.advanceTimersByTime(1000); // tick #3 at t=3000; cutoff=1000; 2000 < 1000? no; ping
    expect(s.terminate).not.toHaveBeenCalled();
    // Stop marking alive; silent period grows
    vi.advanceTimersByTime(1000); // tick #4 at t=4000; cutoff=2000; 2000 < 2000? no; ping
    expect(s.terminate).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); // tick #5 at t=5000; cutoff=3000; 2000 < 3000? yes; terminate
    expect(s.terminate).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('getStats reports topic-subscriber counts', () => {
    const a = makeSocket();
    const b = makeSocket();
    hub.register(a as never);
    hub.register(b as never);
    hub.subscribe(a as never, [WSTopic.Mempool, WSTopic.Liquidations]);
    hub.subscribe(b as never, [WSTopic.Mempool]);
    const stats = hub.getStats();
    expect(stats.subscribersByTopic[WSTopic.Mempool]).toBe(2);
    expect(stats.subscribersByTopic[WSTopic.Liquidations]).toBe(1);
    expect(stats.subscribersByTopic[WSTopic.AmmSync]).toBe(0);
  });

  it('stop() unregisters everything and halts the heartbeat', () => {
    const s = makeSocket();
    hub.register(s as never);
    hub.subscribe(s as never, [WSTopic.Mempool]);
    hub.stop();
    expect(hub.getStats().subscriberCount).toBe(0);
    // After stop, a broadcast should be a no-op (no subscribers)
    hub.broadcast(WSTopic.Mempool, {
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'aa'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        type: 'normal',
        timestamp: 0,
      },
    });
    expect(s.sent).toHaveLength(0);
  });
});
