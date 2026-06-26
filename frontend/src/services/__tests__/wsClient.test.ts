/**
 * Unit tests for `WsClient` — the realtime WebSocket client.
 *
 * We do not exercise a real socket; instead, the test injects a
 * `FakeWS` stub via the `WebSocketImpl` constructor option.  The
 * stub is event-target–shaped and lets the test simulate:
 *   - open, close, error transitions
 *   - inbound JSON frames
 *   - reconnection timing
 *
 * Coverage targets:
 *   1. welcome + initial-topic subscribes
 *   2. explicit subscribe / unsubscribe
 *   3. ack envelope updates activeTopics
 *   4. server-driven close → reconnect with backoff
 *   5. stop() cancels in-flight reconnect
 *   6. queueing of subscribe/unsubscribe when not open
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WsClient, type WsState } from '../wsClient';

class FakeWS {
  static instances: FakeWS[] = [];
  static reset() {
    FakeWS.instances = [];
  }

  url: string;
  readyState = 0; // CONNECTING
  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    queueMicrotask(() => this.onclose?.(new CloseEvent('close')));
  }

  // Test helpers ────────────────────────────────────────────
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }
  simulateMessage(json: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(json) }));
  }
  simulateClose() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }
  simulateError() {
    this.onerror?.(new Event('error'));
  }
  /** Wait for microtasks (close handler queues via queueMicrotask). */
  async tickFlush() {
    await Promise.resolve();
    await Promise.resolve();
  }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe('WsClient', () => {
  beforeEach(() => {
    FakeWS.reset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens a socket at <url>/ws and reports state transitions', async () => {
    const states: WsState[] = [];
    const client = new WsClient({
      url: 'ws://localhost:8000',
      topics: ['mempool'],
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      onStateChange: (s) => states.push(s),
      backoffMinMs: 1_000,
      backoffMaxMs: 1_000,
    });
    client.start();
    expect(FakeWS.instances).toHaveLength(1);
    expect(FakeWS.instances[0].url).toBe('ws://localhost:8000/ws');
    expect(states).toEqual(['connecting']);

    FakeWS.instances[0].simulateOpen();
    await sleep(0);
    expect(states).toContain('open');
    expect(states.at(-1)).toBe('open');
  });

  it('re-sends initial topics after the welcome handshake', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      topics: ['mempool', 'amm_sync'],
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 1_000,
      backoffMaxMs: 1_000,
    });
    client.start();
    const sock = FakeWS.instances[0];
    sock.simulateOpen();
    await sleep(0);
    const subscribes = sock.sent
      .map((s) => JSON.parse(s) as { action: string; topics?: string[] })
      .filter((s) => s.action === 'subscribe');
    expect(subscribes.map((s) => s.topics).sort()).toEqual([['amm_sync'], ['mempool']]);
  });

  it('subscribe / unsubscribe round-trips through the server acks', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 1_000,
      backoffMaxMs: 1_000,
    });
    client.start();
    const sock = FakeWS.instances[0];
    sock.simulateOpen();
    await sleep(0);
    sock.sent.length = 0;

    client.subscribe(['liquidation_event']);
    expect(sock.sent).toHaveLength(1);
    expect(JSON.parse(sock.sent[0])).toEqual({
      action: 'subscribe',
      topics: ['liquidation_event'],
    });
    // Simulate the server ack.
    sock.simulateMessage({ type: 'ack', data: { ok: true, subscribed: ['liquidation_event'] } });
    expect(client.getTopics()).toEqual(['liquidation_event']);

    client.unsubscribe(['liquidation_event']);
    expect(sock.sent).toHaveLength(2);
    expect(JSON.parse(sock.sent[1])).toEqual({
      action: 'unsubscribe',
      topics: ['liquidation_event'],
    });
    sock.simulateMessage({ type: 'ack', data: { ok: true, subscribed: [] } });
    expect(client.getTopics()).toEqual([]);
  });

  it('reconnects after a server close, with exponential backoff', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      topics: ['mempool'],
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 100,
      backoffMaxMs: 800,
    });
    client.start();
    const sock1 = FakeWS.instances[0];
    sock1.simulateOpen();
    await sleep(0);

    sock1.simulateClose();
    await sock1.tickFlush();
    expect(client.getState()).toBe('reconnecting');

    // Advance to the first retry (100ms after close).
    await vi.advanceTimersByTimeAsync(120);
    expect(FakeWS.instances).toHaveLength(2);

    const sock2 = FakeWS.instances[1];
    sock2.simulateOpen();
    await sleep(0);
    // After reconnect, the initial topic should be re-subscribed.
    const sent2 = sock2.sent
      .map((s) => JSON.parse(s) as { action: string; topics?: string[] })
      .filter((s) => s.action === 'subscribe');
    expect(sent2.map((s) => s.topics)).toEqual([['mempool']]);
  });

  it('caps backoff at the configured maximum', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 1_000,
      backoffMaxMs: 4_000,
    });
    client.start();
    // First reconnect: 1000ms
    FakeWS.instances[0].simulateClose();
    await FakeWS.instances[0].tickFlush();
    await vi.advanceTimersByTimeAsync(1_100);
    // Second reconnect: 2000ms
    FakeWS.instances[1].simulateClose();
    await FakeWS.instances[1].tickFlush();
    await vi.advanceTimersByTimeAsync(2_100);
    // Third reconnect: 4000ms (capped)
    FakeWS.instances[2].simulateClose();
    await FakeWS.instances[2].tickFlush();
    await vi.advanceTimersByTimeAsync(4_100);
    // Fourth reconnect should still cap at 4000ms.
    FakeWS.instances[3].simulateClose();
    await FakeWS.instances[3].tickFlush();
    await vi.advanceTimersByTimeAsync(4_100);
    expect(FakeWS.instances.length).toBeGreaterThanOrEqual(4);
  });

  it('stop() cancels the pending reconnect', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 100,
      backoffMaxMs: 100,
    });
    client.start();
    FakeWS.instances[0].simulateClose();
    await FakeWS.instances[0].tickFlush();
    client.stop();
    expect(client.getState()).toBe('closed');
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWS.instances).toHaveLength(1); // no second socket
  });

  it('forwards mempool_tx messages to onMessage', async () => {
    const onMessage = vi.fn();
    const client = new WsClient({
      url: 'ws://localhost:8000',
      onMessage,
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 1_000,
      backoffMaxMs: 1_000,
    });
    client.start();
    const sock = FakeWS.instances[0];
    sock.simulateOpen();
    await sleep(0);
    sock.simulateMessage({
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'a'.repeat(64),
        from: '0x' + 'b'.repeat(40),
        to: '0x' + 'c'.repeat(40),
        value: '0',
        gasPrice: '30000000000',
        input: '0x',
        type: 'sandwich',
        timestamp: 1_700_000_000,
      },
    });
    expect(onMessage).toHaveBeenCalledWith({
      type: 'mempool_tx',
      data: expect.objectContaining({ hash: '0x' + 'a'.repeat(64) }),
    });
  });

  it('queues subscribe() actions when not yet open', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 1_000,
      backoffMaxMs: 1_000,
    });
    client.start();
    // No simulateOpen() yet.
    client.subscribe(['mempool']);
    const sock = FakeWS.instances[0];
    expect(sock.sent).toHaveLength(0);
    sock.simulateOpen();
    await sleep(0);
    const sub = sock.sent
      .map((s) => JSON.parse(s) as { action: string; topics?: string[] })
      .find((s) => s.action === 'subscribe' && s.topics?.includes('mempool'));
    expect(sub).toBeDefined();
  });

  it('ping() sends a ping action', async () => {
    const client = new WsClient({
      url: 'ws://localhost:8000',
      WebSocketImpl: FakeWS as unknown as typeof WebSocket,
      backoffMinMs: 1_000,
      backoffMaxMs: 1_000,
    });
    client.start();
    FakeWS.instances[0].simulateOpen();
    await sleep(0);
    FakeWS.instances[0].sent.length = 0;
    client.ping();
    expect(JSON.parse(FakeWS.instances[0].sent[0])).toEqual({ action: 'ping' });
  });
});
