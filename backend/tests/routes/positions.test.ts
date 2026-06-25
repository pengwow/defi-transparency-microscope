/**
 * Tests for `GET /api/v1/lending-positions` and `GET /api/v1/lp-positions`.
 *
 * The chain functions do a minimal `provider.getBlockNumber()` liveness
 * ping in v1 (see `chain/lending.ts` and `chain/lp.ts`). A failing
 * provider therefore surfaces through the route as 502.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { buildTestApp } from '../helpers/buildTestApp.js';

describe('GET /api/v1/lending-positions', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];
  let stub: Awaited<ReturnType<typeof buildTestApp>>['stub'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    stub = result.stub;
  });

  it('returns 200 with at least 4 lending positions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(4);
  });

  it('each position has the expected shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    const body = res.json();
    const p = body[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('owner');
    expect(p).toHaveProperty('protocol', 'aave_v3');
    expect(p).toHaveProperty('collateral');
    expect(p).toHaveProperty('debt');
    expect(p).toHaveProperty('liquidationThresholdE18');
    expect(p).toHaveProperty('healthFactor');
    expect(p).toHaveProperty('timestamp');
  });

  it('serialises collateral / debt bigints as decimal strings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    const body = res.json();
    const p = body[0];
    for (const v of Object.values(p.collateral) as string[]) {
      expect(typeof v).toBe('string');
      expect(/^\d+$/.test(v)).toBe(true);
    }
    for (const v of Object.values(p.debt) as string[]) {
      expect(typeof v).toBe('string');
      expect(/^\d+$/.test(v)).toBe(true);
    }
    expect(typeof p.liquidationThresholdE18).toBe('string');
    expect(/^\d+$/.test(p.liquidationThresholdE18)).toBe(true);
  });

  it('returns 502 with upstream_unreachable when the provider throws', async () => {
    stub.mocks.getBlockNumber.mockRejectedValueOnce(new Error('rpc down'));

    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('upstream_unreachable');
  });

  it('response is application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lending-positions' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /api/v1/lp-positions', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];
  let stub: Awaited<ReturnType<typeof buildTestApp>>['stub'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    stub = result.stub;
  });

  it('returns 200 with at least 3 LP positions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThanOrEqual(3);
  });

  it('each LP position has the expected shape', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    const body = res.json();
    const p = body[0];
    expect(p).toHaveProperty('id');
    expect(p).toHaveProperty('owner');
    expect(p).toHaveProperty('poolId');
    expect(p).toHaveProperty('token0');
    expect(p).toHaveProperty('token1');
    expect(p).toHaveProperty('amount0');
    expect(p).toHaveProperty('amount1');
    expect(p).toHaveProperty('tickLower');
    expect(p).toHaveProperty('tickUpper');
    expect(p).toHaveProperty('feeTier');
    expect(p).toHaveProperty('apr');
    expect(p).toHaveProperty('valueUsd');
    expect(p).toHaveProperty('feeIncomeE18');
    expect(p).toHaveProperty('impermanentLossE18');
    expect(p).toHaveProperty('netPnlE18');
    expect(p).toHaveProperty('timestamp');
  });

  it('serialises bigints (amount0/1, fee/income) as decimal strings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    const body = res.json();
    const p = body[0];
    for (const k of ['amount0', 'amount1', 'feeIncomeE18', 'impermanentLossE18', 'netPnlE18']) {
      expect(typeof p[k]).toBe('string');
      expect(/^-?\d+$/.test(p[k])).toBe(true);
    }
  });

  it('feeTier is one of the canonical Uniswap V3 fees', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    const body = res.json();
    for (const p of body) {
      expect([500, 3000, 10000]).toContain(p.feeTier);
    }
  });

  it('returns 502 with upstream_unreachable when the provider throws', async () => {
    stub.mocks.getBlockNumber.mockRejectedValueOnce(new Error('rpc down'));

    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('upstream_unreachable');
  });

  it('response is application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/lp-positions' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
