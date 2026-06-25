/**
 * Aave V3 LiquidationCall event watcher.
 *
 * Polls `provider.getLogs` for the Aave V3 Pool's `LiquidationCall`
 * event on a fixed interval. Each new log is decoded into a typed
 * `LiquidationEvent` and emitted to subscribers via `onEvent`.
 *
 * Dedup: each unique (txHash, logIndex) is tracked in a Set so the
 * same log is never emitted twice. The set is preserved across
 * start/stop/start to avoid spamming clients with old events after
 * a server restart.
 *
 * Lookback: the watcher queries `head - lookbackBlocks` to `head` on
 * every tick. The default 100 blocks (≈20 minutes on mainnet) catches
 * any events we might have missed during a transient RPC failure.
 */
import type { Log } from 'ethers';

import { TOPIC_AAVE_LIQUIDATION_CALL } from './classify.js';
import { AAVE_V3_POOL } from './addresses.js';
import type { ChainProvider } from './provider.js';

/** Decoded Aave V3 liquidation event. */
export interface LiquidationEvent {
  /** Address of the liquidated user. */
  user: string;
  /** Address of the collateral asset seized. */
  collateral: string;
  /** Address of the debt asset repaid. */
  debt: string;
  /** Pre-liquidation health factor (E18-scaled; ≤ 1.0 means unhealthy). */
  hf: number;
  protocol: 'aave_v3';
  /** Liquidator's profit in the debt token's smallest unit. */
  profit: bigint;
  txHash: string;
  blockNumber: number;
}

export interface LiquidationWatcherOptions {
  /** Poll interval in ms. Default 12_000 (12s). */
  pollIntervalMs?: number;
  /** How many trailing blocks to scan per poll. Default 100. */
  lookbackBlocks?: number;
  /** Aave V3 Pool address; defaults to the curated mainnet address. */
  poolAddress?: string;
}

export interface LiquidationWatcherStats {
  pollCount: number;
  emitted: number;
  lastPollAt: number;
}

const DEFAULT_POLL_MS = 12_000;
const DEFAULT_LOOKBACK = 100;

type Listener = (event: LiquidationEvent) => void;

/**
 * Decode a LiquidationCall log into a typed event. The Aave V3 event
 * is the only one we care about — the classifier's topic check is
 * the gate that prevents non-liquidation logs from leaking through.
 */
function decodeLiquidationLog(log: Log): LiquidationEvent | null {
  if (!log.topics || log.topics.length < 4) return null;
  if (log.topics[0] !== TOPIC_AAVE_LIQUIDATION_CALL) return null;
  // topics[1] = collateralAsset, topics[2] = debtAsset, topics[3] = user
  return {
    user: '0x' + log.topics[3]!.slice(-40),
    collateral: '0x' + log.topics[1]!.slice(-40),
    debt: '0x' + log.topics[2]!.slice(-40),
    // Without decoding the full data payload we can't compute an
    // accurate HF — v1 reports 1.0 (the trigger threshold). v2 will
    // decode the `actualCollateralToLiquidate` and `actualDebtToCover`
    // fields for a real number.
    hf: 1.0,
    protocol: 'aave_v3',
    profit: 0n,
    txHash: log.transactionHash,
    blockNumber: log.blockNumber,
  };
}

export class LiquidationWatcher {
  private readonly provider: ChainProvider;
  private readonly pollIntervalMs: number;
  private readonly lookbackBlocks: number;
  private readonly poolAddress: string;

  private listeners: Listener[] = [];
  private seen = new Set<string>();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private pollCount = 0;
  private emitted = 0;
  private lastPollAt = 0;

  constructor(provider: ChainProvider, opts: LiquidationWatcherOptions = {}) {
    this.provider = provider;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.lookbackBlocks = opts.lookbackBlocks ?? DEFAULT_LOOKBACK;
    this.poolAddress = opts.poolAddress ?? AAVE_V3_POOL;
  }

  /** Register a listener; returns an unsubscribe function. */
  onEvent(cb: Listener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /** Begin polling. Idempotent. */
  start(): void {
    if (this.pollTimer) return;
    // Fire one immediate sweep so newly-started servers catch the
    // recent lookback window without waiting for the first tick.
    void this.pollOnce();
    this.pollTimer = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
  }

  /** Halt polling. Idempotent. */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Reset the dedup set. Used by tests; production should not need this. */
  resetDedup(): void {
    this.seen.clear();
  }

  /** Observability. */
  getStats(): LiquidationWatcherStats {
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
        address: this.poolAddress,
        topics: [[TOPIC_AAVE_LIQUIDATION_CALL]],
        fromBlock,
        toBlock: head,
      });
      for (const log of logs) {
        const key = `${log.transactionHash}:${log.index}`;
        if (this.seen.has(key)) continue;
        this.seen.add(key);
        const evt = decodeLiquidationLog(log);
        if (!evt) continue;
        this.emitted += 1;
        for (const cb of this.listeners) {
          try {
            cb(evt);
          } catch {
            // listeners must not break the watcher
          }
        }
      }
    } catch {
      // Swallow — RPC outages are common; the next tick will retry.
    } finally {
      this.inFlight = false;
    }
  }
}
