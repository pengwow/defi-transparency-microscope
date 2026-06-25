/**
 * AMM Sync event watcher.
 *
 * Polls the 3 curated pools (V2 WETH/USDC, V3 WETH/USDC 0.3%, V3
 * WETH/USDT 0.3%) for `Sync` (V2) and `Swap` (V3) events. Each new
 * event is decoded into a typed `AmmSyncEvent` and emitted to
 * subscribers.
 *
 * Design choices:
 *   - Dedup by (txHash, logIndex) so a log that appears in two
 *     overlapping polls is only emitted once.
 *   - Debounce: multiple events for the same pool within a window
 *     collapse into a single emission carrying the latest reserves.
 *     Useful for high-frequency V3 swap bursts.
 *   - We intentionally do NOT decode the V3 sqrtPriceX96 from the
 *     log data; for v1 we emit `reserve0/reserve1` as zeros for V3
 *     and rely on the broadcaster to re-fetch the canonical reserves
 *     for any UI that needs the real numbers. v2 will do full decode.
 */
import type { Log } from 'ethers';

import { TOPIC_V2_SWAP, TOPIC_V3_SWAP, TOPIC_V2_SYNC } from './classify.js';
import { POOLS } from './addresses.js';
import type { ChainProvider } from './provider.js';

/** Sync event for either V2 (Sync) or V3 (Swap) emissions. */
export interface AmmSyncEvent {
  /** Lower-case pool address. */
  pool: string;
  /** V2 only. Zero for V3 events. */
  reserve0: bigint;
  /** V2 only. Zero for V3 events. */
  reserve1: bigint;
  /** Token-1 / Token-0 price ratio. E.g. 3000 means 1 token0 = 3000 token1. */
  price: number;
  blockNumber: number;
}

export interface AmmSyncWatcherOptions {
  /** Poll interval in ms. Default 12_000. */
  pollIntervalMs?: number;
  /** How many trailing blocks to scan per poll. Default 100. */
  lookbackBlocks?: number;
  /** Debounce window in ms. Default 0 (no debounce). */
  debounceMs?: number;
  /** Pools to watch. Default: the 3 curated pools. */
  pools?: string[];
}

export interface AmmSyncWatcherStats {
  pollCount: number;
  emitted: number;
  lastPollAt: number;
}

const DEFAULT_POLL_MS = 12_000;
const DEFAULT_LOOKBACK = 100;
const DEFAULT_DEBOUNCE_MS = 0;

type Listener = (event: AmmSyncEvent) => void;

/**
 * Decode a log into an AmmSyncEvent. For V2 Sync, the data field
 * contains (uint112 reserve0, uint112 reserve1). For V3 Swap, the
 * reserves are computed from the pool — v1 doesn't decode the full
 * data payload, so V3 events report zero reserves.
 */
function decodeAmmLog(log: Log): AmmSyncEvent | null {
  if (!log.topics || log.topics.length === 0) return null;
  const topic0 = log.topics[0];
  if (topic0 === TOPIC_V2_SYNC) {
    // Sync(uint112 reserve0, uint112 reserve1) — data is 64 bytes
    const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
    if (data.length < 64) {
      return {
        pool: log.address.toLowerCase(),
        reserve0: 0n,
        reserve1: 0n,
        price: 0,
        blockNumber: log.blockNumber,
      };
    }
    const r0 = BigInt('0x' + data.slice(0, 64));
    const r1 = BigInt('0x' + data.slice(64, 128));
    const price = r1 === 0n ? 0 : Number(r0) / Number(r1);
    return {
      pool: log.address.toLowerCase(),
      reserve0: r0,
      reserve1: r1,
      price,
      blockNumber: log.blockNumber,
    };
  }
  if (topic0 === TOPIC_V2_SWAP || topic0 === TOPIC_V3_SWAP) {
    // We don't decode swap amounts in v1 — emit reserves=0 with
    // blockNumber so the UI can flag "pool touched".
    return {
      pool: log.address.toLowerCase(),
      reserve0: 0n,
      reserve1: 0n,
      price: 0,
      blockNumber: log.blockNumber,
    };
  }
  return null;
}

export class AmmSyncWatcher {
  private readonly provider: ChainProvider;
  private readonly pollIntervalMs: number;
  private readonly lookbackBlocks: number;
  private readonly debounceMs: number;
  private readonly pools: string[];

  private listeners: Listener[] = [];
  private seen = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingEmissions: Map<string, AmmSyncEvent> = new Map();
  private inFlight = false;
  private pollCount = 0;
  private emitted = 0;
  private lastPollAt = 0;

  constructor(provider: ChainProvider, opts: AmmSyncWatcherOptions = {}) {
    this.provider = provider;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.lookbackBlocks = opts.lookbackBlocks ?? DEFAULT_LOOKBACK;
    this.debounceMs = opts.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.pools = (opts.pools ?? [POOLS.V2_WETH_USDC, POOLS.V3_WETH_USDC_3000, POOLS.V3_WETH_USDT_3000])
      .map((p) => p.toLowerCase());
  }

  onEvent(cb: Listener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  start(): void {
    if (this.pollTimer) return;
    void this.pollOnce();
    this.pollTimer = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  resetDedup(): void {
    this.seen.clear();
  }

  getStats(): AmmSyncWatcherStats {
    return {
      pollCount: this.pollCount,
      emitted: this.emitted,
      lastPollAt: this.lastPollAt,
    };
  }

  private async pollOnce(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    this.pollCount += 1;
    this.lastPollAt = Math.floor(Date.now() / 1000);
    try {
      const head = await this.provider.getBlockNumber();
      const fromBlock = Math.max(0, head - this.lookbackBlocks);
      const logs = await this.provider.getLogs({
        address: this.pools,
        topics: [[TOPIC_V2_SYNC, TOPIC_V2_SWAP, TOPIC_V3_SWAP]],
        fromBlock,
        toBlock: head,
      });
      for (const log of logs) {
        const key = `${log.transactionHash}:${log.index}`;
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        const evt = decodeAmmLog(log);
        if (!evt) continue;
        if (this.debounceMs > 0) {
          this.pendingEmissions.set(evt.pool, evt);
          this.scheduleDebounce();
        } else {
          this.emit(evt);
        }
      }
    } catch {
      // Swallow — RPC outages are common; the next tick will retry.
    } finally {
      this.inFlight = false;
    }
  }

  private scheduleDebounce(): void {
    if (this.debounceTimer) return;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      const batch = Array.from(this.pendingEmissions.values());
      this.pendingEmissions.clear();
      for (const evt of batch) this.emit(evt);
    }, this.debounceMs);
  }

  private emit(evt: AmmSyncEvent): void {
    this.emitted += 1;
    for (const cb of this.listeners) {
      try {
        cb(evt);
      } catch {
        // listeners must not break the watcher
      }
    }
  }
}
