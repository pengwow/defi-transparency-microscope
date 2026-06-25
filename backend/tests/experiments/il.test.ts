/**
 * Tests for `experiments/il.ts` — V2 and V3 impermanent loss.
 *
 * These exercise the pure math ported from the frontend
 * (`frontend/src/algorithms/il.ts`). No mocks: the function is
 * deterministic and the test inputs are chosen so the closed-form
 * results are easy to verify by hand.
 */
import { describe, it, expect } from 'vitest';

import { runIlExperiment, calculateV2IL, calculateV3IL } from '../../src/experiments/il.js';

const ONE_E18 = 10n ** 18n;

describe('experiments/il', () => {
  describe('calculateV2IL (helper)', () => {
    it('returns 0 when price is unchanged', () => {
      expect(calculateV2IL(1)).toBeCloseTo(0, 10);
    });

    it('is approximately -0.0572 at 2x price change', () => {
      // IL(p) = 2*sqrt(p) / (1+p) - 1
      // p=2: 2*1.41421356 / 3 - 1 = 0.9428 - 1 = -0.0572
      expect(calculateV2IL(2)).toBeCloseTo(-0.0572, 3);
    });

    it('is approximately -0.20 at 4x price change', () => {
      // p=4: 2*2 / 5 - 1 = 0.8 - 1 = -0.2
      expect(calculateV2IL(4)).toBeCloseTo(-0.2, 6);
    });

    it('is symmetric for reciprocal price ratios', () => {
      expect(calculateV2IL(0.5)).toBeCloseTo(calculateV2IL(2), 10);
    });

    it('approaches -100% for extreme price changes', () => {
      const il = calculateV2IL(10000);
      expect(il).toBeLessThan(-0.97);
      expect(il).toBeGreaterThan(-1);
    });

    it('throws on non-positive price ratio', () => {
      expect(() => calculateV2IL(0)).toThrow();
      expect(() => calculateV2IL(-1)).toThrow();
    });
  });

  describe('calculateV3IL (helper)', () => {
    it('matches V2 when upper == lower (concentration=1)', () => {
      const v3 = calculateV3IL(2, 100, 100, 100);
      const v2 = calculateV2IL(2);
      expect(v3).toBeCloseTo(v2, 10);
    });

    it('concentration < 1 amplifies the loss', () => {
      const v2 = calculateV2IL(2);
      const v3 = calculateV3IL(2, 0.5, 2, 0.5);
      expect(v3).toBeLessThan(v2);
    });

    it('falls back to V2 with default concentration = 1', () => {
      const v3 = calculateV3IL(1.5, 0.5, 2);
      const v2 = calculateV2IL(1.5);
      expect(v3).toBeCloseTo(v2, 10);
    });

    it('handles price below range', () => {
      expect(Number.isFinite(calculateV3IL(0.1, 1, 10, 1))).toBe(true);
    });

    it('handles price above range', () => {
      expect(Number.isFinite(calculateV3IL(20, 1, 10, 1))).toBe(true);
    });

    it('throws on pl > pu', () => {
      expect(() => calculateV3IL(1, 2, 1, 1)).toThrow();
    });
  });

  describe('runIlExperiment', () => {
    it('returns 0 IL when price ratio is 1', () => {
      const res = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 1,
      });
      expect(res.result.il).toBeCloseTo(0, 10);
      expect(res.result.variant).toBe('v2');
    });

    it('returns approximately -0.0572 for a 2x price change (V2 default)', () => {
      const res = runIlExperiment({
        reserve0: 80_000n * ONE_E18,
        reserve1: 160_000_000n * 10n ** 6n,
        priceRatio: 2,
      });
      expect(res.result.il).toBeCloseTo(-0.0572, 3);
      expect(res.result.variant).toBe('v2');
    });

    it('returns exactly -0.2 for a 4x price change (V2 default)', () => {
      const res = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 4,
      });
      expect(res.result.il).toBeCloseTo(-0.2, 6);
    });

    it('returns the same IL for p=0.5 as for p=2 (V2 symmetry)', () => {
      const up = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 2,
      });
      const down = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 0.5,
      });
      expect(down.result.il).toBeCloseTo(up.result.il, 10);
    });

    it('approaches -100% for an extreme price change', () => {
      const res = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 10000,
      });
      const il = res.result.il as number;
      expect(il).toBeLessThan(-0.97);
      expect(il).toBeGreaterThan(-1);
    });

    it('uses V3 variant when tickLower/tickUpper are provided', () => {
      const res = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 2,
        tickLower: 100,
        tickUpper: 100,
        concentration: 1,
      });
      expect(res.result.variant).toBe('v3');
      // pl == pu ⇒ concentration forced to 1 ⇒ matches V2
      expect(res.result.il).toBeCloseTo(calculateV2IL(2), 10);
    });

    it('V3 with concentration < 1 amplifies the loss vs V2', () => {
      const v2 = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 1.5,
      });
      const v3 = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 1.5,
        tickLower: 1,
        tickUpper: 2,
        concentration: 0.5,
      });
      const v2Il = v2.result.il as number;
      const v3Il = v3.result.il as number;
      expect(v3Il).toBeLessThan(v2Il);
    });

    it('throws on non-positive price ratio', () => {
      expect(() =>
        runIlExperiment({ reserve0: ONE_E18, reserve1: ONE_E18, priceRatio: 0 }),
      ).toThrow();
      expect(() =>
        runIlExperiment({ reserve0: ONE_E18, reserve1: ONE_E18, priceRatio: -1 }),
      ).toThrow();
    });

    it('returns a non-negative durationMs', () => {
      const res = runIlExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        priceRatio: 1.5,
      });
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('echoes the input reserves in the result', () => {
      const r0 = 80_000n * ONE_E18;
      const r1 = 160_000_000n * 10n ** 6n;
      const res = runIlExperiment({ reserve0: r0, reserve1: r1, priceRatio: 2 });
      expect(res.result.reserve0).toBe(r0.toString());
      expect(res.result.reserve1).toBe(r1.toString());
    });
  });
});
