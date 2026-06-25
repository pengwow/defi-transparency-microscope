/**
 * Profit attribution: decompose a P&L into named components.
 *
 *   total = priceImpact + fees − gasCost + rebates
 *
 * The `priceImpact` term captures the user's directional exposure to the
 * asset's price move (signed: positive for favourable moves, negative for
 * adverse).  `fees` and `rebates` are LP / protocol flows.  `gasCost` is
 * always a cost.
 */

export type AttributeKey = 'priceImpact' | 'fees' | 'gasCost' | 'rebates';

export interface AttributionComponents {
  priceImpact: bigint;
  fees: bigint;
  gasCost: bigint;
  rebates: bigint;
}

export interface AttributionResult {
  /** Signed net P&L in 1e18-scaled units. */
  total: bigint;
  /** The original components, unchanged. */
  breakdown: AttributionComponents;
  /** Per-component share of |total|; values are in [0, 1] and sum to 1. */
  percentages: Record<AttributeKey, number>;
}

/** Compute the total, breakdown copy, and share of each component. */
export function attributeProfit(components: AttributionComponents): AttributionResult {
  const { priceImpact, fees, gasCost, rebates } = components;
  const total = priceImpact + fees - gasCost + rebates;

  const breakdown: AttributionComponents = { priceImpact, fees, gasCost, rebates };

  // Use the absolute total as the denominator so the percentages are always
  // positive and sum to 1 (or all zero when the total is 0).
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

/** Identity helper that returns the input; useful for serialization. */
export function componentsToObject(c: AttributionComponents): AttributionComponents {
  return { ...c };
}
