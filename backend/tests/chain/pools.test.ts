/**
 * Tests for chain/pools.ts — the curated 3-pool summary returned by
 * `GET /api/v1/pools`.
 *
 * The listPools function calls `provider.call()` with the V2 getReserves
 * ABI and the V3 slot0 + liquidity ABIs. We stub `call()` to return
 * ABI-encoded results for each contract call.
 */
import { describe, it, expect, vi } from 'vitest';
import { Interface, getAddress } from 'ethers';
import { listPools } from '../../src/chain/pools.js';
import { POOLS, TOKENS } from '../../src/chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI, UNISWAP_V3_POOL_ABI } from '../../src/chain/abis.js';
import { upstreamUnreachable } from '../../src/errors.js';

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);
const v3Iface = new Interface(UNISWAP_V3_POOL_ABI);

/**
 * Build a stub ChainProvider where `call()` returns ABI-encoded results
 * based on the contract address and function selector. The map
 * `callMap` keys are `address:lowercase-selector-4bytes` and values
 * are the encoded result hex strings.
 */
function makeProviderWithCallMap(
  callMap: Map<string, string>,
): {
  call: ReturnType<typeof vi.fn>;
  getBlockNumber: ReturnType<typeof vi.fn>;
} {
  return {
    call: vi.fn(async (tx: { to?: string; data?: string }) => {
      if (!tx.to || !tx.data) throw new Error('no tx.to/data');
      const selector = tx.data.slice(0, 10).toLowerCase();
      const key = `${tx.to.toLowerCase()}:${selector}`;
      const result = callMap.get(key);
      if (!result) {
        throw new Error(`no stub for ${key}`);
      }
      return result;
    }),
    getBlockNumber: vi.fn(async () => 0x1234),
  };
}

