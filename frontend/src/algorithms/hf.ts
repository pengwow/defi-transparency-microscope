/**
 * Health Factor (HF) for lending protocols (Aave-style).
 *
 *   HF = (collateralValueUSD * liquidationThreshold) / debtValueUSD
 *
 * All values are scaled by 1e18.  HF >= 1 ⇒ position is safe.
 */

import type { LendingPosition } from '../types';

const E18 = 10n ** 18n;
const INFINITE_HF = 10n ** 36n;

/** Compute HF given a collateral / debt / threshold triple. */
export function calculateHealthFactor(
  collateralValueE18: bigint,
  debtValueE18: bigint,
  liquidationThresholdE18: bigint,
): bigint {
  if (liquidationThresholdE18 < 0n) {
    throw new Error('INVALID_THRESHOLD');
  }
  if (collateralValueE18 < 0n || debtValueE18 < 0n) {
    throw new Error('NEGATIVE_VALUE');
  }
  if (debtValueE18 === 0n) return INFINITE_HF;
  if (collateralValueE18 === 0n) return 0n;
  return (collateralValueE18 * liquidationThresholdE18) / debtValueE18;
}

/** Convenience: is this position liquidatable right now? */
export function isLiquidatable(
  pos: LendingPosition,
  collateralValueE18: bigint,
  debtValueE18: bigint,
): boolean {
  const hf = calculateHealthFactor(
    collateralValueE18,
    debtValueE18,
    pos.liquidationThresholdE18,
  );
  return hf < E18;
}

/**
 * Price (in 1e18 fixed point) at which the position reaches HF = 1.
 *
 *   P_liq = debt / (collateralAmount * threshold)
 *
 * Multiplied by an extra 1e18 so the result is scaled identically to the
 * inputs (e18-scaled).
 */
export function liquidationPriceE18(
  collateralAmountRaw: bigint,
  debtValueE18: bigint,
  liquidationThresholdE18: bigint,
): bigint {
  if (liquidationThresholdE18 === 0n) throw new Error('ZERO_THRESHOLD');
  if (collateralAmountRaw <= 0n) throw new Error('ZERO_COLLATERAL');
  if (debtValueE18 === 0n) return 0n;
  return (debtValueE18 * E18 * E18) / (liquidationThresholdE18 * collateralAmountRaw);
}

/** Format an HF value (1e18 = 1.0). */
export function formatHF(hf: bigint): string {
  if (hf >= INFINITE_HF) return '∞';
  // 4 decimal places
  const whole = hf / E18;
  const frac = ((hf % E18) * 10000n) / E18;
  return `${whole.toString()}.${frac.toString().padStart(4, '0')}`;
}
