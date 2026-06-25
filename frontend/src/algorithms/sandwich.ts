/**
 * Sandwich attack simulation.
 *
 * Same-direction 3-swap model:
 *   1. Attacker frontrun:  sell token0 for token1
 *   2. Victim trade:       sell token0 for token1 (gets a worse rate)
 *   3. Attacker backrun:   sell the received token1 back for token0
 *
 * The attacker's net profit in token0 is:
 *   profit = step3.amountOut - attackerAmountIn  (the "baseline")
 */

import { getAmountOut } from './cpmm';

const DEFAULT_FEE_BPS = 3n; // 0.3% in basis points (used for V3 tier mapping)

export interface SandwichResult {
  /** token0 spent in the frontrun (baseline cost). */
  attackerSpent: bigint;
  /** token0 received in the backrun. */
  attackerReceived: bigint;
  /** Net profit in token0 (can be negative). */
  attackerProfit: bigint;
  /** Victim's output shortfall vs. a no-sandwich baseline. */
  victimLoss: bigint;
  /** Step 1 — frontrun: token1 received by the attacker. */
  step1AmountOut: bigint;
  /** Step 2 — victim trade: token1 received by the victim. */
  step2AmountOut: bigint;
  /** Step 3 — backrun: token0 received by the attacker. */
  step3AmountOut: bigint;
}

/**
 * Swap amount with a configurable fee in hundredths of a bip.
 * 3000 (default) = 0.30% Uniswap V2 / V3(3000) fee.
 */
function getAmountOutWithFeeBps(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeHundredthsBip: bigint,
): bigint {
  if (amountIn <= 0n) throw new Error('INSUFFICIENT_INPUT_AMOUNT');
  if (reserveIn <= 0n || reserveOut <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');

  // 1 bip = 0.01%, 1 hundredth of a bip = 0.0001% = 1e-6
  // For 0.3% fee: feeHundredthsBip = 3000
  // amountInWithFee = amountIn * (1_000_000 - 3000) / 1_000_000
  const feeDen = 1_000_000n;
  const feeNum = feeDen - feeHundredthsBip;
  const amountInWithFee = amountIn * feeNum;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * feeDen + amountInWithFee;
  return numerator / denominator;
}

/**
 * Run a same-direction 3-swap sandwich simulation.
 *
 * @param reserve0     Pool's token0 reserve
 * @param reserve1     Pool's token1 reserve
 * @param victimAmountIn  Victim's trade size (in token0)
 * @param attackerAmountIn  Attacker's frontrun size (in token0)
 * @param feeHundredthsBip  Pool fee in hundredths of a bip (3000 = 0.3%)
 */
export function simulateSandwich(
  reserve0: bigint,
  reserve1: bigint,
  victimAmountIn: bigint,
  attackerAmountIn: bigint,
  feeHundredthsBip: bigint = 3000n,
): SandwichResult {
  if (reserve0 <= 0n || reserve1 <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');
  if (victimAmountIn <= 0n) throw new Error('INSUFFICIENT_VICTIM_AMOUNT');
  if (attackerAmountIn < 0n) throw new Error('INSUFFICIENT_ATTACKER_AMOUNT');

  // No attacker input ⇒ nothing to do, all step outputs are zero.
  if (attackerAmountIn === 0n) {
    return {
      attackerSpent: 0n,
      attackerReceived: 0n,
      attackerProfit: 0n,
      victimLoss: 0n,
      step1AmountOut: 0n,
      step2AmountOut: 0n,
      step3AmountOut: 0n,
    };
  }

  // Step 1 — attacker frontrun: token0 -> token1
  const step1AmountOut = getAmountOutWithFeeBps(
    attackerAmountIn,
    reserve0,
    reserve1,
    feeHundredthsBip,
  );

  // Step 2 — victim trade: token0 -> token1 (now with worse reserves)
  const r0AfterStep1 = reserve0 + attackerAmountIn;
  const r1AfterStep1 = reserve1 - step1AmountOut;
  const step2AmountOut = getAmountOutWithFeeBps(
    victimAmountIn,
    r0AfterStep1,
    r1AfterStep1,
    feeHundredthsBip,
  );

  // Step 3 — attacker backrun: token1 -> token0
  const r0AfterStep2 = r0AfterStep1 + victimAmountIn;
  const r1AfterStep2 = r1AfterStep1 - step2AmountOut;
  const step3AmountOut = getAmountOutWithFeeBps(
    step1AmountOut,
    r1AfterStep2,
    r0AfterStep2,
    feeHundredthsBip,
  );

  // Baseline (no-sandwich) victim output
  const baselineOut = getAmountOut(victimAmountIn, reserve0, reserve1);

  const attackerReceived = step3AmountOut;
  const attackerProfit = attackerReceived - attackerAmountIn;
  const victimLoss = baselineOut - step2AmountOut;

  return {
    attackerSpent: attackerAmountIn,
    attackerReceived,
    attackerProfit,
    victimLoss,
    step1AmountOut,
    step2AmountOut,
    step3AmountOut,
  };
}

/** Convenience: did the attacker come out ahead? */
export function isSandwichProfitable(r: SandwichResult): boolean {
  return r.attackerProfit > 0n;
}

// Re-export for downstream consumers
export { DEFAULT_FEE_BPS };
