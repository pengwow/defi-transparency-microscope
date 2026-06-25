/**
 * Tests for the HttpAPI implementation of DataAPI.
 *
 * Mocks global.fetch to capture request details and return canned
 * responses. Verifies:
 *   - The 9 DataAPI methods map to the right backend endpoints.
 *   - HTTP method + body shape (where applicable) is correct.
 *   - Bigint fields are converted from the backend's decimal-string
 *     representation back to native bigint before returning.
 *   - Non-2xx responses surface as typed errors.
 *   - Shape transformations convert backend response shapes into the
 *     frontend's expected shapes (Pool, MockTransaction, etc.).
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { HttpAPI } from '@/services/httpApi';
import type { DataAPI } from '@/services/api';

const TEN_E18 = (10n ** 18n).toString();
const FIVE_E18 = (5n * 10n ** 18n).toString();
const SIX_E6 = (1_000_000n * 10n ** 6n).toString();

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Helper to queue a single canned response. */
function queueResponse(body: unknown, status = 200): void {
  fetchMock.mockImplementationOnce(async () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
}

/** Read the most recent fetch call from the mock. */
function lastCall(): { url: string; init?: RequestInit } | undefined {
  const c = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as
    | [string, RequestInit?]
    | undefined;
  if (!c) return undefined;
  return { url: String(c[0]), init: c[1] };
}

describe('HttpAPI', () => {
  it('satisfies the DataAPI interface (all 9 methods are present)', () => {
    const api: DataAPI = new HttpAPI({ baseUrl: 'http://localhost:8000' });
    expect(typeof api.listPools).toBe('function');
    expect(typeof api.listTransactions).toBe('function');
    expect(typeof api.listLendingPositions).toBe('function');
    expect(typeof api.listLpPositions).toBe('function');
    expect(typeof api.listExperiments).toBe('function');
    expect(typeof api.getExperiment).toBe('function');
    expect(typeof api.runSandwichExperiment).toBe('function');
    expect(typeof api.runIlExperiment).toBe('function');
    expect(typeof api.runAttributionExperiment).toBe('function');
  });

  describe('listPools', () => {
    it('GETs /api/v1/pools and transforms each pool shape', async () => {
      const backendPool = {
        id: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
        protocol: 'uniswap_v2',
        token0: { address: '0xaaa', symbol: 'ETH', decimals: 18 },
        token1: { address: '0xbbb', symbol: 'USDC', decimals: 6 },
        reserve0: TEN_E18,
        reserve1: SIX_E6,
      };
      queueResponse([backendPool]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const pools = await api.listPools();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const c = lastCall();
      expect(c?.url).toBe('http://localhost:8000/api/v1/pools');
      expect(c?.init?.method).toBe('GET');
      expect(pools).toHaveLength(1);
      expect(pools[0].address).toBe(backendPool.id);
      expect(pools[0].reserve0).toBe(BigInt(backendPool.reserve0));
      expect(pools[0].reserve1).toBe(BigInt(backendPool.reserve1));
      expect(pools[0].fee).toBe(0); // V2 has no feeTier in backend shape
      expect(pools[0].type).toBe('constant_product');
      expect(pools[0].blockNumber).toBe(0);
      expect(pools[0].timestamp).toBe(0);
    });

    it('maps V3 feeTier → fee and sets type to "concentrated"', async () => {
      queueResponse([
        {
          id: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
          protocol: 'uniswap_v3',
          token0: { address: '0xusdc', symbol: 'USDC', decimals: 6 },
          token1: { address: '0xweth', symbol: 'WETH', decimals: 18 },
          sqrtPriceX96: TEN_E18,
          tick: 200_000,
          liquidity: FIVE_E18,
          feeTier: 3000,
        },
      ]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const [pool] = await api.listPools();
      expect(pool.type).toBe('concentrated');
      expect(pool.fee).toBe(3000);
      expect(pool.sqrtPriceX96).toBe(BigInt(TEN_E18));
      expect(pool.tick).toBe(200_000);
    });
  });

  describe('listTransactions', () => {
    it('GETs /api/v1/transactions?blocks=10&limit=100 by default', async () => {
      queueResponse([]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      await api.listTransactions();
      expect(lastCall()?.url).toBe(
        'http://localhost:8000/api/v1/transactions?blocks=10&limit=100',
      );
    });

    it('passes through bigint fields and normalises type for MockTransaction', async () => {
      queueResponse([
        {
          hash: '0x' + 'aa'.repeat(32),
          from: '0xfrom',
          to: '0xto',
          value: TEN_E18,
          gasPrice: (30n * 10n ** 9n).toString(),
          gasLimit: '21000',
          input: '0x',
          nonce: 1,
          blockNumber: 100,
          timestamp: 1_700_000_000,
          type: 'sandwich',
        },
      ]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const [tx] = await api.listTransactions();
      expect(tx.hash).toBe('0x' + 'aa'.repeat(32));
      expect(tx.gasUsed).toBe(21000n); // backend's gasLimit becomes frontend's gasUsed
      expect(tx.gasPrice).toBe(30n * 10n ** 9n);
      expect(tx.mevType).toBe('sandwich');
      expect(tx.type).toBe('swap');
    });
  });

  describe('listLendingPositions', () => {
    it('GETs /api/v1/lending-positions and converts bigint collateral/debt maps', async () => {
      queueResponse([
        {
          id: 'aave-v3:0xpos1',
          owner: '0x1111111111111111111111111111111111111111',
          protocol: 'aave_v3',
          collateral: { '0xweth': TEN_E18 },
          debt: { '0xusdc': SIX_E6 },
          liquidationThresholdE18: (8250n * 10n ** 14n).toString(),
          healthFactor: 1.72,
          timestamp: 1_700_000_000,
        },
      ]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const positions = await api.listLendingPositions();
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/lending-positions');
      expect(positions[0].collateral['0xweth']).toBe(BigInt(TEN_E18));
      expect(positions[0].debt['0xusdc']).toBe(BigInt(SIX_E6));
      expect(positions[0].liquidationThresholdE18).toBe(8250n * 10n ** 14n);
    });
  });

  describe('listLpPositions', () => {
    it('GETs /api/v1/lp-positions and maps backend poolId → poolAddress', async () => {
      queueResponse([
        {
          id: '1',
          owner: '0xowner',
          poolId: '0xpooladdr',
          token0: { address: '0xusdc', symbol: 'USDC', decimals: 6 },
          token1: { address: '0xweth', symbol: 'WETH', decimals: 18 },
          amount0: SIX_E6,
          amount1: TEN_E18,
          tickLower: 199_000,
          tickUpper: 201_000,
          feeTier: 3000,
          apr: 0.124,
          valueUsd: 49_000,
          feeIncomeE18: (5_000n * 10n ** 14n).toString(),
          impermanentLossE18: (2_500n * 10n ** 14n).toString(),
          netPnlE18: (2_500n * 10n ** 14n).toString(),
          timestamp: 1_700_000_000,
        },
      ]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const positions = await api.listLpPositions();
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/lp-positions');
      expect(positions[0].poolAddress).toBe('0xpooladdr');
      expect(positions[0].amount0).toBe(BigInt(SIX_E6));
      expect(positions[0].amount1).toBe(BigInt(TEN_E18));
      expect(positions[0].status).toBe('active');
      expect(positions[0].openedAt).toBe(1_700_000_000);
      // Backend V3-only shape: position is V3Position
      expect(positions[0].protocol).toBe('uniswap_v3');
    });
  });

  describe('listExperiments / getExperiment', () => {
    it('GETs /api/v1/experiments and converts config bigints', async () => {
      queueResponse([
        {
          id: 'il-eth-usdc',
          name: 'IL: ETH/USDC',
          description: 'desc',
          config: {
            name: 'IL: ETH/USDC',
            protocol: 'uniswap_v2',
            reserve0: TEN_E18,
            reserve1: SIX_E6,
            fee: 3000,
            runs: 25,
          },
        },
      ]);
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const presets = await api.listExperiments();
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/experiments');
      expect(presets[0].config.reserve0).toBe(BigInt(TEN_E18));
      expect(presets[0].config.reserve1).toBe(BigInt(SIX_E6));
    });

    it('getExperiment GETs /api/v1/experiments/:id', async () => {
      queueResponse({
        id: 'il-eth-usdc',
        name: 'IL',
        description: 'd',
        config: {
          name: 'IL',
          protocol: 'uniswap_v2',
          reserve0: TEN_E18,
          reserve1: SIX_E6,
          fee: 3000,
          runs: 1,
        },
      });
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const preset = await api.getExperiment('il-eth-usdc');
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/experiments/il-eth-usdc');
      expect(preset.id).toBe('il-eth-usdc');
    });
  });

  describe('runSandwichExperiment', () => {
    it('POSTs to /api/v1/experiments/sandwich with bigint-string body', async () => {
      queueResponse({
        durationMs: 12,
        result: {
          attackerSpent: TEN_E18,
          attackerReceived: (11n * 10n ** 18n).toString(),
          attackerProfit: (1n * 10n ** 18n).toString(),
          victimLoss: FIVE_E18,
          step1AmountOut: TEN_E18,
          step2AmountOut: (2n * 10n ** 18n).toString(),
          step3AmountOut: (11n * 10n ** 18n).toString(),
          netProfit: (1n * 10n ** 18n).toString(),
          usedProvider: false,
          feeHundredthsBip: 3000,
        },
      });
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const res = await api.runSandwichExperiment({
        reserve0: 1000n * 10n ** 18n,
        reserve1: 3_000_000n * 10n ** 6n,
        victimAmountIn: 50n * 10n ** 18n,
        attackerAmountIn: 100n * 10n ** 18n,
        fee: 3000,
      });
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/experiments/sandwich');
      expect(lastCall()?.init?.method).toBe('POST');
      const body = JSON.parse(String(lastCall()?.init?.body));
      expect(body.scenario.victimAmountIn).toBe((50n * 10n ** 18n).toString());
      expect(res.results.length).toBeGreaterThan(0);
      // summary includes the headline profit/loss metrics
      expect(res.summary).toBeDefined();
      expect(typeof res.durationMs).toBe('number');
    });
  });

  describe('runIlExperiment', () => {
    it('POSTs to /api/v1/experiments/il and maps the IL result into summary ilV2/ilV3', async () => {
      queueResponse({
        durationMs: 5,
        result: {
          il: -0.057,
          variant: 'v2',
          reserve0: TEN_E18,
          reserve1: SIX_E6,
          priceRatio: 1.5,
        },
      });
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const res = await api.runIlExperiment({
        reserve0: 1000n * 10n ** 18n,
        reserve1: 3_000_000n * 10n ** 6n,
        priceRatio: 1.5,
      });
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/experiments/il');
      const body = JSON.parse(String(lastCall()?.init?.body));
      expect(body.reserve0).toBe((1000n * 10n ** 18n).toString());
      expect(body.priceRatio).toBe(1.5);
      expect(res.summary.ilV2).toBeCloseTo(-0.057, 3);
      expect(res.summary.ilV3).toBeCloseTo(-0.057, 3);
      expect(res.results[0].il).toBeCloseTo(-0.057, 3);
    });
  });

  describe('runAttributionExperiment', () => {
    it('POSTs to /api/v1/experiments/attribution and projects the result into summary', async () => {
      const NEG_E17 = (-(10n ** 17n)).toString();
      const NEG_E16 = (-(10n ** 16n)).toString();
      const GAS_E14 = (5n * 10n ** 14n).toString();
      queueResponse({
        durationMs: 5,
        result: {
          priceImpact: NEG_E17,
          fees: NEG_E16,
          gasCost: GAS_E14,
          rebates: '0',
          netPnl: '-110500000000000000',
          percentages: { priceImpact: 0.9, fees: 0.1, gasCost: 0, rebates: 0 },
          reserve0: TEN_E18,
          reserve1: SIX_E6,
          amountIn: TEN_E18,
          feeHundredthsBip: 3000,
        },
      });
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      const res = await api.runAttributionExperiment({
        reserve0: 1000n * 10n ** 18n,
        reserve1: 3_000_000n * 10n ** 6n,
        amountIn: 50n * 10n ** 18n,
        fee: 3000,
      });
      expect(lastCall()?.url).toBe('http://localhost:8000/api/v1/experiments/attribution');
      const body = JSON.parse(String(lastCall()?.init?.body));
      expect(body.amountIn).toBe((50n * 10n ** 18n).toString());
      expect(typeof res.summary.totalE18).toBe('number');
    });
  });

  describe('error handling', () => {
    it('throws HttpApiError on 4xx with the response status and code', async () => {
      queueResponse(
        { error: 'not_found', message: 'route not found' },
        404,
      );
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      await expect(api.listPools()).rejects.toMatchObject({
        name: 'HttpApiError',
        status: 404,
        code: 'not_found',
      });
    });

    it('throws HttpApiError on 5xx', async () => {
      queueResponse(
        { error: 'upstream_unreachable', message: 'rpc down' },
        502,
      );
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      await expect(api.listPools()).rejects.toMatchObject({
        name: 'HttpApiError',
        status: 502,
        code: 'upstream_unreachable',
      });
    });

    it('throws on a network failure (fetch rejects)', async () => {
      fetchMock.mockImplementationOnce(async () => {
        throw new Error('NetworkError: ECONNREFUSED');
      });
      const api = new HttpAPI({ baseUrl: 'http://localhost:8000' });
      await expect(api.listPools()).rejects.toThrow(/ECONNREFUSED/);
    });
  });

  describe('config', () => {
    it('honors a custom baseUrl (no trailing slash)', async () => {
      queueResponse([]);
      const api = new HttpAPI({ baseUrl: 'http://api.example.com/v1' });
      await api.listPools();
      expect(lastCall()?.url).toBe('http://api.example.com/v1/api/v1/pools');
    });
  });
});