describe('listPools', () => {
  it('returns 3 pools: V2 ETH/USDC + V3 ETH/USDC + V3 ETH/USDT', async () => {
    const v2Result = v2Iface.encodeFunctionResult('getReserves', [
      1000000n * 10n ** 18n, // reserve0
      2000000n * 10n ** 6n, // reserve1
      1700000000n, // blockTimestampLast
    ]);
    const slot0V3Usdc = v3Iface.encodeFunctionResult('slot0', [
      1234567890123456789n, // sqrtPriceX96
      200000n, // tick
      0, // observationIndex
      1, // observationCardinality
      1, // observationCardinalityNext
      0, // feeProtocol
      true, // unlocked
    ]);
    const liquidityV3Usdc = v3Iface.encodeFunctionResult('liquidity', [5000000n]);
    const slot0V3Usdt = v3Iface.encodeFunctionResult('slot0', [
      9876543210987654321n,
      -100000n,
      0,
      1,
      1,
      0,
      true,
    ]);
    const liquidityV3Usdt = v3Iface.encodeFunctionResult('liquidity', [8000000n]);

    const callMap = new Map<string, string>([
      [`${POOLS.V2_WETH_USDC.toLowerCase()}:0x0902f1ac`, v2Result],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x3850c7bd`, slot0V3Usdc],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x1a686502`, liquidityV3Usdc],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x3850c7bd`, slot0V3Usdt],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x1a686502`, liquidityV3Usdt],
    ]);
    const provider = makeProviderWithCallMap(callMap);

    const pools = await listPools(provider as never);

    expect(pools).toHaveLength(3);
    expect(pools.map((p) => p.protocol)).toEqual([
      'uniswap_v2',
      'uniswap_v3',
      'uniswap_v3',
    ]);
    // BigInt preserved end-to-end
    expect(typeof pools[0].reserve0).toBe('bigint');
    expect(pools[0].reserve0).toBeGreaterThan(0n);
    expect(pools[0].reserve1).toBeGreaterThan(0n);
    expect(typeof pools[1].sqrtPriceX96).toBe('bigint');
    expect(pools[1].sqrtPriceX96).toBeGreaterThan(0n);
    expect(typeof pools[1].liquidity).toBe('bigint');
    expect(pools[1].liquidity).toBeGreaterThan(0n);
  });

  it('V2 pool is checksummed and has the WETH/USDC token meta', async () => {
    const v2Result = v2Iface.encodeFunctionResult('getReserves', [1n, 2n, 0n]);
    const slot0 = v3Iface.encodeFunctionResult('slot0', [1n, 0, 0, 1, 1, 0, true]);
    const liq = v3Iface.encodeFunctionResult('liquidity', [1n]);
    const callMap = new Map<string, string>([
      [`${POOLS.V2_WETH_USDC.toLowerCase()}:0x0902f1ac`, v2Result],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x3850c7bd`, slot0],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x1a686502`, liq],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x3850c7bd`, slot0],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x1a686502`, liq],
    ]);
    const provider = makeProviderWithCallMap(callMap);
    const pools = await listPools(provider as never);
    const v2 = pools.find((p) => p.protocol === 'uniswap_v2')!;
    expect(v2.id).toBe(getAddress(POOLS.V2_WETH_USDC));
    expect(v2.token0.symbol).toMatch(/WETH|USDC/);
    expect(v2.token1.symbol).toMatch(/WETH|USDC/);
    expect(v2.token0.symbol).not.toBe(v2.token1.symbol);
  });

  it('V3 pool has feeTier = 3000 for the curated 0.3% pools', async () => {
    const v2Result = v2Iface.encodeFunctionResult('getReserves', [1n, 1n, 0n]);
    const slot0 = v3Iface.encodeFunctionResult('slot0', [1n, 0, 0, 1, 1, 0, true]);
    const liq = v3Iface.encodeFunctionResult('liquidity', [1n]);
    const callMap = new Map<string, string>([
      [`${POOLS.V2_WETH_USDC.toLowerCase()}:0x0902f1ac`, v2Result],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x3850c7bd`, slot0],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x1a686502`, liq],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x3850c7bd`, slot0],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x1a686502`, liq],
    ]);
    const provider = makeProviderWithCallMap(callMap);
    const pools = await listPools(provider as never);
    const v3 = pools.filter((p) => p.protocol === 'uniswap_v3');
    expect(v3).toHaveLength(2);
    for (const p of v3) expect(p.feeTier).toBe(3000);
  });

  it('throws UpstreamUnreachableError when V3 call fails', async () => {
    // V2 succeeds; V3 throws.
    const v2Result = v2Iface.encodeFunctionResult('getReserves', [1n, 1n, 0n]);
    const provider = {
      call: vi.fn(async (tx: { to?: string; data?: string }) => {
        if (!tx.to || !tx.data) throw new Error('no tx.to/data');
        if (tx.to.toLowerCase() === POOLS.V2_WETH_USDC.toLowerCase()) return v2Result;
        throw new Error('rpc down');
      }),
      getBlockNumber: vi.fn(async () => 0),
    };
    await expect(listPools(provider as never)).rejects.toBeInstanceOf(
      upstreamUnreachable('rpc down').constructor,
    );
    // We don't assert the exact error — only that an HttpError surfaces.
    let caught: unknown;
    try {
      await listPools(provider as never);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect((caught as { statusCode: number }).statusCode).toBe(502);
  });

  it('uses the curated token metadata, not on-chain reads', async () => {
    const v2Result = v2Iface.encodeFunctionResult('getReserves', [1n, 1n, 0n]);
    const slot0 = v3Iface.encodeFunctionResult('slot0', [1n, 0, 0, 1, 1, 0, true]);
    const liq = v3Iface.encodeFunctionResult('liquidity', [1n]);
    const callMap = new Map<string, string>([
      [`${POOLS.V2_WETH_USDC.toLowerCase()}:0x0902f1ac`, v2Result],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x3850c7bd`, slot0],
      [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x1a686502`, liq],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x3850c7bd`, slot0],
      [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x1a686502`, liq],
    ]);
    const provider = makeProviderWithCallMap(callMap);
    const pools = await listPools(provider as never);
    const token0Symbols = new Set(pools.flatMap((p) => [p.token0.symbol, p.token1.symbol]));
    // WETH + USDC + USDT must be present somewhere in the curated list.
    expect(token0Symbols.has('WETH')).toBe(true);
    expect(token0Symbols.has('USDC')).toBe(true);
    expect(token0Symbols.has('USDT')).toBe(true);
    // Sanity: TOKENS export agrees.
    expect(TOKENS.WETH.decimals).toBe(18);
  });
});
