/**
 * Position-related types.
 * Represents an LP position with V2 and V3 variants.
 */

import type { DexProtocol } from './transaction';

export type PositionStatus = 'active' | 'closed' | 'out_of_range';

export interface BasePosition {
  /** Position NFT or contract id. */
  id: string;
  /** Owner address. */
  owner: string;
  /** Pool address. */
  poolAddress: string;
  /** Protocol. */
  protocol: DexProtocol;
  /** Status. */
  status: PositionStatus;
  /** When the position was opened (unix seconds). */
  openedAt: number;
  /** When the position was closed, if any. */
  closedAt?: number;
}

/** A V2 (or stable / weighted) LP position. */
export interface V2Position extends BasePosition {
  protocol: 'uniswap_v2' | 'sushiswap' | 'balancer';
  /** LP token amount owned. */
  liquidity: bigint;
  /** Underlying token amounts derived from liquidity / totalSupply. */
  amount0: bigint;
  amount1: bigint;
}

/** A V3 concentrated liquidity position. */
export interface V3Position extends BasePosition {
  protocol: 'uniswap_v3';
  /** Lower tick of the range. */
  tickLower: number;
  /** Upper tick of the range. */
  tickUpper: number;
  /** Active liquidity. */
  liquidity: bigint;
  /** Underlying token amounts at the current tick. */
  amount0: bigint;
  amount1: bigint;
  /** Tokens owed (uncollected fees). */
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export type Position = V2Position | V3Position;

/** A loan / debt position used for health-factor analysis. */
export interface LendingPosition {
  id: string;
  owner: string;
  /** Protocol (aave, compound, etc.). */
  protocol: string;
  /** Supplied collateral (token address → raw amount). */
  collateral: Record<string, bigint>;
  /** Borrowed debt (token address → raw amount). */
  debt: Record<string, bigint>;
  /** Current liquidation threshold (0..1, scaled by 1e18). */
  liquidationThresholdE18: bigint;
  timestamp: number;
  /** Optional demo field — collateralisation health factor (0..N). */
  healthFactor?: number;
  /** Optional demo field — price at which the position is liquidated. */
  liquidationPrice?: number;
  /** Optional demo field — bucketed health status. */
  status?: 'safe' | 'warning' | 'danger' | 'liquidated';
}
