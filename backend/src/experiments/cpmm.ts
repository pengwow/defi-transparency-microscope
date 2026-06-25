/**
 * CPMM (Constant Product Market Maker) — Uniswap V2 style.
 *
 * Local copy of `frontend/src/algorithms/cpmm.ts`.  Per the design
 * spec §9.3 the backend re-implements the ~20 lines of CPMM math
 * rather than importing from the frontend.
 *
 * All amounts are raw integers in the token's smallest unit.
 */

const FEE_NUM = 997n;
const FEE_DEN = 1000n;

/**
 * Compute the output amount of a swap with a configurable fee in
 * hundredths of a bip (3000 = 0.30% — Uniswap V2 / V3(3000) default).
 *
 *   amountOut = (amountIn * feeNum * reserveOut) /
 *               (reserveIn * feeDen + amountIn * feeNum)
 *
 * @param feeHundredthsBip Pool fee in hundredths of a bip (3000 = 0.3%).
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeHundredthsBip: bigint = 3000n,
): bigint {
  if (amountIn <= 0n) throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');

  // Default V2 0.3% fee uses 997/1000; otherwise the caller-provided
  // fee is in hundredths of a bip with a 1_000_000 denominator.
  const feeDen = feeHundredthsBip === 3000n ? FEE_DEN : 1_000_000n;
  const feeNum = feeHundredthsBip === 3000n ? FEE_NUM : feeDen - feeHundredthsBip;

  const amountInWithFee = amountIn * feeNum;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * feeDen + amountInWithFee;
  return numerator / denominator;
}
