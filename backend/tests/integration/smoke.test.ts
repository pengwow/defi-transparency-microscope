/**
 * End-to-end smoke test for the dtm-backend REST API.
 *
 * Boots the full Fastify server (chain layer + routes + WebSocket hub)
 * with `stubProvider` and walks every public DataAPI method, asserting
 * each returns the expected HTTP status code and response shape. This
 * is intentionally a "wire-level" test:
 *
 *   - No unit-level stubs of `chain/*` or `experiments/*`.
 *   - The chain layer is fed only via `stubProvider` (call(), getLogs(),
 *     getBlock(), getTransaction(), etc.) — no internal mocks.
 *   - Each endpoint is exercised end-to-end with `app.inject()`.
 *
 * If any of the 9 DataAPI methods regress, or if a route loses its
 * validation envelope, or if a chain-layer integration breaks, this
 * file surfaces it as a single named failure.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Interface, type AddressLike, type Log, type TransactionRequest } from 'ethers';

import { buildTestApp, type BuildTestAppResult } from '../helpers/buildTestApp.js';
import { POOLS } from '../../src/chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI, UNISWAP_V3_POOL_ABI } from '../../src/chain/abis.js';

const ONE_E18 = 10n ** 18n;
const ONE_E6 = 10n ** 6n;
const ZERO_HASH = '0x' + '0'.repeat(64);

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);
const v3Iface = new Interface(UNISWAP_V3_POOL_ABI);

type StubHandle = BuildTestAppResult['stub'];
type AppHandle = BuildTestAppResult['app'];

function toAddressString(a: AddressLike | null | undefined): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && 'toString' in a) {
    return String((a as { toString(): unknown }).toString());
  }
  return '';
}

/**
 * Override the stub's `call` mock so it returns the matching ABI-encoded
 * result for each (address, 4-byte selector) pair.
 */
function stubCallBySelector(stub: StubHandle, callMap: Map<string, string>): void {
  stub.mocks.call.mockImplementation(async (tx: TransactionRequest) => {
    const to = toAddressString(tx.to);
    if (!to || !tx.data) throw new Error('no tx.to/data');
    const selector = tx.data.slice(0, 10).toLowerCase();
    const key = `${to.toLowerCase()}:${selector}`;
    const result = callMap.get(key);
    if (!result) throw new Error(`no stub for ${key}`);
    return result;
  });
}

/**
 * Pre-seed the ABI-encoded V2/V3 pool reads the `listPools` chain
 * function needs.
 */
