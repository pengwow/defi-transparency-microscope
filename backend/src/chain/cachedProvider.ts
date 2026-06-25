/**
 * CachedProvider — wraps a `ChainProvider` with a TTL cache.
 *
 * The design spec §5.2 says: "All providers wrapped in a `CachedProvider`
 * that memoises read calls for `CACHE_TTL_MS`." The implementation caches
 * only the methods that are safe to memoise (idempotent reads with simple
 * cache keys); `getLogs` is too varied to key safely and is forwarded
 * directly.
 *
 * Methods cached:
 *   - getBlockNumber
 *   - getChainId
 *   - getNetwork
 *   - getBalance
 *   - call
 *
 * Methods forwarded (no caching):
 *   - getLogs
 *   - getBlock
 *   - getTransaction
 *
 * Cache invalidation: per-key TTL via `Date.now()`. No cross-key
 * invalidation, no explicit `clear()` (callers that need to force a
 * refresh can just construct a new instance).
 */
import type {
  AddressLike,
  Block,
  BlockTag,
  Filter,
  FilterByBlockHash,
  Log,
  Network,
  TransactionRequest,
  TransactionResponse,
} from 'ethers';
import type { ChainProvider } from './provider.js';

export interface CachedProviderOptions {
  /** Time-to-live for cached entries, in milliseconds. Default 5_000. */
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Stable string key for an arbitrary request argument. */
function stableKey(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string') return `s:${value.toLowerCase()}`;
  if (typeof value === 'number' || typeof value === 'bigint') return `n:${value.toString()}`;
  if (typeof value === 'boolean') return `b:${value}`;
  // For objects (e.g. TransactionRequest) produce a stable JSON key by
  // sorting keys. We only need structural equality here, not deep
  // reference tracking.
  return `o:${JSON.stringify(value, Object.keys(value as object).sort())}`;
}

export class CachedProvider implements ChainProvider {
  private readonly ttlMs: number;
  private readonly blockNumberCache = new Map<string, CacheEntry<number>>();
  private readonly balanceCache = new Map<string, CacheEntry<bigint>>();
  private readonly callCache = new Map<string, CacheEntry<string>>();
  private readonly chainIdCache = new Map<string, CacheEntry<number>>();
  private readonly networkCache = new Map<string, CacheEntry<Network>>();

  constructor(
    private readonly inner: ChainProvider,
    opts: CachedProviderOptions = {},
  ) {
    this.ttlMs = opts.ttlMs ?? DEFAULT_TTL_MS;
  }

  private now(): number {
    return Date.now();
  }

  private getOrCompute<T>(
    cache: Map<string, CacheEntry<T>>,
    key: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    const entry = cache.get(key);
    const now = this.now();
    if (entry && entry.expiresAt > now) {
      return Promise.resolve(entry.value);
    }
    const promise = compute();
    void promise.then((value) => {
      cache.set(key, { value, expiresAt: this.now() + this.ttlMs });
    });
    return promise;
  }

  getBlockNumber(): Promise<number> {
    return this.getOrCompute(this.blockNumberCache, '__blockNumber__', () =>
      this.inner.getBlockNumber(),
    );
  }

  getBalance(address: AddressLike, blockTag?: BlockTag): Promise<bigint> {
    const key = `${stableKey(address)}|${stableKey(blockTag)}`;
    return this.getOrCompute(this.balanceCache, key, () =>
      this.inner.getBalance(address, blockTag),
    );
  }

  getChainId(): Promise<number> {
    return this.getOrCompute(this.chainIdCache, '__chainId__', () =>
      this.inner.getChainId(),
    );
  }

  getNetwork(): Promise<Network> {
    return this.getOrCompute(this.networkCache, '__network__', () =>
      this.inner.getNetwork(),
    );
  }

  call(tx: TransactionRequest, blockTag?: BlockTag): Promise<string> {
    const key = `${stableKey(tx)}|${stableKey(blockTag)}`;
    return this.getOrCompute(this.callCache, key, () => this.inner.call(tx, blockTag));
  }

  // --- passthrough methods (not cached) ---

  getLogs(filter: Filter | FilterByBlockHash): Promise<Array<Log>> {
    return this.inner.getLogs(filter);
  }

  getBlock(
    blockHashOrBlockTag: BlockTag | string,
    prefetchTxs?: boolean,
  ): Promise<null | Block> {
    return this.inner.getBlock(blockHashOrBlockTag, prefetchTxs);
  }

  getTransaction(hash: string): Promise<null | TransactionResponse> {
    return this.inner.getTransaction(hash);
  }
}
