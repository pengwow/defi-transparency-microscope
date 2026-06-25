/**
 * Tests for chain/mempool.ts — the mempool event source.
 *
 * Spec §5.2 / §13.1: subscribe to `pendingTransactions` over WS, fall
 * back to HTTP polling every 1.5s when the WS disconnects > 3 times.
 *
 * For tests we never touch a real RPC. Instead we drive the source
 * via a fake `ChainProvider` (for the HTTP-poll path) and a fake
 * `MempoolTransport` (for the WS path) so the tests are deterministic
 * and fast.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  MempoolSource,
  type MempoolTransport,
  type MempoolTransportHandle,
  type MempoolTransportHandlers,
  type PendingTx,
} from '../../src/chain/mempool.js';
import type { ChainProvider } from '../../src/chain/provider.js';

/** Build a fake ChainProvider whose `send` returns the supplied payloads. */
function makeProvider(sendImpl: (method: string) => Promise<unknown>): ChainProvider {
  return {
    getBlockNumber: vi.fn(async () => 100),
    getNetwork: vi.fn(async () => ({ chainId: 1n, name: 'mainnet', ensAddress: undefined })),
    getChainId: vi.fn(async () => 1),
    getBalance: vi.fn(async () => 0n),
    call: vi.fn(async () => '0x'),
    getLogs: vi.fn(async () => []),
    getBlock: vi.fn(async () => null),
    getTransaction: vi.fn(async () => null),
    send: sendImpl as never,
  } as unknown as ChainProvider;
}

/** A pending tx that hits the V3 Swap topic → classifier will mark it as 'normal'. */
const SAMPLE_PENDING: PendingTx = {
  hash: '0x' + 'ab'.repeat(32),
  from: '0x' + '11'.repeat(20),
  to: '0x' + '22'.repeat(20),
  value: 0n,
  gasPrice: 50_000_000_000n,
  input: '0x',
  nonce: 1,
  type: 'normal',
  timestamp: 0,
};

interface FakeTransportHandle extends MempoolTransportHandle {
  /** Test-only: capture the registered handlers. */
  _handlers?: MempoolTransportHandlers;
}

function makeTransport(impl: () => FakeTransportHandle): MempoolTransport {
  return {
    subscribe: vi.fn((handlers: MempoolTransportHandlers) => {
      const h = impl();
      h._handlers = handlers;
      return h;
    }),
  };
}

describe('MempoolSource — HTTP poll mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start() polls every pollIntervalMs; stop() halts polling', async () => {
    const send = vi.fn(async (method: string) => {
      if (method === 'eth_pendingTransactions') return [SAMPLE_PENDING];
      return null;
    });
    const provider = makeProvider(send);
    const src = new MempoolSource({
      provider,
      pollIntervalMs: 100,
      transport: null,
    });
    const received: PendingTx[][] = [];
    src.onMessage((txs) => received.push(txs));
    src.start();
    // start() fires one immediate poll (synchronously kicked off), so
    // we expect at least 1 emission right away after the first await.
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledWith('eth_pendingTransactions', []);
    expect(received).toHaveLength(1);
    // Advance through one more interval — should fire again
    await vi.advanceTimersByTimeAsync(100);
    expect(received.length).toBeGreaterThanOrEqual(2);
    src.stop();
    await vi.advanceTimersByTimeAsync(500);
    const stoppedAt = received.length;
    await vi.advanceTimersByTimeAsync(500);
    expect(received).toHaveLength(stoppedAt);
  });

  it('does not double-poll while a previous poll is still in flight', async () => {
    let resolveFirst!: (v: PendingTx[]) => void;
    const send = vi.fn((method: string) => {
      if (method === 'eth_pendingTransactions') {
        return new Promise<PendingTx[]>((resolve) => {
          resolveFirst = resolve as never;
        });
      }
      return Promise.resolve(null);
    });
    const provider = makeProvider(send as never);
    const src = new MempoolSource({ provider, pollIntervalMs: 100, transport: null });
    src.start();
    await vi.advanceTimersByTimeAsync(100);
    // The first poll is still in flight
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(100);
    // Still only one in flight
    expect(send).toHaveBeenCalledTimes(1);
    resolveFirst([SAMPLE_PENDING]);
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledTimes(2);
    src.stop();
  });
});

