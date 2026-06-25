/**
 * Mempool event source.
 *
 * Spec §5.2 / §13.1: stream pending transactions from the public RPC.
 * Two modes, in order of preference:
 *   1. WS mode: subscribe via `eth_subscribe('pendingTransactions')`
 *      (WebSocket transport). Public WS RPCs are unreliable, so we
 *      count disconnects; after `maxWsDisconnects` failures we
 *      permanently fall back to HTTP polling.
 *   2. HTTP mode: poll `eth_pendingTransactions` every `pollIntervalMs`
 *      (default 1500 ms per spec §5.2).
 *
 * The source is transport-agnostic: production wires a `WebSocketProvider`,
 * tests pass a `MempoolTransport` stub.
 *
 * The "decoding" step that converts the raw hex envelope into a typed
 * `PendingTx` lives here too (it's the only place that needs both the
 * raw transport payload and the classifier context). For v1 we do a
 * best-effort decode; v2 can add ABI-aware decoders without changing
 * the public surface.
 */
import { type TransactionLike } from 'ethers';

import { classifyLog } from './classify.js';
import type { ChainProvider } from './provider.js';
import type { TxType } from './types.js';

/** Subset of an Ethereum pending tx the broadcaster cares about. */
export interface PendingTx {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gasPrice: bigint;
  input: string;
  nonce: number;
  type: TxType;
  timestamp: number;
}

/**
 * Transport abstraction. Production injects a `WebSocketProvider`;
 * tests inject a stub.
 */
export interface MempoolTransportHandle {
  close(): void;
  isConnected(): boolean;
}

export interface MempoolTransportHandlers {
  /** Called for every batch of pending transactions. */
  onPending: (txs: PendingTx[]) => void;
  /** Optional: called when the transport loses its connection. */
  onDisconnect?: () => void;
}

export interface MempoolTransport {
  /**
   * Subscribe to pending-transaction events. The transport invokes
   * the handlers in `handlers` for every batch / disconnect it
   * observes. Returns a handle the source uses to disconnect and to
   * query connection state.
   */
  subscribe(handlers: MempoolTransportHandlers): MempoolTransportHandle;
}

export interface MempoolSourceStats {
  mode: 'ws' | 'http' | 'stopped';
  pollCount: number;
  disconnectCount: number;
  emitted: number;
  dropped: number;
}

export interface MempoolSourceOptions {
  provider: ChainProvider;
  /** HTTP polling interval (ms). Default 1500 (spec §5.2). */
  pollIntervalMs?: number;
  /** Disconnect count before falling back to HTTP. Default 3. */
  maxWsDisconnects?: number;
  /** Inject a transport; null forces HTTP-only mode. */
  transport: MempoolTransport | null;
}

const DEFAULT_POLL_MS = 1_500;
const DEFAULT_MAX_DISCONNECTS = 3;

type Listener = (txs: PendingTx[]) => void;

/**
 * Best-effort decode of an `eth_pendingTransactions` payload into a
 * `PendingTx`. Public RPCs return wildly different shapes (some give
 * the full envelope, some give just hashes). We tolerate both.
 */
function decodePending(input: unknown, timestamp: number): PendingTx | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<TransactionLike> & {
    hash?: string;
    from?: string;
    to?: string | null;
    value?: string | bigint;
    gasPrice?: string | bigint;
    input?: string;
    nonce?: string | number;
  };
  if (!raw.hash) return null;
  // Synthesise a log to drive the classifier: any tx whose `to` is
  // one of the known pool addresses and whose input starts with the
  // V2/V3 swap selector is treated as a 'normal' swap baseline. v2
  // will do real decode + context.
  const to = raw.to ?? '0x';
  const fakeLog = {
    address: to,
    blockHash: '0x' + '00'.repeat(32),
    blockNumber: 0,
    data: raw.input ?? '0x',
    topics: [] as string[],
    transactionHash: raw.hash,
    transactionIndex: 0,
    index: 0,
    removed: false,
  };
  const txType: TxType = classifyLog(fakeLog as never);
  return {
    hash: raw.hash,
    from: raw.from ?? '0x' + '00'.repeat(20),
    to,
    value: BigInt(raw.value ?? 0n),
    gasPrice: BigInt(raw.gasPrice ?? 0n),
    input: raw.input ?? '0x',
    nonce: Number(raw.nonce ?? 0),
    type: txType,
    timestamp,
  };
}

