/**
 * Tests for chain/ammSyncWatcher.ts — Uniswap V2 `Sync` + V3 `Swap`
 * event watcher over the 3 curated pools.
 *
 * Spec §3: a watcher that emits AMM sync events to subscribers. Tests
 * cover:
 *   - V2 Sync log → emit
 *   - V3 Swap log → emit
 *   - dedup by (txHash, logIndex)
 *   - debounce (multiple syncs within a window collapse to one)
 *   - error swallowing
 *   - restart
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { id, type Log } from 'ethers';

import { AmmSyncWatcher } from '../../src/chain/ammSyncWatcher.js';
import { POOLS } from '../../src/chain/addresses.js';
import type { ChainProvider } from '../../src/chain/provider.js';

const V2_POOL = POOLS.V2_WETH_USDC;
const V3_USDC = POOLS.V3_WETH_USDC_3000;
const V2_SYNC = id('Sync(uint112,uint112)');
const V3_SWAP = id(
  'Swap(address,address,int256,int256,uint160,uint128,int24)',
);

function makeSyncLog(pool: string, blockNumber: number, overrides: Partial<Log> = {}): Log {
  return {
    address: pool,
    blockHash: '0x' + 'aa'.repeat(32),
    blockNumber,
    data: '0x' + '00'.repeat(64),
    topics: [V2_SYNC],
    transactionHash: '0x' + 'ee'.repeat(32),
    transactionIndex: 0,
    index: 0,
    removed: false,
    ...overrides,
  } as Log;
}

function makeSwapLog(pool: string, blockNumber: number, overrides: Partial<Log> = {}): Log {
  return {
    address: pool,
    blockHash: '0x' + 'bb'.repeat(32),
    blockNumber,
    data: '0x' + '00'.repeat(64),
    topics: [V3_SWAP, '0x' + '11'.repeat(32), '0x' + '22'.repeat(32)],
    transactionHash: '0x' + 'ff'.repeat(32),
    transactionIndex: 0,
    index: 0,
    removed: false,
    ...overrides,
  } as Log;
}

function makeProvider(opts: { logsByBlock?: Map<number, Log[]> } = {}): {
  provider: ChainProvider;
  getLogs: ReturnType<typeof vi.fn>;
} {
  const logsByBlock = opts.logsByBlock ?? new Map<number, Log[]>();
  const getLogs = vi.fn(async (filter: { fromBlock: number; toBlock: number }) => {
    const out: Log[] = [];
    for (let b = filter.fromBlock; b <= filter.toBlock; b += 1) {
      const list = logsByBlock.get(b);
      if (list) out.push(...list);
    }
    return out;
  });
  return {
    provider: {
      getBlockNumber: vi.fn(async () => 100),
      getNetwork: vi.fn(async () => ({ chainId: 1n, name: 'mainnet', ensAddress: undefined })),
      getChainId: vi.fn(async () => 1),
      getBalance: vi.fn(async () => 0n),
      call: vi.fn(async () => '0x'),
      getLogs,
      getBlock: vi.fn(async () => null),
      getTransaction: vi.fn(async () => null),
      send: vi.fn(async () => null),
    } as unknown as ChainProvider,
    getLogs,
  };
}

describe('AmmSyncWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits an amm_sync event for a V2 Sync log', async () => {
    const log = makeSyncLog(V2_POOL, 100, { transactionHash: '0x' + '01'.repeat(32) });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new AmmSyncWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    expect(evt.pool).toBe(V2_POOL.toLowerCase());
    expect(evt.reserve0).toBeDefined();
    w.stop();
  });

  it('emits an amm_sync event for a V3 Swap log', async () => {
    const log = makeSwapLog(V3_USDC, 100, { transactionHash: '0x' + '02'.repeat(32) });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new AmmSyncWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('deduplicates by txHash + logIndex', async () => {
    const log = makeSyncLog(V2_POOL, 100, { transactionHash: '0x' + '03'.repeat(32) });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new AmmSyncWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('debounce: collapses N rapid events on the same pool to 1 emission', async () => {
    // Three different V3 swap logs in different blocks but all close
    // together in time. With debounce, only one event is emitted per
    // pool per window.
    const log1 = makeSwapLog(V3_USDC, 100, { transactionHash: '0x' + '04'.repeat(32) });
    const log2 = makeSwapLog(V3_USDC, 100, { transactionHash: '0x' + '05'.repeat(32), index: 1 });
    const log3 = makeSwapLog(V3_USDC, 100, { transactionHash: '0x' + '06'.repeat(32), index: 2 });
    const { provider } = makeProvider({
      logsByBlock: new Map([[100, [log1, log2, log3]]]),
    });
    const w = new AmmSyncWatcher(provider, {
      pollIntervalMs: 100,
      lookbackBlocks: 1,
      debounceMs: 50,
    });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    // Nothing yet — debounce timer hasn't fired
    expect(events).toHaveLength(0);
    // After the debounce window, all three should be coalesced into 1
    // event with the latest reserves (we don't strictly verify the
    // reserve values, just the count).
    await vi.advanceTimersByTimeAsync(50);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('survives a single failing poll and continues to emit on the next', async () => {
    const log = makeSyncLog(V2_POOL, 100, { transactionHash: '0x' + '07'.repeat(32) });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const realGetLogs = provider.getLogs;
    let calls = 0;
    vi.spyOn(provider, 'getLogs').mockImplementation(async (filter) => {
      calls += 1;
      if (calls === 1) throw new Error('transient');
      return realGetLogs(filter as never);
    });
    const w = new AmmSyncWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('start/stop/start preserves dedup set', async () => {
    const log = makeSyncLog(V2_POOL, 100, { transactionHash: '0x' + '08'.repeat(32) });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new AmmSyncWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    w.stop();
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('getStats reports poll count and emitted count', async () => {
    const log = makeSyncLog(V2_POOL, 100, { transactionHash: '0x' + '09'.repeat(32) });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new AmmSyncWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    const stats = w.getStats();
    expect(stats.pollCount).toBeGreaterThanOrEqual(1);
    expect(stats.emitted).toBe(1);
    w.stop();
  });
});
