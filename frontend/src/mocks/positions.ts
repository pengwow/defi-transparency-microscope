/**
 * Mock position generator.
 *
 * Produces 8 lending positions (collateral + debt, Aave/Compound style)
 * and 8 LP positions (mix of V2 and V3 concentrated).
 */

import type { LendingPosition, Position } from '@/types';
import { TOKENS } from './pools';
import { createRng, randomBetween, randomBigInt } from './seed';

const ONE_E18 = 10n ** 18n;
const ONE_E6 = 10n ** 6n;

function addressFor(rng: ReturnType<typeof createRng>): string {
  return '0x' + randomBetween(rng, 0, 0xffffffff).toString(16).padStart(8, '0') + '0'.repeat(32);
}

function poolAddr(rng: ReturnType<typeof createRng>): string {
  return '0x' + randomBetween(rng, 0, 0xffffffff).toString(16).padStart(8, '0') + '0'.repeat(32);
}

function pickToken(rng: ReturnType<typeof createRng>): typeof TOKENS[0] {
  return TOKENS[randomBetween(rng, 0, TOKENS.length - 1)];
}

function makeLending(rng: ReturnType<typeof createRng>, idx: number): LendingPosition {
  const collateralToken = pickToken(rng);
  const debtToken = pickToken(rng);
  // Compute USD-ish values by collapsing everything to an 18-decimal scale.
  const colScale = 10n ** BigInt(collateralToken.decimals);
  const debtScale = 10n ** BigInt(debtToken.decimals);
  // 18-decimal "USD value" of the debt: e.g. 1e21 ~ $1k of USDC (6 dec).
  const debtUsdE18 = randomBigInt(rng, 1_000n * ONE_E18, 1_000_000n * ONE_E18);
  // Collateral should be 2-5x the debt value to keep the position safe-ish.
  const ratio = BigInt(randomBetween(rng, 2, 5));
  const colUsdE18 = debtUsdE18 * ratio + randomBigInt(rng, 0n, ONE_E18);
  // Convert USD value back to token units.
  const colAmount = colUsdE18 * colScale / ONE_E18;
  const debtAmount = debtUsdE18 * debtScale / ONE_E18;
  // Liquidation threshold 80% scaled by 1e18.
  const threshold = randomBigInt(rng, 75n * 10n ** 16n, 85n * 10n ** 16n);
  return {
    id: `lend-${idx}`,
    owner: addressFor(rng),
    protocol: idx % 2 === 0 ? 'aave_v3' : 'compound_v3',
    collateral: { [collateralToken.address]: colAmount },
    debt: { [debtToken.address]: debtAmount },
    liquidationThresholdE18: threshold,
    timestamp: 1_710_000_000 + idx * 86400,
  };
}

function makeLp(rng: ReturnType<typeof createRng>, idx: number): Position {
  const isV3 = idx % 2 === 0;
  const openedAt = 1_710_000_000 + idx * 86400;
  const base = {
    id: `lp-${idx}`,
    owner: addressFor(rng),
    poolAddress: poolAddr(rng),
    openedAt,
    status: 'active' as const,
  };
  if (isV3) {
    const tickLower = randomBetween(rng, -200_000, 200_000);
    const tickUpper = tickLower + randomBetween(rng, 1000, 60_000);
    return {
      ...base,
      protocol: 'uniswap_v3',
      tickLower,
      tickUpper,
      liquidity: randomBigInt(rng, ONE_E18, 10n ** 24n),
      amount0: randomBigInt(rng, ONE_E18, 10n ** 22n),
      amount1: randomBigInt(rng, ONE_E6, 10n ** 22n),
      tokensOwed0: randomBigInt(rng, 0n, 10n ** 18n),
      tokensOwed1: randomBigInt(rng, 0n, 10n ** 6n),
    };
  }
  return {
    ...base,
    protocol: idx % 4 === 1 ? 'sushiswap' : 'uniswap_v2',
    liquidity: randomBigInt(rng, ONE_E18, 10n ** 24n),
    amount0: randomBigInt(rng, ONE_E18, 10n ** 22n),
    amount1: randomBigInt(rng, ONE_E18, 10n ** 22n),
  };
}

interface GenerateOptions {
  seed?: number;
  lendingCount?: number;
  lpCount?: number;
}

export function generatePositions(
  options: GenerateOptions = {},
): { lending: LendingPosition[]; lp: Position[] } {
  const rng = createRng(options.seed ?? 0xfee1);
  const lendingCount = options.lendingCount ?? 8;
  const lpCount = options.lpCount ?? 8;
  return {
    lending: Array.from({ length: lendingCount }, (_, i) => makeLending(rng, i)),
    lp: Array.from({ length: lpCount }, (_, i) => makeLp(rng, i)),
  };
}
