/**
 * Tests for chain/liquidationWatcher.ts — Aave V3 LiquidationCall
 * event watcher.
 *
 * Spec §3 (ws/): a watcher that polls Aave V3 `LiquidationCall` events
 * and emits typed `LiquidationEventData` payloads to subscribers.
 *
 * Tests drive the watcher via a fake `ChainProvider` whose `getLogs`
 * returns a controlled list of logs. We exercise:
 *   - event detection (V3 LiquidationCall topic → emit)
 *   - deduplication (the same txHash / logIndex emitted only once)
 *   - restart (start/stop/start preserves the dedup set)
 *   - poll loop timing
 *   - error swallowing (one failed poll doesn't crash the watcher)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { id, type Log } from 'ethers';

import { LiquidationWatcher } from '../../src/chain/liquidationWatcher.js';
import type { ChainProvider } from '../../src/chain/provider.js';

const AAVE_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const LIQ_TOPIC = id(
  'LiquidationCall(address,address,address,uint256,uint256,address,bool,uint256,uint256,uint256,uint256,uint256)',
);

function makeLiqLog(overrides: Partial<Log> = {}): Log {
  return {
    address: AAVE_POOL,
    blockHash: '0x' + 'aa'.repeat(32),
    blockNumber: 100,
    data: '0x' + '00'.repeat(32 * 5),
    topics: [LIQ_TOPIC, '0x' + '11'.repeat(32), '0x' + '22'.repeat(32), '0x' + '33'.repeat(32)],
    transactionHash: '0x' + 'ee'.repeat(32),
    transactionIndex: 0,
    index: 0,
    removed: false,
    ...overrides,
  } as Log;
}

function makeProvider(opts: { logsByBlock?: Map<number, Log[]>; failNext?: boolean } = {}): {
  provider: ChainProvider;
  getLogs: ReturnType<typeof vi.fn>;
  getBlockNumber: ReturnType<typeof vi.fn>;
} {
  const logsByBlock = opts.logsByBlock ?? new Map<number, Log[]>();
  const getLogs = vi.fn(async (filter: { fromBlock: number; toBlock: number }) => {
    if (opts.failNext) {
      opts.failNext = false;
      throw new Error('rpc down');
    }
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
    getBlockNumber: vi.fn(async () => 100),
  };
}

describe('LiquidationWatcher', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits a liquidation event when a new LiquidationCall log is detected', async () => {
    const log = makeLiqLog({ blockNumber: 100 });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new LiquidationWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    // Lookback sweep runs immediately on start, then every interval.
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    const evt = events[0] as Record<string, unknown>;
    expect(evt.protocol).toBe('aave_v3');
    expect(evt.txHash).toBe(log.transactionHash);
    w.stop();
  });

  it('deduplicates logs by transactionHash + logIndex', async () => {
    const log = makeLiqLog({ blockNumber: 100 });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new LiquidationWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    // Subsequent polls return the same log — should not re-emit
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('emits a NEW event when a new log appears at a later block', async () => {
    const log1 = makeLiqLog({ blockNumber: 100, transactionHash: '0x' + '01'.repeat(32), index: 0 });
    const log2 = makeLiqLog({ blockNumber: 105, transactionHash: '0x' + '02'.repeat(32), index: 0 });
    const logsByBlock = new Map<number, Log[]>([
      [100, [log1]],
      [105, [log2]],
    ]);
    const { provider } = makeProvider({ logsByBlock });
    const w = new LiquidationWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 10 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    // head=100, lookback=10 → from=90, to=100; log1 should match
    expect(events).toHaveLength(1);
    // Move the head forward by re-mocking getBlockNumber
    let head = 100;
    vi.spyOn(provider, 'getBlockNumber').mockImplementation(async () => head);
    head = 110;
    // Add log2 to the watchable range
    logsByBlock.set(110, [log2]);
    await vi.advanceTimersByTimeAsync(100);
    // Now head=110, lookback=10, range 100..110; log2 should be emitted
    expect(events.length).toBeGreaterThanOrEqual(2);
    // Verify we still see log1 (dedup) and the new log2
    const hashes = events.map((e) => (e as { txHash: string }).txHash);
    expect(new Set(hashes).size).toBe(events.length);
    w.stop();
  });

  it('survives a single failing poll and continues to emit on the next', async () => {
    const log = makeLiqLog({ blockNumber: 100 });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    // Mutate the provider to fail on the first call only
    const realGetLogs = provider.getLogs;
    let calls = 0;
    vi.spyOn(provider, 'getLogs').mockImplementation(async (filter) => {
      calls += 1;
      if (calls === 1) throw new Error('temporary rpc error');
      return realGetLogs(filter as never);
    });
    const w = new LiquidationWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('start/stop/start preserves dedup (server restart does not re-emit)', async () => {
    const log = makeLiqLog({ blockNumber: 100 });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new LiquidationWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    const events: unknown[] = [];
    w.onEvent((e) => events.push(e));
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(events).toHaveLength(1);
    w.stop();
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    // The dedup set is preserved across stop/start (intentional — the
    // watcher doesn't want to spam clients with old events after a
    // server restart).
    expect(events).toHaveLength(1);
    w.stop();
  });

  it('getStats reports poll count and emitted count', async () => {
    const log = makeLiqLog({ blockNumber: 100 });
    const { provider } = makeProvider({ logsByBlock: new Map([[100, [log]]]) });
    const w = new LiquidationWatcher(provider, { pollIntervalMs: 100, lookbackBlocks: 1 });
    w.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(100);
    const stats = w.getStats();
    expect(stats.pollCount).toBeGreaterThanOrEqual(2);
    expect(stats.emitted).toBe(1);
    w.stop();
  });
});
