/**
 * Pool-related types.
 * Represents an AMM liquidity pool with its current and historical state.
 */

import type { DexProtocol } from './transaction';

export type PoolType = 'constant_product' | 'concentrated' | 'stable' | 'weighted';

/** A token in a pool, with metadata. */
export interface PoolToken {
  address: string;
  symbol: string;
  decimals: number;
}

/** Reserves / liquidity for a pool. For V2, reserveX/reserveY are the actual reserves.
 *  For V3, they represent the virtual reserves for the active tick. */
export interface Pool {
  /** Pool contract address. */
  address: string;
  /** Protocol. */
  protocol: DexProtocol;
  /** Pool type. */
  type: PoolType;
  /** Two tokens (V2). */
  token0: PoolToken;
  token1: PoolToken;
  /** Reserve of token0 (raw integer, token decimals). */
  reserve0: bigint;
  /** Reserve of token1 (raw integer, token decimals). */
  reserve1: bigint;
  /** Fee tier in hundredths of a bip (e.g. 3000 = 0.3%). */
  fee: number;
  /** Current sqrtPriceX96 for V3 pools, undefined for V2. */
  sqrtPriceX96?: bigint;
  /** Current tick for V3 pools. */
  tick?: number;
  /** V3 tick range for concentrated positions. */
  tickLower?: number;
  tickUpper?: number;
  /** Total LP supply for V2 pools. */
  totalSupply?: bigint;
  /** Block of the snapshot. */
  blockNumber: number;
  /** Unix epoch seconds of the snapshot. */
  timestamp: number;
}

/** Price of a token in a quote asset, expressed in the quote's smallest unit. */
export interface PriceQuote {
  token: string;
  quoteToken: string;
  /** Price scaled by 1e18. */
  priceE18: bigint;
  timestamp: number;
}