function buildPoolCallMap(): Map<string, string> {
  const v2 = v2Iface.encodeFunctionResult('getReserves', [
    80_000n * ONE_E18,
    160_000_000n * ONE_E6,
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

/** A single Swap-shaped log. The classifier treats it as a normal swap. */
function swapLog(blockNumber: number, txHash: string): Log {
  return {
    blockNumber,
    blockHash: ZERO_HASH,
    transactionHash: txHash,
    address: POOLS.V3_WETH_USDC_3000,
    data:
      '0x' +
      '0000000000000000000000000000000000000000000000000000000000000000' +
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
    topics: [
      '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67',
      '0x' + '0'.repeat(64),
      '0x' + '0'.repeat(64),
    ],
    logIndex: 0,
    transactionIndex: 0,
    removed: false,
  } as unknown as Log;
}

describe('end-to-end smoke test (all 9 DataAPI endpoints)', () => {
  let app: AppHandle;
  let stub: StubHandle;

  beforeEach(async () => {
    const result = await buildTestApp({
      stub: { blockNumber: 19_500_000 },
      wsHealth: { isWebSocketConnected: () => true },
    });
    app = result.app;
    stub = result.stub;

    // Pools: seed V2 reserves + V3 slot0/liquidity.
    stubCallBySelector(stub, buildPoolCallMap());

    // Transactions: one synthetic V3 Swap log at block 19_499_999.
    stub.mocks.getLogs.mockResolvedValue([swapLog(19_499_999, '0x' + '1'.repeat(64))]);
    stub.mocks.getBlock.mockImplementation(async (tag: unknown) => {
      const n = typeof tag === 'number' ? tag : Number(tag);
      return {
        number: n,
        hash: ZERO_HASH,
        parentHash: ZERO_HASH,
        timestamp: 1_700_000_000 + n,
        transactions: [],
      } as never;
    });
    stub.mocks.getTransaction.mockImplementation(async (hash: string) => {
      return {
        hash,
        blockNumber: 19_499_999,
        from: '0x' + 'a'.repeat(40),
        to: POOLS.V3_WETH_USDC_3000,
        value: 0n,
        gasPrice: 50_000_000_000n,
        gasLimit: 200_000n,
        nonce: 1,
        data: '0x',
      } as never;
    });
  });

  afterEach(async () => {
    await app.close();
  });

  // --- 9 DataAPI endpoints (+ health) ---------------------------------

  it('1) GET /api/v1/health returns 200 with status, chain, blockNumber, wsConnected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      status: 'ok',
      chain: 'mainnet',
      blockNumber: 19_500_000,
      wsConnected: true,
    });
  });

  it('2) GET /api/v1/pools returns 200 with 3 pools (V2 + 2x V3)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
    expect(body.map((p: { protocol: string }) => p.protocol)).toEqual([
      'uniswap_v2',
      'uniswap_v3',
      'uniswap_v3',
    ]);
  });

  it('3) GET /api/v1/transactions?blocks=5 returns 200 with the seeded swap', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions?blocks=5' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    const tx = body[0];
    expect(tx.hash).toBe('0x' + '1'.repeat(64));
    // Bigints are serialised as decimal strings per spec §7.
    expect(typeof tx.value).toBe('string');
    expect(/^\d+$/.test(tx.value)).toBe(true);
    expect(typeof tx.gasPrice).toBe('string');
    expect(typeof tx.gasLimit).toBe('string');
    // The classifier always returns one of the supported types.
    expect(['normal', 'sandwich', 'arbitrage', 'jit', 'liquidation']).toContain(tx.type);
  });

  it('4) GET /api/v1/transactions?blocks=invalid returns 400 with validation envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/transactions?blocks=invalid',
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('5) GET /api/v1/lending-positions returns 200 with array of position envelopes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(4);
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('owner');
      expect(p).toHaveProperty('protocol', 'aave_v3');
      expect(p).toHaveProperty('collateral');
      expect(p).toHaveProperty('debt');
      // Bigint field is serialised as a decimal string.
      expect(typeof p.liquidationThresholdE18).toBe('string');
      expect(/^\d+$/.test(p.liquidationThresholdE18)).toBe(true);
    }
  });

  it('6) GET /api/v1/lp-positions returns 200 with array of position envelopes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3);
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('owner');
      expect(p).toHaveProperty('poolId');
      expect(p).toHaveProperty('token0');
      expect(p).toHaveProperty('token1');
      expect(p).toHaveProperty('tickLower');
      expect(p).toHaveProperty('tickUpper');
      // Bigint fields are serialised as decimal strings.
      expect(typeof p.amount0).toBe('string');
      expect(/^\d+$/.test(p.amount0)).toBe(true);
      expect(typeof p.amount1).toBe('string');
      expect(/^\d+$/.test(p.amount1)).toBe(true);
    }
  });

  it('7) GET /api/v1/experiments returns 200 with 4 baked-in presets', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(4);
    const ids = body.map((p: { id: string }) => p.id);
    expect(ids).toContain('sandwich-eth-usdc');
    expect(ids).toContain('sandwich-wbtc-eth-v3');
    expect(ids).toContain('il-eth-usdc');
    expect(ids).toContain('attribution-eth-usdc');
  });

  it('8) GET /api/v1/experiments/:id returns 200 with the matching preset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/experiments/il-eth-usdc',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('il-eth-usdc');
    expect(body.config.protocol).toBe('uniswap_v2');
    // Reserve0 is a bigint — serialised as a decimal string.
    expect(typeof body.config.reserve0).toBe('string');
    expect(/^\d+$/.test(body.config.reserve0)).toBe(true);
  });

  it('9) GET /api/v1/experiments/unknown returns 404 with not_found envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/experiments/this-preset-does-not-exist',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('not_found');
    expect(body.message).toBe('experiment not found');
  });

  it('10) POST /api/v1/experiments/il with valid input returns 200 with IL result', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/il',
      payload: {
        reserve0: (80_000n * ONE_E18).toString(),
        reserve1: (160_000_000n * ONE_E6).toString(),
        priceRatio: 2,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('durationMs');
    expect(typeof body.durationMs).toBe('number');
    expect(body).toHaveProperty('result');
    // For a 2x price change the V2 IL is ≈ -0.0572 (spec §12 #10).
    expect(body.result.il).toBeCloseTo(-0.0572, 3);
    expect(body.result.variant).toBe('v2');
    // The route echoes the input reserves back as decimal strings.
    expect(typeof body.result.reserve0).toBe('string');
    expect(/^\d+$/.test(body.result.reserve0)).toBe(true);
    expect(typeof body.result.reserve1).toBe('string');
    expect(/^\d+$/.test(body.result.reserve1)).toBe(true);
  });

  it('11) POST /api/v1/experiments/il with invalid input returns 400 with validation envelope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/il',
      payload: {
        // priceRatio is missing → Zod fails
        reserve0: '1000',
        reserve1: '2000',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation');
    expect(Array.isArray(body.issues)).toBe(true);
  });
});
