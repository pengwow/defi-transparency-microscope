/**
 * Tests for `GET /api/v1/pools`.
 *
 * The route delegates to `chain/pools.listPools` which uses
 * `provider.call()` to read V2 reserves and V3 slot0 + liquidity. We
 * stub the underlying ethers `call` method (intercepted by
 * `EthersChainProvider`) to return ABI-encoded results per selector.
 *
 * Bigints must round-trip as decimal strings (spec §7) — we assert
 * that explicitly.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Interface, getAddress, type AddressLike, type TransactionRequest } from 'ethers';

import { buildTestApp, type BuildTestAppResult } from '../helpers/buildTestApp.js';
import { POOLS } from '../../src/chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI, UNISWAP_V3_POOL_ABI } from '../../src/chain/abis.js';

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);
const v3Iface = new Interface(UNISWAP_V3_POOL_ABI);

type StubHandle = BuildTestAppResult['stub'];

function toAddressString(a: AddressLike | null | undefined): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && 'toString' in a) {
    return String(a);
  }
  return '';
}

/**
 * Override the stub's `call` mock so it returns the matching ABI-encoded
 * result for each (address, 4-byte selector) pair. Throws on misses so
 * test failures are loud.
 */
function stubCallBySelector(stub: StubHandle, callMap: Map<string, string>): void {
  stub.mocks.call.mockImplementation(async (tx: TransactionRequest) => {
    const to = toAddressString(tx.to);
    if (!to || !tx.data) throw new Error('no tx.to/data');
    const selector = tx.data.slice(0, 10).toLowerCase();
    const key = `${to.toLowerCase()}:${selector}`;
    const result = callMap.get(key);
    if (!result) {
      throw new Error(`no stub for ${key}`);
    }
    return result;
  });
}

function buildHappyCallMap(): Map<string, string> {
  const v2 = v2Iface.encodeFunctionResult('getReserves', [
    1_000_000n * 10n ** 18n,
    2_000_000n * 10n ** 6n,
    1_700_000_000n,
  ]);
  const slot0Usdc = v3Iface.encodeFunctionResult('slot0', [
    1_234_567_890_123_456_789n,
    200_000,
    0,
    1,
    1,
    0,
    true,
  ]);
  const slot0Usdt = v3Iface.encodeFunctionResult('slot0', [
    9_876_543_210_987_654_321n,
    -100_000,
    0,
    1,
    1,
    0,
    true,
  ]);
  const liqUsdc = v3Iface.encodeFunctionResult('liquidity', [5_000_000n]);
  const liqUsdt = v3Iface.encodeFunctionResult('liquidity', [8_000_000n]);

  return new Map<string, string>([
    [`${POOLS.V2_WETH_USDC.toLowerCase()}:0x0902f1ac`, v2],
    [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x3850c7bd`, slot0Usdc],
    [`${POOLS.V3_WETH_USDC_3000.toLowerCase()}:0x1a686502`, liqUsdc],
    [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x3850c7bd`, slot0Usdt],
    [`${POOLS.V3_WETH_USDT_3000.toLowerCase()}:0x1a686502`, liqUsdt],
  ]);
}

describe('GET /api/v1/pools', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];
  let stub: Awaited<ReturnType<typeof buildTestApp>>['stub'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    stub = result.stub;
  });

  it('returns 200 with 3 pools (V2 + V3 ETH/USDC + V3 ETH/USDT)', async () => {
    stubCallBySelector(stub, buildHappyCallMap());

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(3);
    expect(body.map((p: { protocol: string }) => p.protocol)).toEqual([
      'uniswap_v2',
      'uniswap_v3',
      'uniswap_v3',
    ]);
  });

  it('serialises bigints as decimal strings (per spec §7)', async () => {
    stubCallBySelector(stub, buildHappyCallMap());

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    const body = res.json();
    const v2 = body[0];
    expect(typeof v2.reserve0).toBe('string');
    expect(/^\d+$/.test(v2.reserve0)).toBe(true);
    expect(typeof v2.reserve1).toBe('string');
    expect(/^\d+$/.test(v2.reserve1)).toBe(true);
    const v3 = body[1];
    expect(typeof v3.sqrtPriceX96).toBe('string');
    expect(/^\d+$/.test(v3.sqrtPriceX96)).toBe(true);
    expect(typeof v3.liquidity).toBe('string');
    expect(/^\d+$/.test(v3.liquidity)).toBe(true);
  });

  it('preserves exact bigint values end-to-end (no precision loss)', async () => {
    stubCallBySelector(stub, buildHappyCallMap());

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    const body = res.json();
    expect(body[0].reserve0).toBe((1_000_000n * 10n ** 18n).toString());
    expect(body[1].sqrtPriceX96).toBe('1234567890123456789');
    expect(body[1].liquidity).toBe('5000000');
  });

  it('returns the V2 pool with checksumed id and token meta', async () => {
    stubCallBySelector(stub, buildHappyCallMap());

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    const body = res.json();
    const v2 = body.find((p: { protocol: string }) => p.protocol === 'uniswap_v2');
    expect(v2.id).toBe(getAddress(POOLS.V2_WETH_USDC));
    expect([v2.token0.symbol, v2.token1.symbol].sort()).toEqual(['USDC', 'WETH']);
  });

  it('tags V3 pools with feeTier 3000', async () => {
    stubCallBySelector(stub, buildHappyCallMap());

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    const body = res.json();
    const v3 = body.filter((p: { protocol: string }) => p.protocol === 'uniswap_v3');
    expect(v3).toHaveLength(2);
    for (const p of v3) expect(p.feeTier).toBe(3000);
  });

  it('returns 502 with upstream_unreachable when a V3 call throws', async () => {
    // V2 succeeds, V3 throws — listPools wraps this in upstreamUnreachable.
    const v2 = v2Iface.encodeFunctionResult('getReserves', [1n, 1n, 0n]);
    const callMap = new Map<string, string>([
      [`${POOLS.V2_WETH_USDC.toLowerCase()}:0x0902f1ac`, v2],
    ]);
    stubCallBySelector(stub, callMap);
    // Anything not in the map throws via the stub's logic.
    stub.mocks.call.mockImplementation(async (tx: { to?: string; data?: string }) => {
      if (!tx.to || !tx.data) throw new Error('no tx.to/data');
      if (tx.to.toLowerCase() === POOLS.V2_WETH_USDC.toLowerCase()) {
        return v2;
      }
      throw new Error('rpc down');
    });

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    expect(res.statusCode).toBe(502);
    const body = res.json();
    expect(body.error).toBe('upstream_unreachable');
  });

  it('returns 500 with error envelope for unhandled internal errors', async () => {
    // Force the central error handler by throwing a non-HttpError.
    stub.mocks.call.mockImplementation(async () => {
      throw new Error('synthetic internal failure');
    });

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    expect(res.statusCode).toBe(500);
    const body = res.json();
    expect(body.error).toBe('internal');
  });

  it('response is application/json', async () => {
    stubCallBySelector(stub, buildHappyCallMap());

    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
