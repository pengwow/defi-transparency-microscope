/**
 * chain/lending.ts — listLendingPositions returns a curated set of
 * Aave V3 borrower positions.
 *
 * v1 design (per spec §7.4): use 4 hard-coded sample positions with
 * realistic data; function signature still accepts a `ChainProvider`
 * so the v2 implementation can call `getUserReserveData` without
 * changing callers. The data is static for now — a future v2 will
 * refresh it by reading recent `Borrow` events from the Aave Pool.
 *
 * Numbers are realistic but synthetic (rounded for readability):
 *   - collateral in WETH (~ETH-denominated)
 *   - debt in USDC (6-decimals)
 *   - health factor distributed across the spectrum, including one
 *     position in the "risky" 1.0-1.5 band so the UI can showcase a
 *     liquidation-warning state.
 */
import { TOKENS } from './addresses.js';
import type { ChainProvider } from './provider.js';
import type { LendingPosition } from './types.js';

/**
 * Curated Aave V3 borrower positions (synthetic). The addresses are
 * stable so the UI can render them across reloads; they are NOT real
 * mainnet addresses and not used to identify any actual user.
 */
const SAMPLE_POSITIONS: ReadonlyArray<Omit<LendingPosition, 'timestamp'>> = [
  {
    id: 'aave-v3:0xpos1',
    owner: '0x1111111111111111111111111111111111111111',
    protocol: 'aave_v3',
    // 250 WETH @ 18 decimals ≈ $750k @ $3k/ETH
    collateral: { [TOKENS.WETH.address.toLowerCase()]: 250n * 10n ** 18n },
    // 1.2M USDC @ 6 decimals — well-collateralised
    debt: { [TOKENS.USDC.address.toLowerCase()]: 1_200_000n * 10n ** 6n },
    liquidationThresholdE18: 8250n * 10n ** 14n, // 82.5 %
    healthFactor: 1.72,
  },
  {
    id: 'aave-v3:0xpos2',
    owner: '0x2222222222222222222222222222222222222222',
    protocol: 'aave_v3',
    // 50 WETH ≈ $150k
    collateral: { [TOKENS.WETH.address.toLowerCase()]: 50n * 10n ** 18n },
    // 120k USDC — borderline, in the "risky" band
    debt: { [TOKENS.USDC.address.toLowerCase()]: 120_000n * 10n ** 6n },
    liquidationThresholdE18: 8250n * 10n ** 14n,
    healthFactor: 1.31,
  },
  {
    id: 'aave-v3:0xpos3',
    owner: '0x3333333333333333333333333333333333333333',
    protocol: 'aave_v3',
    // 1.0k WETH ≈ $3M
    collateral: { [TOKENS.WETH.address.toLowerCase()]: 1_000n * 10n ** 18n },
    // 4.5M USDC — moderately leveraged
    debt: { [TOKENS.USDC.address.toLowerCase()]: 4_500_000n * 10n ** 6n },
    liquidationThresholdE18: 8250n * 10n ** 14n,
    healthFactor: 2.41,
  },
  {
    id: 'aave-v3:0xpos4',
    owner: '0x4444444444444444444444444444444444444444',
    protocol: 'aave_v3',
    // 12 WETH ≈ $36k
    collateral: { [TOKENS.WETH.address.toLowerCase()]: 12n * 10n ** 18n },
    // 50k USDC — comfortable
    debt: { [TOKENS.USDC.address.toLowerCase()]: 50_000n * 10n ** 6n },
    liquidationThresholdE18: 8250n * 10n ** 14n,
    healthFactor: 4.18,
  },
  {
    id: 'aave-v3:0xpos5',
    owner: '0x5555555555555555555555555555555555555555',
    protocol: 'aave_v3',
    // 80 WETH + 5 WBTC ≈ $360k blended
    collateral: {
      [TOKENS.WETH.address.toLowerCase()]: 80n * 10n ** 18n,
      [TOKENS.WBTC.address.toLowerCase()]: 5n * 10n ** 8n,
    },
    // 220k USDC — moderate
    debt: { [TOKENS.USDC.address.toLowerCase()]: 220_000n * 10n ** 6n },
    liquidationThresholdE18: 8000n * 10n ** 14n,
    healthFactor: 1.94,
  },
  {
    id: 'aave-v3:0xpos6',
    owner: '0x6666666666666666666666666666666666666666',
    protocol: 'aave_v3',
    // 5 WETH ≈ $15k
    collateral: { [TOKENS.WETH.address.toLowerCase()]: 5n * 10n ** 18n },
    // 20k USDC — thin
    debt: { [TOKENS.USDC.address.toLowerCase()]: 20_000n * 10n ** 6n },
    liquidationThresholdE18: 8250n * 10n ** 14n,
    healthFactor: 1.12,
  },
];

/**
 * Return the curated list of Aave V3 lending positions, stamped with the
 * current epoch second as `timestamp`. The provider is used for a
 * minimal liveness ping in v1; v2 will switch to live reads via
 * `getUserReserveData`.
 */
export async function listLendingPositions(
  provider: ChainProvider,
): Promise<LendingPosition[]> {
  // v1 liveness ping so the route can surface provider failures as 502.
  // v2 will replace this with real getUserReserveData reads.
  await provider.getBlockNumber();
  const timestamp = Math.floor(Date.now() / 1000);
  return SAMPLE_POSITIONS.map((p) => ({ ...p, timestamp }));
}
