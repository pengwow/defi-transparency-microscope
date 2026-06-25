/**
 * Profit-attribution experiment.
 *
 * Decomposes a trader's P&L into named components per spec §9.3:
 *
 *   total = priceImpact + fees - gasCost + rebates
 *
 * The frontend analogue lives at `frontend/src/algorithms/attribution.ts`;
 * we re-implement the math here to keep the backend self-contained
 * (per the design spec §9.3).
 *
 * The `priceImpact` term is the spot-vs-actual-output shortfall (a
 * negative number for a normal swap: the trader got fewer tokens than
 * the spot rate would predict, and that delta is captured as a signed
 * "impact" they bear).  `fees` is the LP fee they paid; we model it as
 * a negative contribution to net P&L.  `gasCost` and `rebates` are
 * passed through from the caller.
 */

import { getAmountOut } from './cpmm.js';
import type { AttributionInput, ExperimentResult } from './types.js';

export type AttributeKey = 'priceImpact' | 'fees' | 'gasCost' | 'rebates';

export interface AttributionComponents {
  priceImpact: bigint;
  fees: bigint;
  gasCost: bigint;
  rebates: bigint;
}

export interface AttributionResult {
  /** Signed net P&L in token0 units. */
  total: bigint;
  /** The original components, unchanged. */
  breakdown: AttributionComponents;
  /** Per-component share of |total|; values are in [0, 1] and sum to 1. */
  percentages: Record<AttributeKey, number>;
}

export interface AttributionExperimentResult extends Record<string, unknown> {
  priceImpact: string;
  fees: string;
  gasCost: string;
  rebates: string;
  netPnl: string;
  /** Percentages keyed by component. */
  percentages: Record<AttributeKey, number>;
  reserve0: string;
  reserve1: string;
  amountIn: string;
  feeHundredthsBip: number;
}

/**
 * Helper: compute total + breakdown + percentages from a components bag.
 *
 * Uses the absolute total as the denominator so the percentages are
 * always positive and sum to 1 (or all zero when the total is 0).
 */
export function attributeProfit(components: AttributionComponents): AttributionResult {
  const { priceImpact, fees, gasCost, rebates } = components;
  const total = priceImpact + fees - gasCost + rebates;

  const breakdown: AttributionComponents = { priceImpact, fees, gasCost, rebates };

  const abs = total < 0n ? -total : total;
  let percentages: Record<AttributeKey, number>;
  if (abs === 0n) {
    percentages = { priceImpact: 0, fees: 0, gasCost: 0, rebates: 0 };
  } else {
    percentages = {
      priceImpact: Math.abs(Number(priceImpact)) / Number(abs),
      fees: Math.abs(Number(fees)) / Number(abs),
      gasCost: Math.abs(Number(gasCost)) / Number(abs),
      rebates: Math.abs(Number(rebates)) / Number(abs),
    };
  }

  return { total, breakdown, percentages };
}

/**
 * Compute the price-impact component of an attribution run.
 *
 *   priceImpact = actualOut - idealOut
 *
 * `idealOut` is what a zero-fee swap would yield; the actual output
 * is the CPMM swap output.  Both are in token1 units, so the result
 * is negative for any non-trivial trade (the trader "lost" some
 * token1 to impact).
 */
function priceImpactComponent(
  amountIn: bigint,
  reserve0: bigint,
  reserve1: bigint,
  feeHundredthsBip: bigint,
): bigint {
  if (amountIn <= 0n || reserve0 <= 0n || reserve1 <= 0n) return 0n;
  const idealOut = (amountIn * reserve1) / reserve0;
  const actualOut = getAmountOut(amountIn, reserve0, reserve1, feeHundredthsBip);
  return actualOut - idealOut;
}

/**
 * Compute the fees component of an attribution run.
 *
 *   fees = -(amountIn - amountInWithFee)
 *         = -(amountIn * feeHundredthsBip / feeDen)
 *
 * Negative because the trader paid them.
 */
function feesComponent(amountIn: bigint, feeHundredthsBip: bigint): bigint {
  if (amountIn <= 0n || feeHundredthsBip < 0n) return 0n;
  const feeDen = 1_000_000n;
  const fee = (amountIn * feeHundredthsBip) / feeDen;
  return -fee;
}

/**
 * Run an attribution experiment.
 *
 *  - Computes priceImpact from the spot-vs-actual CPMM math.
 *  - Computes fees from the pool fee tier.
 *  - Passes through `gasCost` and `rebates` from the input.
 *  - Net P&L = priceImpact + fees - gasCost + rebates.
 */
export function runAttributionExperiment(
  input: AttributionInput,
): ExperimentResult<AttributionExperimentResult> {
  const start = Date.now();
  const { reserve0, reserve1, amountIn, fee, rebates = 0n, gasCost = 0n } = input;

  const priceImpact = priceImpactComponent(amountIn, reserve0, reserve1, BigInt(fee));
  const fees = feesComponent(amountIn, BigInt(fee));

  const { total, percentages } = attributeProfit({
    priceImpact,
    fees,
    gasCost,
    rebates,
  });

  return {
    durationMs: Date.now() - start,
    result: {
      priceImpact: priceImpact.toString(),
      fees: fees.toString(),
      gasCost: gasCost.toString(),
      rebates: rebates.toString(),
      netPnl: total.toString(),
      percentages,
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      amountIn: amountIn.toString(),
      feeHundredthsBip: fee,
    },
  };
}
