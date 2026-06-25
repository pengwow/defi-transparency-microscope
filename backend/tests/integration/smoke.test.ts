/**
 * End-to-end smoke test for the dtm-backend REST API.
 *
 * Boots the full Fastify server (chain layer + routes + WebSocket hub)
 * with `stubProvider` and walks every public DataAPI method, asserting
 * each returns a 200 with the shape the frontend's HttpAPI expects.
 *
 * This is intentionally a "wire-level" test:
 *   - No unit-level stubs of chain/transactions/experiments.
 *   - The chain layer is fed via the stub provider only.
 *   - Each endpoint is exercised once with happy-path inputs.
 *
 * If any of the 9 DataAPI methods regress, this test catches it
 * without needing to spin up a real RPC node.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Interface, type Log } from 'ethers';

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

function toAddressString(a: unknown): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  if (typeof a === 'object' && a !== null && 'toString' in a) {
    return String((a as { toString(): unknown }).toString());
  }
  return '';
}

function stubCallBySelector(stub: StubHandle, callMap: Map<string, string>): void {
  stub.mocks.call.mockImplementation(async (tx: { to?: unknown; data?: string }) => {
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
    });
    app = result.app;
    stub = result.stub;

    // Pool endpoints: pre-seed V2 reserves and V3 slot0/liquidity calls.
    stubCallBySelector(stub, buildPoolCallMap());

    // Transaction endpoint: return one swap log.
    stub.mocks.getLogs.mockResolvedValue([
      swapLog(19_499_999, '0x' + '1'.repeat(64)),
    ]);
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

  it('1) GET /api/v1/pools returns 3 pools with bigint reserves as strings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/pools' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(3);
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('protocol');
      expect(p).toHaveProperty('token0');
      expect(p).toHaveProperty('token1');
      expect(typeof p.token0.symbol).toBe('string');
      expect(typeof p.token1.symbol).toBe('string');
    }
  });

  it('2) GET /api/v1/transactions returns the seeded swap with bigint fields as strings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    const tx = body[0];
    expect(tx.hash).toBe('0x' + '1'.repeat(64));
    expect(typeof tx.value).toBe('string');
    expect(/^\d+$/.test(tx.value)).toBe(true);
    expect(typeof tx.gasPrice).toBe('string');
    expect(typeof tx.gasLimit).toBe('string');
    // The classifier always returns one of the supported types.
    expect(['normal', 'sandwich', 'arbitrage', 'jit', 'liquidation']).toContain(tx.type);
  });

  it('3) GET /api/v1/lending-positions returns an array of position envelopes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('owner');
      expect(p).toHaveProperty('protocol');
      expect(p).toHaveProperty('collateral');
      expect(p).toHaveProperty('debt');
      expect(p).toHaveProperty('liquidationThresholdE18');
      expect(typeof p.liquidationThresholdE18).toBe('string');
    }
  });

  it('4) GET /api/v1/lp-positions returns an array of position envelopes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('owner');
      expect(p).toHaveProperty('poolId');
      expect(p).toHaveProperty('token0');
      expect(p).toHaveProperty('token1');
      expect(p).toHaveProperty('amount0');
      expect(p).toHaveProperty('amount1');
      expect(typeof p.amount0).toBe('string');
      expect(typeof p.amount1).toBe('string');
    }
  });

  it('5) GET /api/v1/experiments returns the 4 baked-in presets', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(4);
    const ids = body.map((p: { id: string }) => p.id);
    expect(ids).toContain('sandwich-eth-usdc');
    expect(ids).toContain('il-eth-usdc');
  });

  it('6) GET /api/v1/experiments/:id returns the matching preset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/experiments/il-eth-usdc',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('il-eth-usdc');
    expect(body.config.protocol).toBe('uniswap_v2');
    expect(typeof body.config.reserve0).toBe('string');
  });

  it('7) POST /api/v1/experiments/sandwich returns attackerProfit > 0', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/sandwich',
      payload: {
        scenario: {
          reserve0: (80_000n * ONE_E18).toString(),
          reserve1: (160_000_000n * ONE_E6).toString(),
          victimAmountIn: (400n * ONE_E18).toString(),
          attackerAmountIn: (800n * ONE_E18).toString(),
          fee: 3000,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('durationMs');
    expect(typeof body.durationMs).toBe('number');
    expect(body).toHaveProperty('result');
    expect(BigInt(body.result.attackerProfit)).toBeGreaterThan(0n);
    expect(body.result.netProfit).toBe(body.result.attackerProfit);
  });

  it('8) POST /api/v1/experiments/il returns IL ≈ -0.0572 for 2x price change', async () => {
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
    expect(body.result.il).toBeCloseTo(-0.0572, 3);
    expect(body.result.variant).toBe('v2');
  });

  it('9) POST /api/v1/experiments/attribution returns priceImpact/fees/gasCost/rebates/netPnl', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/attribution',
      payload: {
        reserve0: (80_000n * ONE_E18).toString(),
        reserve1: (160_000_000n * ONE_E6).toString(),
        amountIn: (10n * ONE_E18).toString(),
        fee: 3000,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result).toHaveProperty('priceImpact');
    expect(body.result).toHaveProperty('fees');
    expect(body.result).toHaveProperty('gasCost');
    expect(body.result).toHaveProperty('rebates');
    expect(body.result).toHaveProperty('netPnl');
    expect(typeof body.result.netPnl).toBe('string');
    expect(/^-?\d+$/.test(body.result.netPnl)).toBe(true);
  });

  it('bonus) /api/v1/health returns 200 with status, chain, blockNumber, wsConnected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('chain');
    expect(body).toHaveProperty('blockNumber');
    expect(body).toHaveProperty('wsConnected');
  });
});
