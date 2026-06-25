import { describe, it, expect } from 'vitest';
import { calculateV2IL, calculateV3IL, ilToPercent, priceRatioFromPrices } from '../il';

describe('Impermanent Loss', () => {
  describe('calculateV2IL', () => {
    it('returns 0 when price is unchanged', () => {
      expect(calculateV2IL(1)).toBeCloseTo(0, 10);
    });

    it('is negative when price moves (loss vs HODL)', () => {
      const il = calculateV2IL(2);
      expect(il).toBeLessThan(0);
      // 2x price change: IL = 2*sqrt(2)/(1+2) - 1 = 2*1.4142/3 - 1 = 0.9428 - 1 = -0.0572
      expect(il).toBeCloseTo(-0.0572, 3);
    });

    it('is symmetric for reciprocal price ratios', () => {
      const ilUp = calculateV2IL(2);
      const ilDown = calculateV2IL(0.5);
      expect(ilUp).toBeCloseTo(ilDown, 10);
    });

    it('approaches -100% for extreme price changes', () => {
      const il = calculateV2IL(1000);
      expect(il).toBeLessThan(-0.97);
      expect(il).toBeGreaterThan(-1);
    });

    it('throws on non-positive price ratio', () => {
      expect(() => calculateV2IL(0)).toThrow();
      expect(() => calculateV2IL(-1)).toThrow();
    });
  });

  describe('calculateV3IL', () => {
    it('matches V2 when upper == lower (concentration=1)', () => {
      // calculateV3IL(p, 100, 100, 100) — upper==lower ⇒ concentration=1 ⇒ V2 IL
      const v3 = calculateV3IL(2, 100, 100, 100);
      const v2 = calculateV2IL(2);
      expect(v3).toBeCloseTo(v2, 10);
    });

    it('V3 in-range loss amplified by concentration < 1', () => {
      // Concentration 0.5 doubles the loss
      const v2 = calculateV2IL(2);
      const v3 = calculateV3IL(2, 0.5, 2, 0.5); // 0.5 < 1 should amplify
      expect(v3).toBeLessThan(v2);
    });

    it('falls back to V2 with default concentration = 1', () => {
      const v3 = calculateV3IL(1.5, 0.5, 2);
      const v2 = calculateV2IL(1.5);
      expect(v3).toBeCloseTo(v2, 10);
    });

    it('handles price below range', () => {
      // p=0.1, range [1, 10] — out of range
      const il = calculateV3IL(0.1, 1, 10, 1);
      expect(Number.isFinite(il)).toBe(true);
    });

    it('handles price above range', () => {
      const il = calculateV3IL(20, 1, 10, 1);
      expect(Number.isFinite(il)).toBe(true);
    });

    it('throws on pl > pu', () => {
      expect(() => calculateV3IL(1, 2, 1, 1)).toThrow();
    });
  });

  describe('ilToPercent', () => {
    it('multiplies by 100 and preserves sign', () => {
      expect(ilToPercent(-0.05)).toBeCloseTo(-5, 6);
      expect(ilToPercent(0)).toBe(0);
    });
  });

  describe('priceRatioFromPrices', () => {
    it('returns newPrice / oldPrice', () => {
      expect(priceRatioFromPrices(200, 100)).toBe(2);
      expect(priceRatioFromPrices(50, 100)).toBe(0.5);
    });

    it('throws on zero old price', () => {
      expect(() => priceRatioFromPrices(1, 0)).toThrow();
    });
  });
});
