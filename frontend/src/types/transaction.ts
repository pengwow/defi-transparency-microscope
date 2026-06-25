/**
 * Transaction-related types.
 * Models a single on-chain swap or transfer for analysis.
 */

export type TxType = 'swap' | 'add_liquidity' | 'remove_liquidity' | 'transfer' | 'approve';

export type DexProtocol = 'uniswap_v2' | 'uniswap_v3' | 'sushiswap' | 'curve' | 'balancer' | 'unknown';

/** A single hop in a multi-hop swap. */
export interface SwapHop {
  /** Pool address. */
  pool: string;
  /** Token address of the input. */
  tokenIn: string;
  /** Token address of the output. */
  tokenOut: string;
  /** Input amount as raw integer (token decimals). */
  amountIn: bigint;
  /** Output amount as raw integer (token decimals). */
  amountOut: bigint;
  /** Protocol used for the hop. */
  protocol: DexProtocol;
}

/** Transaction record with decoded swap / liquidity / transfer details. */
export interface Transaction {
  /** Transaction hash. */
  hash: string;
  /** Block number. */
  blockNumber: number;
  /** Unix epoch seconds. */
  timestamp: number;
  /** EOA or contract that initiated the tx. */
  from: string;
  /** Recipient (often same as `from` for swaps). */
  to: string;
  /** Effective gas cost in wei. */
  gasUsed: bigint;
  /** Gas price in wei. */
  gasPrice: bigint;
  /** High-level classification. */
  type: TxType;
  /** Decoded swap hops, if any. */
  swaps?: SwapHop[];
  /** Token transfers (for liquidity / transfer txs). */
  transfers?: TokenTransfer[];
}

/** A single token transfer within a transaction. */
export interface TokenTransfer {
  token: string;
  from: string;
  to: string;
  amount: bigint;
}
