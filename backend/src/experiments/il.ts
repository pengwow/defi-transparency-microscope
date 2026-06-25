/**
 * Impermanent Loss (IL) experiment.
 *
 * Pure math ported from `frontend/src/algorithms/il.ts`. We deliberately
 * duplicate the ~50 lines of math here so the backend stays
 * dependency-free of frontend code (per the design spec §9.3).
 *
 * The V2 formula is:
 *   IL(p) = 2 * sqrt(p) / (1 + p) - 1
 * where p = newPrice / oldPrice.
 *
 * V3 amplifies the loss by 1/concentration within the active range and
 * falls back to a boundary V2 IL when the price is out of range.
 * When the range is degenerate (pl == pu) we force concentration to 1
 * and delegate to the V2 formula to avoid the singularity.
 */

import type { ExperimentResult, ILInput } from './types.js';

/** IL is bounded below by -100% (full loss). */
export const MIN_IL = -1;

export interface IlResult extends Record<string, unknown> {
  il: number;
  variant: 'v2' | 'v3';
  reserve0: string;
  reserve1: string;
  priceRatio: number;
}

/**
 * V2 impermanent loss as a fractional value in [-1, 0].
 * @param priceRatio  newPrice / oldPrice
 */
export function calculateV2IL(priceRatio: number): number {
  if (!Number.isFinite(priceRatio) || priceRatio <= 0) {
    throw new Error('INVALID_PRICE_RATIO');
  }
  const sqrt = Math.sqrt(priceRatio);
  const il = (2 * sqrt) / (1 + priceRatio) - 1;
  return Math.max(MIN_IL, il);
}

/**
 * V3 impermanent loss for a concentrated position.
 *
 * @param p             new price
 * @param pl            lower bound price
 * @param pu            upper bound price
 * @param concentration amplification factor — smaller range ⇒ higher
 *                      concentration.  When pl == pu, concentration is
 *                      forced to 1 to avoid the singularity.
 */
export function calculateV3IL(
  p: number,
  pl: number,
  pu: number,
  concentration: number = 1,
): number {
  if (!Number.isFinite(p) || p <= 0) throw new Error('INVALID_PRICE');
  if (!Number.isFinite(pl) || pl <= 0) throw new Error('INVALID_PRICE_LOWER');
  if (!Number.isFinite(pu) || pu <= 0) throw new Error('INVALID_PRICE_UPPER');
  if (pl > pu) throw new Error('INVALID_RANGE');

  // Degenerate range ⇒ fall back to V2 (concentration = 1).
  if (pl === pu) return calculateV2IL(p);

  const c = concentration;
  if (c <= 0) throw new Error('INVALID_CONCENTRATION');

  if (p < pl || p > pu) {
    // Out of range: use the boundary V2 IL scaled by 1/c, then clamp.
    const boundaryP = p < pl ? pl : pu;
    return Math.max(MIN_IL, calculateV2IL(boundaryP) / c);
  }

  // In range: V3 IL is V2 IL amplified by 1 / c.
  const v2 = calculateV2IL(p);
  return Math.max(MIN_IL, v2 / c);
}

/**
 * Run an impermanent-loss experiment.  Picks the V2 or V3 calculator
 * based on whether tick bounds are supplied.
 */
export function runIlExperiment(input: ILInput): ExperimentResult<IlResult> {
  const start = Date.now();

  const { reserve0, reserve1, priceRatio, tickLower, tickUpper, concentration } = input;

  let il: number;
  let variant: 'v2' | 'v3';

  if (tickLower !== undefined && tickUpper !== undefined) {
    il = calculateV3IL(priceRatio, tickLower, tickUpper, concentration ?? 1);
    variant = 'v3';
  } else {
    il = calculateV2IL(priceRatio);
    variant = 'v2';
  }

  return {
    durationMs: Date.now() - start,
    result: {
      il,
      variant,
      reserve0: reserve0.toString(),
      reserve1: reserve1.toString(),
      priceRatio,
    },
  };
}
