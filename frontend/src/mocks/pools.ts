/**
 * Mock pool generator.
 *
 * Produces a fixed set of canonical mainnet pools (Uniswap V2 + V3) with
 * plausible reserves, fees, and (for V3) a sqrtPriceX96 / tick snapshot.
 *
 * All generators take an optional `seed` so the dataset is reproducible
 * across reloads and tests.
 */

import type { Pool, PoolToken } from '@/types';
import { createRng, randomBigInt, randomBetween } from './seed';

const ONE_E18 = 10n ** 18n;
const ONE_E6 = 10n ** 6n;
const ONE_E8 = 10n ** 8n;

/** Canonical mainnet token set used by every generated pool. */
export const TOKENS: ReadonlyArray<PoolToken> = [
  { address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', symbol: 'ETH', decimals: 18 },
  { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', symbol: 'USDC', decimals: 6 },
  { address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', symbol: 'WBTC', decimals: 8 },
  { address: '0x6b175474e89094c44da98b954eedeac495271d0f', symbol: 'DAI', decimals: 18 },
];

/** Look up a token by address; throws on unknown addresses. */
export function getTokenByAddress(address: string): PoolToken {
  const found = TOKENS.find((t) => t.address.toLowerCase() === address.toLowerCase());
  if (!found) throw new Error(`UNKNOWN_TOKEN: ${address}`);
  return found;
}

/** A canonical mainnet address for a pool, derived deterministically from its pair. */
function poolAddressFor(protocol: 'uniswap_v2' | 'uniswap_v3', a: string, b: string): string {
  // Just use a deterministic-looking hex address.  We don't need to match
  // mainnet byte-for-byte — the tests only check the prefix.
  const pair = (a + b).slice(2, 10);
  const prefix = protocol === 'uniswap_v2' ? 'b4e1' : 'c3a4';
  return `0x${prefix}${pair}${'0'.repeat(32)}`.slice(0, 42);
}

/** Pick a fee tier for a V3 pool, biased toward the most common 0.3%. */
function pickV3Fee(rng: ReturnType<typeof createRng>): number {
  const r = rng();
  if (r < 0.6) return 3000; // 0.3%
  if (r < 0.85) return 500; // 0.05%
  if (r < 0.95) return 10000; // 1%
  return 100; // 0.01%
}

interface GenerateOptions {
  seed?: number;
}

/** Generate a stable list of demo pools, including V2 and V3 variants. */
export function generatePools(options: GenerateOptions = {}): Pool[] {
  const rng = createRng(options.seed ?? 0xc0ffee);
  const eth = TOKENS[0];
  const usdc = TOKENS[1];
  const wbtc = TOKENS[2];
  const dai = TOKENS[3];
  const block = 18_000_000 + randomBetween(rng, 0, 1000);
  const ts = 1_700_000_000 + randomBetween(rng, 0, 10_000_000);

  const pools: Pool[] = [];

  // 1. ETH/USDC V2 — most traded mainnet pair
  pools.push({
    address: poolAddressFor('uniswap_v2', eth.address, usdc.address),
    protocol: 'uniswap_v2',
    type: 'constant_product',
    token0: eth,
    token1: usdc,
    reserve0: randomBigInt(rng, 50_000n * ONE_E18, 100_000n * ONE_E18),
    reserve1: randomBigInt(rng, 100_000_000n * ONE_E6, 200_000_000n * ONE_E6),
    fee: 3000,
    totalSupply: randomBigInt(rng, 1_000_000n * ONE_E18, 5_000_000n * ONE_E18),
    blockNumber: block,
    timestamp: ts,
  });

  // 2. ETH/USDC V3 — 0.3% pool
  pools.push({
    address: poolAddressFor('uniswap_v3', eth.address, usdc.address),
    protocol: 'uniswap_v3',
    type: 'concentrated',
    token0: eth,
    token1: usdc,
    reserve0: randomBigInt(rng, 10_000n * ONE_E18, 50_000n * ONE_E18),
    reserve1: randomBigInt(rng, 20_000_000n * ONE_E6, 100_000_000n * ONE_E6),
    fee: pickV3Fee(rng),
    sqrtPriceX96: randomBigInt(rng, 10n ** 60n, 10n ** 70n),
    tick: randomBetween(rng, -200_000, 200_000),
    blockNumber: block,
    timestamp: ts,
  });

  // 3. WBTC/ETH V3 — 0.3% pool
  pools.push({
    address: poolAddressFor('uniswap_v3', wbtc.address, eth.address),
    protocol: 'uniswap_v3',
    type: 'concentrated',
    token0: wbtc,
    token1: eth,
    reserve0: randomBigInt(rng, 100n * ONE_E8, 1000n * ONE_E8),
    reserve1: randomBigInt(rng, 1000n * ONE_E18, 20_000n * ONE_E18),
    fee: pickV3Fee(rng),
    sqrtPriceX96: randomBigInt(rng, 10n ** 60n, 10n ** 70n),
    tick: randomBetween(rng, 200_000, 260_000),
    blockNumber: block,
    timestamp: ts,
  });

  // 4. DAI/USDC V2 — stable pool
  pools.push({
    address: poolAddressFor('uniswap_v2', dai.address, usdc.address),
    protocol: 'uniswap_v2',
    type: 'stable',
    token0: dai,
    token1: usdc,
    reserve0: randomBigInt(rng, 20_000_000n * ONE_E18, 80_000_000n * ONE_E18),
    reserve1: randomBigInt(rng, 20_000_000n * ONE_E6, 80_000_000n * ONE_E6),
    fee: 100,
    totalSupply: randomBigInt(rng, 1_000_000n * ONE_E18, 10_000_000n * ONE_E18),
    blockNumber: block,
    timestamp: ts,
  });

  // 5. WBTC/USDC V3 — 0.05% pool
  pools.push({
    address: poolAddressFor('uniswap_v3', wbtc.address, usdc.address),
    protocol: 'uniswap_v3',
    type: 'concentrated',
    token0: wbtc,
    token1: usdc,
    reserve0: randomBigInt(rng, 50n * ONE_E8, 500n * ONE_E8),
    reserve1: randomBigInt(rng, 5_000_000n * ONE_E6, 50_000_000n * ONE_E6),
    fee: pickV3Fee(rng),
    sqrtPriceX96: randomBigInt(rng, 10n ** 60n, 10n ** 70n),
    tick: randomBetween(rng, 200_000, 260_000),
    blockNumber: block,
    timestamp: ts,
  });

  // 6. ETH/DAI V2 — long tail pair
  pools.push({
    address: poolAddressFor('uniswap_v2', eth.address, dai.address),
    protocol: 'uniswap_v2',
    type: 'constant_product',
    token0: eth,
    token1: dai,
    reserve0: randomBigInt(rng, 5_000n * ONE_E18, 30_000n * ONE_E18),
    reserve1: randomBigInt(rng, 5_000_000n * ONE_E18, 30_000_000n * ONE_E18),
    fee: 3000,
    totalSupply: randomBigInt(rng, 100_000n * ONE_E18, 1_000_000n * ONE_E18),
    blockNumber: block,
    timestamp: ts,
  });

  return pools;
}
