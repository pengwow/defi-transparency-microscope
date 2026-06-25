/**
 * Unit tests for HttpAPI.
 *
 * The HttpAPI class wraps the backend REST API and adapts the
 * backend's JSON shapes (decimal-string bigints, lowercase addresses)
 * to the frontend's typed shapes (bigint reserves, status buckets, etc.).
 *
 * The tests stub `globalThis.fetch` so no network access is required.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpAPI, HttpApiError } from '../httpApi';
import type {
  AttributionExperimentInput,
  IlExperimentInput,
} from '../api';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function installFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const spy = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    return Promise.resolve(handler(u, init));
  });
  vi.stubGlobal('fetch', spy as unknown as typeof fetch);
  return spy;
}

/**
 * Build an HttpAPI bound to the test's `fetch` stub.  Callers must
 * invoke `installFetch` *first*; this helper then picks up the
 * stubbed `globalThis.fetch` (the stub is what the HttpAPI will
 * resolve at call time).
 */
function makeApi(baseUrl = 'http://localhost:8080') {
  return new HttpAPI(baseUrl);
}

describe('services/httpApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('listPools', () => {
    it('maps a V3 pool (no reserves) to a concentrated Pool with sqrtPriceX96 and tick', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: '0xabc',
            protocol: 'uniswap_v3',
            token0: { address: '0xA', symbol: 'USDC', decimals: 6 },
            token1: { address: '0xB', symbol: 'WETH', decimals: 18 },
            sqrtPriceX96: '79228162514264337593543950336',
            feeTier: 3000,
            liquidity: '1000000',
            tick: 200000,
          },
        ]),
      );

      const pools = await api.listPools();
      expect(pools).toHaveLength(1);
      const p = pools[0];
      expect(p.address).toBe('0xabc');
      expect(p.type).toBe('concentrated');
      expect(p.fee).toBe(3000);
      expect(p.sqrtPriceX96).toBe(79228162514264337593543950336n);
      expect(p.tick).toBe(200000);
      expect(p.reserve0).toBe(0n);
      expect(p.reserve1).toBe(0n);
      expect(typeof p.timestamp).toBe('number');
    });

    it('maps a V2 pool (no feeTier, no sqrtPriceX96) to a constant_product Pool', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: '0xv2',
            protocol: 'uniswap_v2',
            token0: { address: '0xA', symbol: 'USDC', decimals: 6 },
            token1: { address: '0xB', symbol: 'WETH', decimals: 18 },
            reserve0: '1000000',
            reserve1: '500000000000000000000',
          },
        ]),
      );

      const [p] = await api.listPools();
      expect(p.type).toBe('constant_product');
      expect(p.fee).toBe(3000); // default
      expect(p.reserve0).toBe(1000000n);
      expect(p.reserve1).toBe(500000000000000000000n);
      expect(p.sqrtPriceX96).toBeUndefined();
    });
  });

  describe('listTransactions', () => {
    it('maps backend tx shape to MockTransaction (gasLimit → gasUsed)', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            hash: '0xdeadbeef',
            from: '0xfrom',
            to: '0xto',
            value: '1000',
            gasPrice: '30000000000',
            gasLimit: '21000',
            input: '0x',
            nonce: 7,
            blockNumber: 18500000,
            timestamp: 1710000000,
            type: 'sandwich',
            mevProfit: '100',
            victimLoss: '50',
          },
        ]),
      );

      const [t] = await api.listTransactions();
      expect(t.hash).toBe('0xdeadbeef');
      expect(t.gasUsed).toBe(21000n);
      expect(t.gasPrice).toBe(30000000000n);
      expect(t.blockNumber).toBe(18500000);
      expect(t.timestamp).toBe(1710000000);
      expect(t.mevType).toBe('sandwich');
      expect(t.type).toBe('swap');
    });

    it('maps arbitrage → mevType=arb, type=swap', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            hash: '0x1',
            from: '0xa',
            to: '0xb',
            value: '0',
            gasPrice: '1',
            gasLimit: '1',
            input: '0x',
            nonce: 0,
            timestamp: 1,
            type: 'arbitrage',
          },
        ]),
      );

      const [t] = await api.listTransactions();
      expect(t.mevType).toBe('arb');
      expect(t.type).toBe('swap');
    });
  });

  describe('listLendingPositions', () => {
    it('hydrates bigint collateral/debt/threshold and derives status from healthFactor', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: 'l1',
            owner: '0xowner',
            protocol: 'aave_v3',
            collateral: { '0xC': '1000000' },
            debt: { '0xD': '500000' },
            liquidationThresholdE18: '800000000000000000',
            healthFactor: 2.5,
            timestamp: 1710000000,
          },
        ]),
      );

      const [p] = await api.listLendingPositions();
      expect(p.collateral['0xc']).toBe(1000000n);
      expect(p.debt['0xd']).toBe(500000n);
      expect(p.liquidationThresholdE18).toBe(800000000000000000n);
      expect(p.status).toBe('safe');
      expect(p.healthFactor).toBe(2.5);
    });

    it('classifies danger when healthFactor is in [1, 1.2)', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: 'l2',
            owner: '0xo',
            protocol: 'aave_v3',
            collateral: {},
            debt: {},
            liquidationThresholdE18: '0',
            healthFactor: 1.1,
            timestamp: 1,
          },
        ]),
      );

      const [p] = await api.listLendingPositions();
      expect(p.status).toBe('danger');
    });

    it('classifies liquidated when healthFactor <= 1', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: 'l3',
            owner: '0xo',
            protocol: 'aave_v3',
            collateral: {},
            debt: {},
            liquidationThresholdE18: '0',
            healthFactor: 0.95,
            timestamp: 1,
          },
        ]),
      );

      const [p] = await api.listLendingPositions();
      expect(p.status).toBe('liquidated');
    });
  });

  describe('listLpPositions', () => {
    it('maps backend LPPosition to a V3Position with status=active', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: '42',
            owner: '0xowner',
            poolId: '0xpool',
            token0: { address: '0xA', symbol: 'USDC', decimals: 6 },
            token1: { address: '0xB', symbol: 'WETH', decimals: 18 },
            amount0: '1000000',
            amount1: '500000000000000000000',
            tickLower: -1000,
            tickUpper: 1000,
            feeTier: 3000,
            apr: 0.05,
            valueUsd: 1234.5,
            feeIncomeE18: '1000',
            impermanentLossE18: '500',
            netPnlE18: '500',
            timestamp: 1710000000,
          },
        ]),
      );

      const [p] = await api.listLpPositions();
      if (p.protocol !== 'uniswap_v3') throw new Error('expected v3');
      expect(p.id).toBe('42');
      expect(p.poolAddress).toBe('0xpool');
      expect(p.protocol).toBe('uniswap_v3');
      expect(p.status).toBe('active');
      expect(p.amount0).toBe(1000000n);
      expect(p.amount1).toBe(500000000000000000000n);
      expect(p.tickLower).toBe(-1000);
      expect(p.tickUpper).toBe(1000);
      expect(p.tokensOwed0).toBe(0n);
      expect(p.tokensOwed1).toBe(0n);
    });
  });

  describe('listExperiments / getExperiment', () => {
    it('hydrates bigint config fields', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse([
          {
            id: 'il-eth-usdc',
            name: 'IL: ETH/USDC',
            description: 'desc',
            config: {
              name: 'IL: ETH/USDC',
              protocol: 'uniswap_v2',
              reserve0: '80000000000000000000000',
              reserve1: '160000000000000',
              fee: 3000,
              runs: 25,
            },
          },
        ]),
      );

      const [p] = await api.listExperiments();
      expect(p.config.reserve0).toBe(80000000000000000000000n);
      expect(p.config.reserve1).toBe(160000000000000n);
      expect(p.config.fee).toBe(3000);
    });

    it('throws UNKNOWN_EXPERIMENT on 404 for getExperiment', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse(
          { error: { code: 'not_found', message: 'experiment not found' } },
          404,
        ),
      );

      await expect(api.getExperiment('does-not-exist')).rejects.toThrow(
        /UNKNOWN_EXPERIMENT: does-not-exist/,
      );
    });
  });

  describe('runSandwichExperiment', () => {
    it('POSTs a sandwich scenario and maps the response to ExperimentResult', async () => {
      const api = makeApi();
      const fetchSpy = installFetch(() =>
        jsonResponse({
          durationMs: 5,
          result: {
            attackerSpent: '1000000000000000000',
            attackerReceived: '1010000000000000000',
            attackerProfit: '10000000000000000',
            victimLoss: '5000000000000000',
            step1AmountOut: '900',
            step2AmountOut: '800',
            step3AmountOut: '1100',
            netProfit: '10000000000000000',
            usedProvider: false,
            feeHundredthsBip: 3000,
          },
        }),
      );

      const res = await api.runSandwichExperiment({
        reserve0: 1000n,
        reserve1: 3_000_000n,
        victimAmountIn: 50n,
        attackerAmountIn: 100n,
        fee: 3000,
      });

      // POST to the sandwich endpoint with the right body shape.
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/experiments/sandwich',
        expect.objectContaining({ method: 'POST' }),
      );
      const init = fetchSpy.mock.calls[0][1] as RequestInit;
      const sent = JSON.parse(init.body as string);
      expect(sent).toEqual({
        scenario: {
          reserve0: '1000',
          reserve1: '3000000',
          victimAmountIn: '50',
          attackerAmountIn: '100',
          fee: 3000,
        },
      });
      expect(res.config.name).toBe('sandwich');
      expect(res.durationMs).toBe(5);
      expect(res.results[0].attackerProfit).toBeCloseTo(0.01);
      expect(res.results[0].victimLoss).toBeCloseTo(0.005);
    });
  });

  describe('runIlExperiment', () => {
    it('POSTs the IL body and maps the response', async () => {
      const api = makeApi();
      const fetchSpy = installFetch(() =>
        jsonResponse({
          durationMs: 1,
          result: {
            il: -0.057,
            variant: 'v2',
            reserve0: '1000',
            reserve1: '2000',
            priceRatio: 1.5,
          },
        }),
      );

      const input: IlExperimentInput = {
        reserve0: 1000n,
        reserve1: 2000n,
        priceRatio: 1.5,
      };
      const res = await api.runIlExperiment(input);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/experiments/il',
        expect.objectContaining({ method: 'POST' }),
      );
      const sent = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(sent.reserve0).toBe('1000');
      expect(sent.reserve1).toBe('2000');
      expect(sent.priceRatio).toBe(1.5);

      expect(res.config.name).toBe('il');
      expect(res.results[0].ilV2).toBeCloseTo(-0.057);
    });
  });

  describe('runAttributionExperiment', () => {
    it('POSTs the attribution body and maps netPnl to a numeric totalE18', async () => {
      const api = makeApi();
      const fetchSpy = installFetch(() =>
        jsonResponse({
          durationMs: 2,
          result: {
            priceImpact: '-5000000000000000',
            fees: '-3000000000000000',
            gasCost: '1500000000000000',
            rebates: '0',
            netPnl: '-9500000000000000',
            percentages: { priceImpact: 0.5, fees: 0.3, gasCost: 0.2, rebates: 0 },
            reserve0: '1000',
            reserve1: '3000000',
            amountIn: '50',
            feeHundredthsBip: 3000,
          },
        }),
      );

      const input: AttributionExperimentInput = {
        reserve0: 1000n,
        reserve1: 3_000_000n,
        amountIn: 50n,
        fee: 3000,
      };
      const res = await api.runAttributionExperiment(input);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8080/api/v1/experiments/attribution',
        expect.objectContaining({ method: 'POST' }),
      );
      const sent = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(sent.reserve0).toBe('1000');
      expect(sent.amountIn).toBe('50');

      // -9.5e15 wei / 1e18 = -0.0095
      expect(res.results[0].totalE18).toBeCloseTo(-0.0095);
      expect(res.summary.totalE18).toBeCloseTo(-0.0095);
      expect(res.durationMs).toBe(2);
    });
  });

  describe('error handling', () => {
    it('throws HttpApiError on a 500 response with the error code', async () => {
      const api = makeApi();
      installFetch(() =>
        jsonResponse(
          { error: 'internal', message: 'something broke' },
          500,
        ),
      );

      try {
        await api.listPools();
        throw new Error('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpApiError);
        expect((err as HttpApiError).status).toBe(500);
        expect((err as HttpApiError).code).toBe('internal');
        expect((err as HttpApiError).message).toContain('something broke');
      }
    });
  });
});
