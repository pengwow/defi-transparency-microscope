import { describe, it, expect } from 'vitest';
import {
  attributeProfit,
  componentsToObject,
  type AttributeKey,
} from '../attribution';

const E18 = 10n ** 18n;

describe('Profit attribution', () => {
  describe('attributeProfit', () => {
    it('total = priceImpact + fees - gasCost + rebates', () => {
      const r = attributeProfit({
        priceImpact: 100n * E18,
        fees: 5n * E18,
        gasCost: 2n * E18,
        rebates: 1n * E18,
      });
      expect(r.total).toBe(104n * E18);
    });

    it('handles all-zero components', () => {
      const r = attributeProfit({ priceImpact: 0n, fees: 0n, gasCost: 0n, rebates: 0n });
      expect(r.total).toBe(0n);
      expect(Object.values(r.percentages).every((p) => p === 0 || Number.isNaN(p))).toBe(true);
    });

    it('handles negative profit (loss)', () => {
      const r = attributeProfit({
        priceImpact: -10n * E18,
        fees: 0n,
        gasCost: 5n * E18,
        rebates: 0n,
      });
      expect(r.total).toBe(-15n * E18);
    });

    it('breakdown echoes input values', () => {
      const comps = { priceImpact: 7n * E18, fees: 1n * E18, gasCost: 2n * E18, rebates: 0n };
      const r = attributeProfit(comps);
      expect(r.breakdown.priceImpact).toBe(comps.priceImpact);
      expect(r.breakdown.fees).toBe(comps.fees);
      expect(r.breakdown.gasCost).toBe(comps.gasCost);
      expect(r.breakdown.rebates).toBe(comps.rebates);
    });

    it('percentages sum to 1 (or all zero) for positive total', () => {
      // Use only additive components (no gasCost) so the sum of |components|
      // equals |total| and the percentages are well-defined and sum to 1.
      const r = attributeProfit({
        priceImpact: 50n * E18,
        fees: 25n * E18,
        gasCost: 0n,
        rebates: 10n * E18,
      });
      const sum =
        r.percentages.priceImpact +
        r.percentages.fees +
        r.percentages.gasCost +
        r.percentages.rebates;
      expect(sum).toBeCloseTo(1.0, 6);
    });

    it('uses absolute total for percentage denominator', () => {
      const r = attributeProfit({
        priceImpact: -20n * E18,
        fees: 0n,
        gasCost: 5n * E18,
        rebates: 0n,
      });
      // 5 / 25 = 0.2 ; 20 / 25 = 0.8
      expect(r.percentages.gasCost).toBeCloseTo(0.2, 6);
      expect(Math.abs(r.percentages.priceImpact)).toBeCloseTo(0.8, 6);
    });

    it('contains all four keys in breakdown and percentages', () => {
      const r = attributeProfit({ priceImpact: 0n, fees: 0n, gasCost: 0n, rebates: 0n });
      const keys: AttributeKey[] = ['priceImpact', 'fees', 'gasCost', 'rebates'];
      for (const k of keys) {
        expect(r.breakdown[k]).toBe(0n);
        expect(k in r.percentages).toBe(true);
      }
    });
  });

  describe('componentsToObject', () => {
    it('returns the input as a plain object', () => {
      const c = { priceImpact: 1n, fees: 2n, gasCost: 3n, rebates: 4n };
      const o = componentsToObject(c);
      expect(o).toEqual(c);
    });
  });
});
