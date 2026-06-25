/**
 * chain/lp.ts — listLpPositions returns a curated set of Uniswap V3
 * NFT LP positions.
 *
 * v1 design (per spec §7.5): use 4+ hard-coded sample positions with
 * realistic data; function signature still accepts a `ChainProvider`
 * for v2 forward compat (live reads via
 * `NonfungiblePositionManager.positions(tokenId)`).
 *
 * Token-pair coverage:
 *   - WETH/USDC (V3 0.3% pool, feeTier 3000)
 *   - WETH/USDT (V3 0.3% pool, feeTier 3000)
 *   - one position on a hypothetical 0.05% pool (feeTier 500) to exercise
 *     the lower-fee path
 *
 * `tickLower` / `tickUpper` are spaced 200 ticks apart (the V3 tick
 * spacing for the 0.3% pool is 60; for 0.05% it's 10). We use realistic
 * ETH/USDC tick ranges around the current mainnet price (~200,000).
 */
import { POOLS, TOKENS } from './addresses.js';
import type { ChainProvider } from './provider.js';
import type { LPPosition } from './types.js';

/**
 * Curated V3 NFT LP positions. The tokenIds and owners are stable so
 * the UI can render them across reloads; they are NOT real mainnet
 * tokenIds/owners and not used to identify any actual position.
 */
const SAMPLE_POSITIONS: ReadonlyArray<Omit<LPPosition, 'timestamp'>> = [
  // 1. WETH/USDC 0.3% — wide range, around the current price
  {
    id: '1',
    owner: '0xaaaa1111111111111111111111111111111111aa',
    poolId: POOLS.V3_WETH_USDC_3000,
    token0: TOKENS.USDC,
    token1: TOKENS.WETH,
    amount0: 25_000n * 10n ** 6n, // 25k USDC
    amount1: 8n * 10n ** 18n, // 8 WETH
    tickLower: 199_000,
    tickUpper: 201_000,
    feeTier: 3000,
    apr: 0.124,
    valueUsd: 49_000,
    feeIncomeE18: 5_000n * 10n ** 14n, // 0.05%
    impermanentLossE18: 2_500n * 10n ** 14n, // 0.025%
    netPnlE18: 2_500n * 10n ** 14n,
  },
  // 2. WETH/USDC 0.3% — narrow range, just above the current price
  {
    id: '2',
    owner: '0xbbbb2222222222222222222222222222222222bb',
    poolId: POOLS.V3_WETH_USDC_3000,
    token0: TOKENS.USDC,
    token1: TOKENS.WETH,
    amount0: 50_000n * 10n ** 6n,
    amount1: 16n * 10n ** 18n,
    tickLower: 200_400,
    tickUpper: 200_900,
    feeTier: 3000,
    apr: 0.318,
    valueUsd: 98_000,
    feeIncomeE18: 2_000n * 10n ** 15n, // 0.2%
    impermanentLossE18: 1_400n * 10n ** 15n,
    netPnlE18: 6_000n * 10n ** 14n,
  },
  // 3. WETH/USDT 0.3% — wide range
  {
    id: '3',
    owner: '0xcccc3333333333333333333333333333333333cc',
    poolId: POOLS.V3_WETH_USDT_3000,
    token0: TOKENS.USDT,
    token1: TOKENS.WETH,
    amount0: 40_000n * 10n ** 6n,
    amount1: 12n * 10n ** 18n,
    tickLower: 198_000,
    tickUpper: 202_000,
    feeTier: 3000,
    apr: 0.082,
    valueUsd: 76_000,
    feeIncomeE18: 3_500n * 10n ** 14n,
    impermanentLossE18: 1_000n * 10n ** 14n,
    netPnlE18: 2_500n * 10n ** 14n,
  },
  // 4. WETH/USDT 0.3% — tight range
  {
    id: '4',
    owner: '0xdddd4444444444444444444444444444444444dd',
    poolId: POOLS.V3_WETH_USDT_3000,
    token0: TOKENS.USDT,
    token1: TOKENS.WETH,
    amount0: 80_000n * 10n ** 6n,
    amount1: 25n * 10n ** 18n,
    tickLower: 199_800,
    tickUpper: 200_400,
    feeTier: 3000,
    apr: 0.211,
    valueUsd: 155_000,
    feeIncomeE18: 1_800n * 10n ** 15n,
    impermanentLossE18: 1_100n * 10n ** 15n,
    netPnlE18: 7_000n * 10n ** 14n,
  },
  // 5. WETH/USDC 0.05% (feeTier 500) — synthetic tick spacing
  {
    id: '5',
    owner: '0xeeee5555555555555555555555555555555555ee',
    poolId: POOLS.V3_WETH_USDC_3000,
    token0: TOKENS.USDC,
    token1: TOKENS.WETH,
    amount0: 100_000n * 10n ** 6n,
    amount1: 32n * 10n ** 18n,
    tickLower: 199_800,
    tickUpper: 200_200,
    feeTier: 500,
    apr: 0.156,
    valueUsd: 196_000,
    feeIncomeE18: 9_000n * 10n ** 14n,
    impermanentLossE18: 4_000n * 10n ** 14n,
    netPnlE18: 5_000n * 10n ** 14n,
  },
];

/**
 * Return the curated list of V3 LP positions, stamped with the current
 * epoch second as `timestamp`. The provider is used for a minimal
 * liveness ping in v1; v2 will switch to live reads via
 * `NonfungiblePositionManager.positions(tokenId)`.
 */
export async function listLpPositions(provider: ChainProvider): Promise<LPPosition[]> {
  // v1 liveness ping so the route can surface provider failures as 502.
  // v2 will replace this with real NonfungiblePositionManager reads.
  await provider.getBlockNumber();
  const timestamp = Math.floor(Date.now() / 1000);
  return SAMPLE_POSITIONS.map((p) => ({ ...p, timestamp }));
}
