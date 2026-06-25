/**
 * Impermanent Loss (IL) calculations.
 *
 * V2 IL is the classical formula:
 *   IL(p) = 2 * sqrt(p) / (1 + p) - 1
 * where p = newPrice / oldPrice.
 *
 * V3 IL depends on the concentrated range.  When upper == lower, the position
 * is fully concentrated at a single tick (degenerate), so we treat it as V2
 * (concentration = 1) — a safe default rather than a singularity.
 */

export const MIN_IL = -1; // IL is bounded below by -100% (full loss)

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
 * @param concentration amplification factor — smaller range ⇒ higher concentration.
 *                      When pl == pu, concentration is forced to 1 to avoid the
 *                      singularity at zero range.
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
  let c = concentration;
  if (pl === pu) c = 1;
  if (c <= 0) throw new Error('INVALID_CONCENTRATION');

  if (p < pl || p > pu) {
    // Out of range: bounded by a similar expression; cap at MIN_IL.
    // We still want a finite value, so approximate with the boundary V2 IL.
    const boundaryP = p < pl ? pl : pu;
    return Math.max(MIN_IL, calculateV2IL(boundaryP) / c);
  }

  // In range: V3 IL is V2 IL amplified by 1 / c.
  const v2 = calculateV2IL(p);
  return Math.max(MIN_IL, v2 / c);
}

/** Convert a fractional IL to a percentage value. */
export function ilToPercent(il: number): number {
  return il * 100;
}

/** Convenience: derive priceRatio from two absolute prices. */
export function priceRatioFromPrices(newPrice: number, oldPrice: number): number {
  if (oldPrice <= 0) throw new Error('INVALID_OLD_PRICE');
  return newPrice / oldPrice;
}
