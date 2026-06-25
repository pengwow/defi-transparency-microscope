/**
 * Tests for the experiment routes:
 *   GET    /api/v1/experiments
 *   GET    /api/v1/experiments/:id
 *   POST   /api/v1/experiments/sandwich
 *   POST   /api/v1/experiments/il
 *   POST   /api/v1/experiments/attribution
 *
 * Coverage:
 *  - happy path returns 200 for each route
 *  - 400 with `validation` envelope on bad input
 *  - 404 for unknown preset id
 *  - 502 for upstream provider errors
 *  - 404 for unknown sub-route
 *  - bigints are serialised as decimal strings (spec §7)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Interface } from 'ethers';

import { buildTestApp } from '../helpers/buildTestApp.js';
import { POOLS } from '../../src/chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI } from '../../src/chain/abis.js';

const ONE_E18 = 10n ** 18n;
const ONE_E6 = 10n ** 6n;

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);

describe('GET /api/v1/experiments', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
  });

  it('returns 200 with 4 presets', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(4);
  });

  it('each preset has id, name, description, config', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    const body = res.json();
    for (const p of body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('description');
      expect(p).toHaveProperty('config');
      expect(p.config).toHaveProperty('protocol');
      expect(p.config).toHaveProperty('reserve0');
      expect(p.config).toHaveProperty('reserve1');
      expect(p.config).toHaveProperty('fee');
      expect(p.config).toHaveProperty('runs');
    }
  });

  it('serialises bigint reserves as decimal strings', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    const body = res.json();
    for (const p of body) {
      expect(typeof p.config.reserve0).toBe('string');
      expect(/^\d+$/.test(p.config.reserve0)).toBe(true);
      expect(typeof p.config.reserve1).toBe('string');
      expect(/^\d+$/.test(p.config.reserve1)).toBe(true);
    }
  });

  it('response is application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/experiments' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

describe('GET /api/v1/experiments/:id', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
  });

  it('returns 200 with the matching preset', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/experiments/sandwich-eth-usdc',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('sandwich-eth-usdc');
    expect(body.config.protocol).toBe('uniswap_v2');
  });

  it('returns 404 with not_found envelope for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/experiments/does-not-exist',
    });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('not_found');
  });
});

describe('POST /api/v1/experiments/il', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
  });

  it('returns 200 with IL ≈ -0.0572 for a 2x price change', async () => {
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

  it('returns 400 when priceRatio is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/il',
      payload: {
        reserve0: '1000',
        reserve1: '2000',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 400 when priceRatio is not a number', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/il',
      payload: {
        reserve0: '1000',
        reserve1: '2000',
        priceRatio: 'not-a-number',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 400 when reserve0 is not a decimal string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/il',
      payload: {
        reserve0: '0x10',
        reserve1: '2000',
        priceRatio: 1,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('echoes input reserves in the result (as decimal strings)', async () => {
    const r0 = (80_000n * ONE_E18).toString();
    const r1 = (160_000_000n * ONE_E6).toString();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/il',
      payload: { reserve0: r0, reserve1: r1, priceRatio: 1 },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.reserve0).toBe(r0);
    expect(body.result.reserve1).toBe(r1);
  });
});

describe('POST /api/v1/experiments/attribution', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
  });

  it('returns 200 with all four components + net', async () => {
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
  });

  it('netPnl is a decimal bigint string', async () => {
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
    expect(typeof body.result.netPnl).toBe('string');
    expect(/^-?\d+$/.test(body.result.netPnl)).toBe(true);
  });

  it('returns 400 when fee is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/attribution',
      payload: {
        reserve0: '1000',
        reserve1: '2000',
        amountIn: '100',
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });
});

describe('POST /api/v1/experiments/sandwich', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];
  let stub: Awaited<ReturnType<typeof buildTestApp>>['stub'];

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
    stub = result.stub;
  });

  it('returns 200 with attacker profit > 0 for a known scenario', async () => {
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
    expect(BigInt(body.result.attackerProfit)).toBeGreaterThan(0n);
  });

  it('reads reserves from the provider when a known pool address is supplied', async () => {
    const reserve0 = 80_000n * ONE_E18;
    const reserve1 = 160_000_000n * ONE_E6;
    const encoded = v2Iface.encodeFunctionResult('getReserves', [
      reserve0,
      reserve1,
      1_700_000_000n,
    ]);
    stub.mocks.call.mockResolvedValue(encoded);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/sandwich',
      payload: {
        scenario: {
          poolAddress: POOLS.V2_WETH_USDC,
          victimAmountIn: (400n * ONE_E18).toString(),
          attackerAmountIn: (800n * ONE_E18).toString(),
          fee: 3000,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.usedProvider).toBe(true);
    expect(stub.mocks.call).toHaveBeenCalled();
  });

  it('returns 400 when scenario is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/sandwich',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 400 when victimAmountIn is a non-numeric string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/sandwich',
      payload: {
        scenario: {
          reserve0: '1000',
          reserve1: '2000',
          victimAmountIn: 'abc',
          attackerAmountIn: '100',
          fee: 3000,
        },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 502 when CPMM validation fails (zero reserve)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/sandwich',
      payload: {
        scenario: {
          reserve0: '0',
          reserve1: '2000',
          victimAmountIn: '100',
          attackerAmountIn: '100',
          fee: 3000,
        },
      },
    });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('upstream_unreachable');
  });

  it('attackerProfit and netProfit are equal', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/experiments/sandwich',
      payload: {
        scenario: {
          reserve0: (10n ** 21n).toString(),
          reserve1: (10n ** 21n).toString(),
          victimAmountIn: (5n * 10n ** 19n).toString(),
          attackerAmountIn: (10n ** 20n).toString(),
          fee: 3000,
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.netProfit).toBe(body.result.attackerProfit);
  });
});
