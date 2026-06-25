/**
 * CPMM (Constant Product Market Maker) — Uniswap V2 style.
 *
 * The invariant is x * y = k.  Swaps keep k constant absent fees; with the
 * 0.3% LPs fee, k grows over time.
 *
 * All amounts are raw integers in the token's smallest unit.
 */

const FEE_NUM = 997n;
const FEE_DEN = 1000n;
const ONE_E18 = 10n ** 18n;

/**
 * Compute the output amount of a swap with the 0.3% fee.
 *
 * amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
 */
export function getAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n) throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');

  const amountInWithFee = amountIn * FEE_NUM;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * FEE_DEN + amountInWithFee;
  return numerator / denominator;
}

/**
 * Compute the required input amount to receive a given output, accounting for
 * the 0.3% fee.  Adds 1 to the result to compensate for integer truncation.
 */
export function getAmountIn(amountOut: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountOut <= 0n) throw new Error('INSUFFICIENT_OUTPUT_AMOUNT');
  if (reserveIn <= 0n || reserveOut <= amountOut) throw new Error('INSUFFICIENT_LIQUIDITY');

  const numerator = reserveIn * amountOut * FEE_DEN;
  const denominator = (reserveOut - amountOut) * FEE_NUM;
  return numerator / denominator + 1n;
}

/**
 * Price impact in e18 fixed point. 0 = no impact; 1e18 = 100%.
 */
export function priceImpactE18(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (amountIn <= 0n) throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');

  const idealOut = (amountIn * reserveOut) / reserveIn;
  if (idealOut === 0n) return 0n;
  const actualOut = getAmountOut(amountIn, reserveIn, reserveOut);
  if (actualOut >= idealOut) return 0n;
  return ((idealOut - actualOut) * ONE_E18) / idealOut;
}

/** Reserves after a swap, along with the k invariant before and after. */
export function newReservesAfterSwap(
  amountIn: bigint,
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
): { reserveIn: bigint; reserveOut: bigint; kBefore: bigint; kAfter: bigint } {
  const kBefore = reserveIn * reserveOut;
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;
  const kAfter = newReserveIn * newReserveOut;
  return { reserveIn: newReserveIn, reserveOut: newReserveOut, kBefore, kAfter };
}

/** Spot price (reserveOut per reserveIn), scaled by 1e18. */
export function spotPriceE18(reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');
  return (reserveOut * ONE_E18) / reserveIn;
}
