/**
 * Integration test for HttpAPI — talks to a real backend.
 *
 * Skipped by default. To run:
 *
 *   1. Start a backend (either the real one with `pnpm --filter dtm-backend dev`,
 *      or the offline stub with `pnpm --filter dtm-backend e2e:server`).
 *   2. `INTEGRATION_BACKEND_URL=http://127.0.0.1:8765 pnpm test:integration`
 *
 * The test verifies the full HTTP round trip: the route layer's JSON
 * shape, the bigint-as-decimal-string convention, and the frontend's
 * rehydration / field-mapping logic.
 *
 * Unlike `httpApi.test.ts` (which stubs `globalThis.fetch`), this file
 * issues real `fetch` calls.  Failures here typically mean the backend
 * contract drifted from the frontend's expectations.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { HttpAPI, HttpNotFoundError } from '../httpApi';

const BACKEND_URL = process.env.INTEGRATION_BACKEND_URL ?? '';
const skipAll = BACKEND_URL === '';

(skipAll ? describe.skip : describe)('services/httpApi (integration)', () => {
  let api: HttpAPI;

  beforeAll(() => {
    if (!BACKEND_URL) return;
    api = new HttpAPI(BACKEND_URL);
  });

  it('GET /api/v1/pools returns 3 mapped Pools with hydrated bigint reserves', async () => {
    const pools = await api.listPools();
    expect(pools).toHaveLength(3);
    const v2 = pools.find((p) => p.protocol === 'uniswap_v2');
    const v3 = pools.find((p) => p.protocol === 'uniswap_v3');
    expect(v2).toBeDefined();
    expect(v3).toBeDefined();
    // V2 should have non-zero reserves (the e2e stub sets 200M USDC + 80k WETH).
    expect(v2!.reserve0).toBeGreaterThan(0n);
    expect(v2!.reserve1).toBeGreaterThan(0n);
    // V3 should have a sqrtPriceX96 (the e2e stub sets a realistic value).
    expect(v3!.sqrtPriceX96).toBeDefined();
    expect(v3!.sqrtPriceX96).toBeGreaterThan(0n);
    expect(v3!.tick).toBeTypeOf('number');
  });

  it('GET /api/v1/transactions returns classified MockTransactions with bigint gas fields', async () => {
    const txs = await api.listTransactions();
    // e2e stub returns exactly 3 logs (1 V2 swap, 1 V3 swap, 1 liquidation).
    expect(txs.length).toBeGreaterThanOrEqual(1);
    for (const t of txs) {
      expect(typeof t.hash).toBe('string');
      expect(typeof t.from).toBe('string');
      expect(typeof t.timestamp).toBe('number');
      expect(typeof t.gasUsed).toBe('bigint');
      expect(typeof t.gasPrice).toBe('bigint');
      expect(['normal', 'sandwich', 'arb', 'jit', 'liquidation']).toContain(t.mevType);
      expect(t.type).toBe('swap');
    }
  });

  it('GET /api/v1/lending-positions returns bigint collateral/debt maps', async () => {
    const lend = await api.listLendingPositions();
    expect(lend.length).toBeGreaterThanOrEqual(1);
    for (const p of lend) {
      expect(p.id).toBeTypeOf('string');
      expect(p.protocol).toBe('aave_v3');
      // collateral/debt maps must be Record<string, bigint>.
      for (const v of Object.values(p.collateral)) {
        expect(typeof v).toBe('bigint');
      }
      for (const v of Object.values(p.debt)) {
        expect(typeof v).toBe('bigint');
      }
      expect(typeof p.liquidationThresholdE18).toBe('bigint');
      expect(['safe', 'warning', 'danger', 'liquidated']).toContain(p.status);
    }
  });

  it('GET /api/v1/lp-positions returns V3Positions with amount0/1 as bigint', async () => {
    const lp = await api.listLpPositions();
    expect(lp.length).toBeGreaterThanOrEqual(1);
    for (const pos of lp) {
      if (pos.protocol !== 'uniswap_v3') {
        throw new Error(`expected all LPs to be V3, got ${pos.protocol}`);
      }
      expect(pos.poolAddress).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(typeof pos.amount0).toBe('bigint');
      expect(typeof pos.amount1).toBe('bigint');
      expect(pos.status).toBe('active');
    }
  });

  it('GET /api/v1/experiments returns presets with hydrated bigint config reserves', async () => {
    const presets = await api.listExperiments();
    expect(presets.length).toBeGreaterThanOrEqual(1);
    for (const p of presets) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.config.reserve0).toBe('bigint');
      expect(typeof p.config.reserve1).toBe('bigint');
      expect(p.config.reserve0).toBeGreaterThan(0n);
    }
  });

  it('GET /api/v1/experiments/:id 404s with HttpNotFoundError → UNKNOWN_EXPERIMENT', async () => {
    await expect(api.getExperiment('this-does-not-exist')).rejects.toThrow(
      /UNKNOWN_EXPERIMENT: this-does-not-exist/,
    );
  });

  it('POST /api/v1/experiments/sandwich maps the run back to ExperimentResult', async () => {
    const res = await api.runSandwichExperiment({
      reserve0: 80_000n * 10n ** 18n,
      reserve1: 160_000_000n * 10n ** 6n,
      victimAmountIn: 50n * 10n ** 18n,
      attackerAmountIn: 100n * 10n ** 18n,
      fee: 3000,
    });
    expect(res.config.name).toBe('sandwich');
    expect(typeof res.durationMs).toBe('number');
    expect(res.results.length).toBeGreaterThan(0);
    const r = res.results[0] as Record<string, number>;
    expect(typeof r.attackerProfit).toBe('number');
    expect(typeof r.victimLoss).toBe('number');
  });

  it('POST /api/v1/experiments/il maps the run back to ExperimentResult', async () => {
    const res = await api.runIlExperiment({
      reserve0: 80_000n * 10n ** 18n,
      reserve1: 160_000_000n * 10n ** 6n,
      priceRatio: 1.5,
    });
    expect(res.config.name).toBe('il');
    expect(typeof res.durationMs).toBe('number');
    const r = res.results[0] as Record<string, number>;
    // IL is bounded below by -1.
    expect(r.ilV2).toBeGreaterThanOrEqual(-1);
    expect(r.ilV2).toBeLessThanOrEqual(0);
  });

  it('POST /api/v1/experiments/attribution maps netPnl to a numeric totalE18', async () => {
    const res = await api.runAttributionExperiment({
      reserve0: 80_000n * 10n ** 18n,
      reserve1: 160_000_000n * 10n ** 6n,
      amountIn: 50n * 10n ** 18n,
      fee: 3000,
    });
    expect(res.config.name).toBe('attribution');
    const r = res.results[0] as Record<string, number>;
    expect(typeof r.totalE18).toBe('number');
    expect(res.summary.totalE18).toBe(r.totalE18);
  });

  it('non-existent route surfaces as HttpNotFoundError (404)', async () => {
    // We do not expose this via DataAPI, so issue a raw fetch through
    // the same `request` semantics by calling a missing endpoint via
    // the only public DataAPI method that has a 404 path.  This test
    // exists to lock in the envelope shape: `error.code = 'not_found'`.
    try {
      await api.getExperiment('');
      throw new Error('should have thrown');
    } catch (err) {
      // The empty string is a path traversal, so the server returns
      // a 404 not_found envelope.  Acceptable shapes:
      //   - "UNKNOWN_EXPERIMENT: ..."  (HttpNotFoundError caught and re-thrown)
      //   - HttpNotFoundError directly (if route didn't match)
      if (err instanceof HttpNotFoundError) {
        expect(err.status).toBe(404);
      } else {
        expect((err as Error).message).toMatch(/UNKNOWN_EXPERIMENT|not_found/);
      }
    }
  });
});
