/**
 * Shared domain types for the chain/* layer.
 *
 * These mirror the frontend `types/` module (Transaction, Pool,
 * LendingPosition, LPPosition) but live in the backend so the chain/*
 * code is self-contained. Per the design spec §4, the frontend and
 * backend copies are kept in sync manually — a CI check is out of scope
 * for v1.
 *
 * BigInt-safe: numeric quantities are bigint. JSON serialisation
 * (handled in `server.ts`) converts them to decimal strings.
 */
import type { TokenMeta } from './addresses.js';

export type { TokenMeta };

/** Spec §4: 'normal' | 'sandwich' | 'arbitrage' | 'jit' | 'liquidation' */
export type TxType = 'normal' | 'sandwich' | 'arbitrage' | 'jit' | 'liquidation';

export type Protocol = 'uniswap_v2' | 'uniswap_v3' | 'aave_v3';

export interface Token extends TokenMeta {}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  input: string;
  nonce: number;
  blockNumber?: number;
  timestamp: number;
  type: TxType;
  mevProfit?: bigint;
  victimLoss?: bigint;
}

export interface Pool {
  /** Lower-case address; convenient as a stable key. */
  id: string;
  protocol: 'uniswap_v2' | 'uniswap_v3';
  token0: Token;
  token1: Token;
  /** V2 only. */
  reserve0?: bigint;
  /** V2 only. */
  reserve1?: bigint;
  /** V3 only. */
  sqrtPriceX96?: bigint;
  /** V3 only (e.g. 3000 = 0.3 %). */
  feeTier?: number;
  /** V3 only. */
  liquidity?: bigint;
  /** V3 only. */
  tick?: number;
}

export interface LendingPosition {
  id: string;
  owner: string;
  protocol: 'aave_v3';
  /** token address → amount. */
  collateral: Record<string, bigint>;
  /** token address → amount. */
  debt: Record<string, bigint>;
  liquidationThresholdE18: bigint;
  /** Scaled by 1e18; 1e18 == healthy 1.0. */
  healthFactor: number;
  timestamp: number;
}

export interface LPPosition {
  /** NFT tokenId as decimal string. */
  id: string;
  owner: string;
  poolId: string;
  token0: Token;
  token1: Token;
  amount0: bigint;
  amount1: bigint;
  tickLower: number;
  tickUpper: number;
  /** 500, 3000 or 10000. */
  feeTier: number;
  apr: number;
  valueUsd: number;
  feeIncomeE18: bigint;
  impermanentLossE18: bigint;
  netPnlE18: bigint;
  timestamp: number;
}
