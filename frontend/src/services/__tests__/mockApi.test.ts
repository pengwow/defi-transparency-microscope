import { describe, it, expect } from 'vitest';
import { MockAPI } from '../mockApi';
import { listExperiments, getExperiment } from '../experiments';
import type { DataAPI } from '../api';

describe('services/mockApi', () => {
  it('satisfies the DataAPI interface (all methods are present)', () => {
    const api: DataAPI = new MockAPI();
    // The presence of these properties proves the interface is satisfied;
    // calling them is verified by the per-method tests below.
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
    it('returns at least 5 pools', async () => {
      const pools = await new MockAPI().listPools();
      expect(pools.length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('listTransactions', () => {
    it('returns ~30 transactions', async () => {
      const txs = await new MockAPI().listTransactions();
      expect(txs.length).toBeGreaterThanOrEqual(28);
      expect(txs.length).toBeLessThanOrEqual(32);
    });
  });

  describe('listLendingPositions / listLpPositions', () => {
    it('returns 8 lending positions', async () => {
      const lend = await new MockAPI().listLendingPositions();
      expect(lend).toHaveLength(8);
    });

    it('returns 8 lp positions', async () => {
      const lp = await new MockAPI().listLpPositions();
      expect(lp).toHaveLength(8);
    });
  });

  describe('listExperiments / getExperiment', () => {
    it('exposes the experiments preset list', () => {
      const presets = listExperiments();
      expect(presets.length).toBeGreaterThan(0);
      for (const p of presets) {
        expect(typeof p.id).toBe('string');
        expect(typeof p.name).toBe('string');
        expect(typeof p.config).toBe('object');
      }
    });

    it('looks up an experiment by id', () => {
      const presets = listExperiments();
      const first = presets[0];
      const got = getExperiment(first.id);
      expect(got.id).toBe(first.id);
    });

    it('returns an experiment list via the API', async () => {
      const list = await new MockAPI().listExperiments();
      expect(list.length).toBeGreaterThan(0);
    });

    it('throws for an unknown experiment id', () => {
      expect(() => getExperiment('does-not-exist')).toThrow(/UNKNOWN_EXPERIMENT/);
    });
  });

  describe('experiment runners', () => {
    it('runSandwichExperiment returns a result with the expected shape', async () => {
      const res = await new MockAPI().runSandwichExperiment({
        reserve0: 1000n * 10n ** 18n,
        reserve1: 3_000_000n * 10n ** 6n,
        victimAmountIn: 50n * 10n ** 18n,
        attackerAmountIn: 100n * 10n ** 18n,
        fee: 3000,
      });
      expect(res).toBeDefined();
      expect(res.config).toBeDefined();
      expect(typeof res.durationMs).toBe('number');
      expect(res.results.length).toBeGreaterThan(0);
    });

    it('runIlExperiment returns a result', async () => {
      const res = await new MockAPI().runIlExperiment({
        reserve0: 1000n * 10n ** 18n,
        reserve1: 3_000_000n * 10n ** 6n,
        priceRatio: 1.5,
      });
      expect(res).toBeDefined();
      expect(res.results.length).toBeGreaterThan(0);
    });

    it('runAttributionExperiment returns a result', async () => {
      const res = await new MockAPI().runAttributionExperiment({
        reserve0: 1000n * 10n ** 18n,
        reserve1: 3_000_000n * 10n ** 6n,
        amountIn: 50n * 10n ** 18n,
        fee: 3000,
      });
      expect(res).toBeDefined();
      expect(res.results.length).toBeGreaterThan(0);
    });
  });
});
