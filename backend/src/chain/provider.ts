/**
 * ChainProvider — thin abstraction over `ethers.JsonRpcProvider` so the
 * chain/* layer can be unit-tested without hitting a real RPC node.
 *
 * Two implementations are provided:
 *  - `EthersChainProvider` (production) wraps an ethers provider and
 *    forwards every call to the underlying transport.
 *  - The `ChainProvider` interface is what the rest of the codebase
 *    consumes; tests can pass a hand-rolled stub that satisfies it.
 *
 * The shape intentionally mirrors a small subset of ethers' `Provider`
 * interface — the methods the rest of the backend actually uses. We do
 * NOT expose the full ethers surface; if a new module needs more, prefer
 * extending this interface over calling ethers directly.
 */
import {
  JsonRpcProvider,
  type AddressLike,
  type Block,
  type BlockTag,
  type Filter,
  type FilterByBlockHash,
  type Log,
  type Network,
  type TransactionRequest,
  type TransactionResponse,
} from 'ethers';

/**
 * Minimal async interface to an Ethereum-like JSON-RPC node.
 *
 * Designed to be easy to stub in tests and easy to satisfy by ethers'
 * `JsonRpcProvider`. All methods are `Promise`-returning and BigInt-safe.
 */
export interface ChainProvider {
  /** Current chain head block number. */
  getBlockNumber(): Promise<number>;

  /** Connected network info (chainId, name). */
  getNetwork(): Promise<Network>;

  /** Numeric chainId shorthand (most common check). */
  getChainId(): Promise<number>;

  /** Native ETH balance of an address at the given block tag. */
  getBalance(address: AddressLike, blockTag?: BlockTag): Promise<bigint>;

  /** Read-only call (eth_call). */
  call(tx: TransactionRequest, blockTag?: BlockTag): Promise<string>;

  /** Filtered event logs. */
  getLogs(filter: Filter | FilterByBlockHash): Promise<Array<Log>>;

  /** Block by number or hash; null if unknown. */
  getBlock(blockHashOrBlockTag: BlockTag | string, prefetchTxs?: boolean): Promise<null | Block>;

  /** Transaction by hash; null if unknown. */
  getTransaction(hash: string): Promise<null | TransactionResponse>;

  /**
   * Low-level JSON-RPC passthrough. Used for raw methods that the
   * high-level helpers don't expose, e.g. `eth_subscribe` and
   * `eth_pendingTransactions` for the mempool source.
   */
  send(method: string, params: Array<unknown> | object): Promise<unknown>;
}

/**
 * Production ChainProvider — delegates to an ethers v6 `JsonRpcProvider`.
 */
export class EthersChainProvider implements ChainProvider {
  constructor(private readonly provider: JsonRpcProvider) {}

  getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  getNetwork(): Promise<Network> {
    return this.provider.getNetwork();
  }

  async getChainId(): Promise<number> {
    const net = await this.provider.getNetwork();
    return Number(net.chainId);
  }

  getBalance(address: AddressLike, blockTag?: BlockTag): Promise<bigint> {
    return this.provider.getBalance(address, blockTag);
  }

  call(tx: TransactionRequest, _blockTag?: BlockTag): Promise<string> {
    return this.provider.call(tx);
  }

  getLogs(filter: Filter | FilterByBlockHash): Promise<Array<Log>> {
    return this.provider.getLogs(filter);
  }

  getBlock(
    blockHashOrBlockTag: BlockTag | string,
    prefetchTxs?: boolean,
  ): Promise<null | Block> {
    return this.provider.getBlock(blockHashOrBlockTag, prefetchTxs);
  }

  getTransaction(hash: string): Promise<null | TransactionResponse> {
    return this.provider.getTransaction(hash);
  }

  send(method: string, params: Array<unknown> | object): Promise<unknown> {
    return this.provider.send(method, params as never);
  }

  /**
   * Escape hatch — return the underlying ethers provider when a caller
   * genuinely needs the full surface (e.g. signing, subscriptions).
   */
  get raw(): JsonRpcProvider {
    return this.provider;
  }
}
