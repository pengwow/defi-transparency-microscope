/**
 * chain/pools.ts — curated pool list.
 *
 * Returns a fixed 3-pool list (V2 ETH/USDC, V3 ETH/USDC, V3 ETH/USDT)
 * with on-chain reserves/liquidity populated. Token metadata comes from
 * the curated `addresses.ts` registry — we don't bother reading `token0`
 * and `token1` on-chain because the curated list is, well, curated.
 *
 * Pure-ish: takes a `ChainProvider`, returns `Pool[]`. Throws
 * `upstreamUnreachable` if any V3 call fails; the route handler maps
 * that to HTTP 502 (per spec §10).
 */
import { Interface, getAddress } from 'ethers';

import { POOLS, TOKENS } from './addresses.js';
import {
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V3_POOL_ABI,
} from './abis.js';
import { upstreamUnreachable } from '../errors.js';
import type { ChainProvider } from './provider.js';
import type { Pool, Token } from './types.js';

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);
const v3Iface = new Interface(UNISWAP_V3_POOL_ABI);

/**
 * Tokens for the curated pool list, in canonical WETH-first order. We
 * look up by symbol against the curated `TOKENS` registry so the
 * metadata stays in sync.
 */
function token(symbol: keyof typeof TOKENS): Token {
  return TOKENS[symbol];
}

interface V2PoolSpec {
  key: keyof typeof POOLS;
  address: string;
  token0Symbol: keyof typeof TOKENS;
  token1Symbol: keyof typeof TOKENS;
}

interface V3PoolSpec extends V2PoolSpec {
  feeTier: number;
}

const V2_POOL: V2PoolSpec = {
  key: 'V2_WETH_USDC',
  address: POOLS.V2_WETH_USDC,
  token0Symbol: 'USDC',
  token1Symbol: 'WETH',
};

const V3_POOLS: readonly V3PoolSpec[] = [
  {
    key: 'V3_WETH_USDC_3000',
    address: POOLS.V3_WETH_USDC_3000,
    token0Symbol: 'USDC',
    token1Symbol: 'WETH',
    feeTier: 3000,
  },
  {
    key: 'V3_WETH_USDT_3000',
    address: POOLS.V3_WETH_USDT_3000,
    token0Symbol: 'USDT',
    token1Symbol: 'WETH',
    feeTier: 3000,
  },
];

/**
 * Read V2 reserves via eth_call.
 */
async function readV2Reserves(
  provider: ChainProvider,
  address: string,
): Promise<{ reserve0: bigint; reserve1: bigint }> {
  const data = v2Iface.encodeFunctionData('getReserves', []);
  const raw = await provider.call({ to: address, data });
  const decoded = v2Iface.decodeFunctionResult('getReserves', raw);
  // V2 returns uint112, uint112, uint32 — ethers decodes the lot as
  // bigint. The pair's token0/token1 may be in either order, so we
  // report them in address order (caller's responsibility to reconcile
  // with the curated token0/token1 metadata).
  return {
    reserve0: BigInt(decoded[0]),
    reserve1: BigInt(decoded[1]),
  };
}

/**
 * Read V3 slot0 (sqrtPriceX96, tick) and `liquidity()` in parallel.
 */
async function readV3State(
  provider: ChainProvider,
  address: string,
): Promise<{ sqrtPriceX96: bigint; tick: number; liquidity: bigint }> {
  const slot0Data = v3Iface.encodeFunctionData('slot0', []);
  const liqData = v3Iface.encodeFunctionData('liquidity', []);
  const [slot0Raw, liqRaw] = await Promise.all([
    provider.call({ to: address, data: slot0Data }),
    provider.call({ to: address, data: liqData }),
  ]);
  const slot0 = v3Iface.decodeFunctionResult('slot0', slot0Raw);
  const liq = v3Iface.decodeFunctionResult('liquidity', liqRaw);
  return {
    sqrtPriceX96: BigInt(slot0[0]),
    tick: Number(BigInt(slot0[1] as bigint)),
    liquidity: BigInt(liq[0]),
  };
}

/**
 * Build the V2 pool object (no on-chain calls beyond `getReserves`).
 */
async function buildV2Pool(
  provider: ChainProvider,
  spec: V2PoolSpec,
): Promise<Pool> {
  const { reserve0, reserve1 } = await readV2Reserves(provider, spec.address);
  return {
    id: getAddress(spec.address),
    protocol: 'uniswap_v2',
    token0: token(spec.token0Symbol),
    token1: token(spec.token1Symbol),
    reserve0,
    reserve1,
  };
}

/**
 * Build a V3 pool object.
 */
async function buildV3Pool(
  provider: ChainProvider,
  spec: V3PoolSpec,
): Promise<Pool> {
  const { sqrtPriceX96, tick, liquidity } = await readV3State(
    provider,
    spec.address,
  );
  return {
    id: getAddress(spec.address),
    protocol: 'uniswap_v3',
    token0: token(spec.token0Symbol),
    token1: token(spec.token1Symbol),
    sqrtPriceX96,
    tick,
    liquidity,
    feeTier: spec.feeTier,
  };
}

/**
 * Return the curated 3-pool list, populated with current on-chain state.
 *
 * Failures from any V3 call propagate as `upstreamUnreachable` (HTTP 502);
 * the route handler does NOT need to special-case them. V2 errors also
 * propagate; the design choice is that an empty pool list is worse than
 * a 502.
 */
export async function listPools(provider: ChainProvider): Promise<Pool[]> {
  const v2Pool = await buildV2Pool(provider, V2_POOL);
  const v3Pools: Pool[] = [];
  for (const spec of V3_POOLS) {
    try {
      v3Pools.push(await buildV3Pool(provider, spec));
    } catch (err) {
      throw upstreamUnreachable(
        `listPools: failed to read V3 pool ${spec.address}: ${(err as Error).message}`,
      );
    }
  }
  return [v2Pool, ...v3Pools];
}