describe('MempoolSource — WS mode', () => {
  it('emits transactions via the transport callback when connected', () => {
    const t = makeTransport(() => {
      return {
        close: () => undefined,
        isConnected: () => true,
      };
    });
    const provider = makeProvider(vi.fn(async () => null));
    const src = new MempoolSource({ provider, pollIntervalMs: 1_000, transport: t });
    const received: PendingTx[][] = [];
    src.onMessage((txs) => received.push(txs));
    src.start();
    // The transport was given handlers — invoke onPending to simulate a delivery.
    (t.subscribe as ReturnType<typeof vi.fn>).mock.results[0]?.value?._handlers?.onPending([
      SAMPLE_PENDING,
    ]);
    expect(received).toHaveLength(1);
    src.stop();
  });

  it('falls back to HTTP polling after 3 WS disconnects', async () => {
    vi.useFakeTimers();
    const send = vi.fn(async (method: string) => {
      if (method === 'eth_pendingTransactions') return [SAMPLE_PENDING];
      return null;
    });
    const provider = makeProvider(send);
    const t = makeTransport(() => ({
      close: vi.fn(),
      isConnected: () => false,
    }));
    const src = new MempoolSource({ provider, pollIntervalMs: 50, transport: t });
    src.start();
    expect(src.getStats().mode).toBe('ws');
    // Simulate 3 WS disconnects
    const handlers = (t.subscribe as ReturnType<typeof vi.fn>).mock.results[0]?.value
      ?._handlers as MempoolTransportHandlers;
    handlers.onDisconnect?.();
    expect(src.getStats().mode).toBe('ws');
    handlers.onDisconnect?.();
    expect(src.getStats().mode).toBe('ws');
    handlers.onDisconnect?.();
    expect(src.getStats().mode).toBe('http');
    // Now we should be polling
    await vi.advanceTimersByTimeAsync(100);
    expect(send).toHaveBeenCalledWith('eth_pendingTransactions', []);
    src.stop();
    vi.useRealTimers();
  });
});

describe('MempoolSource — classification integration', () => {
  it('classifies a pending tx that targets a curated V3 pool as a swap', () => {
    const V3_POOL = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
    const t = makeTransport(() => {
      return {
        close: () => undefined,
        isConnected: () => true,
      };
    });
    const provider = makeProvider(vi.fn(async () => null));
    const src = new MempoolSource({ provider, pollIntervalMs: 100, transport: t });
    let got: PendingTx | null = null;
    src.onMessage((txs) => {
      const [tx] = txs;
      if (tx) got = tx;
    });
    src.start();
    const handlers = (t.subscribe as ReturnType<typeof vi.fn>).mock.results[0]?.value
      ?._handlers as MempoolTransportHandlers;
    handlers.onPending([
      {
        hash: '0x' + 'cc'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: V3_POOL,
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        nonce: 1,
        type: 'normal',
        timestamp: 0,
      },
    ]);
    expect(got).not.toBeNull();
    expect(got!.to.toLowerCase()).toBe(V3_POOL.toLowerCase());
    src.stop();
  });

  it('skips emissions that the classifier cannot categorise (no signal)', () => {
    const t = makeTransport(() => ({
      close: () => undefined,
      isConnected: () => true,
    }));
    const provider = makeProvider(vi.fn(async () => null));
    const src = new MempoolSource({ provider, pollIntervalMs: 100, transport: t });
    const received: PendingTx[][] = [];
    src.onMessage((txs) => received.push(txs));
    src.start();
    const handlers = (t.subscribe as ReturnType<typeof vi.fn>).mock.results[0]?.value
      ?._handlers as MempoolTransportHandlers;
    handlers.onPending([SAMPLE_PENDING]);
    expect(received).toHaveLength(1);
    src.stop();
  });

  it('getStats reports mode, poll count, and disconnect count', () => {
    const t = makeTransport(() => ({
      close: () => undefined,
      isConnected: () => true,
    }));
    const provider = makeProvider(vi.fn(async () => null));
    const src = new MempoolSource({ provider, pollIntervalMs: 100, transport: t });
    src.start();
    const stats = src.getStats();
    expect(stats.mode).toBe('ws');
    expect(stats.pollCount).toBe(0);
    expect(stats.disconnectCount).toBe(0);
    src.stop();
  });
});