/**
 * Mempool event source.
 *
 * Lifecycle:
 *   1. `start()` — try to use the transport if provided.
 *   2. On WS disconnect: increment a counter. After
 *      `maxWsDisconnects` failures, stop trying to use the transport
 *      and switch to HTTP polling.
 *   3. `stop()` — halt the poll timer, close the transport.
 */
export class MempoolSource {
  private readonly provider: ChainProvider;
  private readonly pollIntervalMs: number;
  private readonly maxWsDisconnects: number;
  private readonly transport: MempoolTransport | null;

  private listeners: Listener[] = [];
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private inFlight = false;
  private wsHandle: MempoolTransportHandle | null = null;
  private mode: 'ws' | 'http' | 'stopped' = 'stopped';
  private pollCount = 0;
  private disconnectCount = 0;
  private emitted = 0;
  private dropped = 0;

  constructor(opts: MempoolSourceOptions) {
    this.provider = opts.provider;
    this.pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_MS;
    this.maxWsDisconnects = opts.maxWsDisconnects ?? DEFAULT_MAX_DISCONNECTS;
    this.transport = opts.transport;
  }

  /** Register a listener for decoded pending-tx batches. */
  onMessage(cb: Listener): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /**
   * Begin streaming. Tries the WS transport first (if provided and
   * not in a fallen-back state); starts HTTP polling in parallel as
   * a safety net only if `pollIntervalMs > 0` and we are not in ws
   * mode. We do NOT poll in WS mode — the transport is the source of
   * truth. After `maxWsDisconnects` the mode switches to `http` and
   * polling starts.
   */
  start(): void {
    if (this.mode !== 'stopped') return;
    if (this.transport) {
      this.mode = 'ws';
      this.openTransport();
    } else {
      this.mode = 'http';
      this.startPolling();
    }
  }

  /** Halt everything. Idempotent. */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.wsHandle) {
      try {
        this.wsHandle.close();
      } catch {
        // best-effort
      }
      this.wsHandle = null;
    }
    this.mode = 'stopped';
  }

  /** Lightweight observability. */
  getStats(): MempoolSourceStats {
    return {
      mode: this.mode,
      pollCount: this.pollCount,
      disconnectCount: this.disconnectCount,
      emitted: this.emitted,
      dropped: this.dropped,
    };
  }

  private openTransport(): void {
    try {
      this.wsHandle = this.transport!.subscribe({
        onPending: (txs) => this.emit(txs),
        onDisconnect: () => this.recordDisconnect(),
      });
    } catch {
      // Transport construction failed — treat as a disconnect and
      // (after the threshold) fall back.
      this.recordDisconnect();
    }
  }

  /**
   * Called by the transport on every WS disconnect. The transport
   * itself is responsible for reconnection in production; for the
   * threshold check we just increment the counter. When the count
   * crosses the threshold we permanently switch to HTTP polling.
   */
  private recordDisconnect(): void {
    this.disconnectCount += 1;
    if (this.mode === 'ws' && this.disconnectCount >= this.maxWsDisconnects) {
      this.fallbackToHttp();
    }
  }

  /**
   * Forcibly switch to HTTP polling. Idempotent. Closes the WS
   * transport handle so it can't fire more events into the hub.
   */
  private fallbackToHttp(): void {
    this.mode = 'http';
    if (this.wsHandle) {
      try {
        this.wsHandle.close();
      } catch {
        // best-effort
      }
      this.wsHandle = null;
    }
    if (!this.pollTimer) this.startPolling();
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    // Fire once immediately, then on the interval.
    void this.pollOnce();
    this.pollTimer = setInterval(() => void this.pollOnce(), this.pollIntervalMs);
  }

  private async pollOnce(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    this.pollCount += 1;
    try {
      const result = (await this.provider.send('eth_pendingTransactions', [])) as unknown;
      const list = Array.isArray(result) ? result : [];
      const decoded: PendingTx[] = [];
      const ts = Math.floor(Date.now() / 1000);
      for (const item of list) {
        const tx = decodePending(item, ts);
        if (tx) decoded.push(tx);
      }
      if (decoded.length > 0) this.emit(decoded);
    } catch {
      this.dropped += 1;
    } finally {
      this.inFlight = false;
    }
  }

  private emit(txs: PendingTx[]): void {
    this.emitted += txs.length;
    for (const cb of this.listeners) {
      try {
        cb(txs);
      } catch {
        this.dropped += 1;
      }
    }
  }
}
