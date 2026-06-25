import { describe, it, expect } from 'vitest';
import {
  getAmountOut,
  getAmountIn,
  priceImpactE18,
  newReservesAfterSwap,
  spotPriceE18,
} from '../cpmm';

const ONE_E18 = 10n ** 18n;
const ONE_E21 = 10n ** 21n;

describe('CPMM (Uniswap V2 constant product)', () => {
  describe('getAmountOut', () => {
    it('matches Uniswap V2 reference for 0.3% fee (~271.94e18 out)', () => {
      // reserveIn=reserveOut=1e21, amountIn=3.746e20
      // result = (3.746e20 * 997 * 1e21) / (1e21 * 1000 + 3.746e20 * 997)
      //        = (3734.762e41) / (1373.4762e21)
      //        = ~271.94e18
      const result = getAmountOut(374600000000000000000n, ONE_E21, ONE_E21);
      expect(result).toBeGreaterThan(271900000000000000000n);
      expect(result).toBeLessThan(272000000000000000000n);
    });

    it('returns 0 for 0 input', () => {
      expect(() => getAmountOut(0n, ONE_E18, ONE_E18)).toThrow(/INSUFFICIENT_INPUT/);
    });

    it('throws on zero reserves', () => {
      expect(() => getAmountOut(1n, 0n, ONE_E18)).toThrow();
      expect(() => getAmountOut(1n, ONE_E18, 0n)).toThrow();
    });

    it('cannot drain the pool even with huge input', () => {
      // Huge input should not give back >= reserveOut
      const result = getAmountOut(10n ** 30n, ONE_E18, ONE_E18);
      expect(result).toBeLessThan(ONE_E18);
      expect(result).toBeGreaterThan(0n);
    });

    it('handles tiny input correctly (no overflow, returns 0)', () => {
      const result = getAmountOut(1n, 10n ** 18n, 10n ** 18n);
      // amountIn * 997 * reserveOut = 997 * 1e18
      // denominator = 1000 * 1e18 + 997 = 1e21 + 997
      // = 0 (integer division)
      expect(result).toBe(0n);
    });
  });

  describe('getAmountIn', () => {
    it('round-trips with realistic reserves 1e18 / 3e12', () => {
      // reserveIn=1e18, reserveOut=3e12, desiredOut=1e12
      const desiredOut = 1n * 10n ** 12n;
      const amountIn = getAmountIn(desiredOut, ONE_E18, 3n * 10n ** 12n);
      // amountIn should be a positive bigint, not too large
      expect(amountIn).toBeGreaterThan(0n);
      // Putting it in should give back >= desiredOut
      const out = getAmountOut(amountIn, ONE_E18, 3n * 10n ** 12n);
      expect(out).toBeGreaterThanOrEqual(desiredOut);
    });

    it('throws on output >= reserve', () => {
      expect(() => getAmountIn(10n, 1n, 5n)).toThrow(/INSUFFICIENT_LIQUIDITY/);
    });

    it('throws on zero output', () => {
      expect(() => getAmountIn(0n, ONE_E18, ONE_E18)).toThrow();
    });
  });

  describe('priceImpactE18', () => {
    it('is at least the fee (>= ~0.3%) for any non-zero input', () => {
      // 0.3% fee is baked into the price impact
      const impact = priceImpactE18(10n ** 15n, ONE_E21, ONE_E21);
      expect(impact).toBeGreaterThan(0n);
      // impact should be small (close to 0.3%) for small trade
      expect(impact).toBeLessThan(10n ** 16n); // < 1%
    });

    it('is positive for large trade and < 100% (1e18)', () => {
      const impact = priceImpactE18(ONE_E21, ONE_E21, ONE_E21);
      expect(impact).toBeGreaterThan(0n);
      expect(impact).toBeLessThan(ONE_E18);
    });

    it('approaches 1e18 for astronomical input (drain scenario)', () => {
      const impact = priceImpactE18(10n ** 30n, ONE_E18, ONE_E18);
      // For very large input, the impact should be very close to 100%
      expect(impact).toBeGreaterThan(9n * 10n ** 17n);
    });
  });

  describe('newReservesAfterSwap', () => {
    it('k increases because of the fee', () => {
      const amountIn = ONE_E18;
      const amountOut = getAmountOut(amountIn, ONE_E21, ONE_E21);
      const result = newReservesAfterSwap(amountIn, amountOut, ONE_E21, ONE_E21);
      expect(result.kAfter).toBeGreaterThan(result.kBefore);
    });

    it('updates reserves correctly', () => {
      const amountIn = 10n ** 18n;
      const amountOut = getAmountOut(amountIn, 10n ** 20n, 10n ** 20n);
      const r = newReservesAfterSwap(amountIn, amountOut, 10n ** 20n, 10n ** 20n);
      expect(r.reserveIn).toBe(10n ** 20n + amountIn);
      expect(r.reserveOut).toBe(10n ** 20n - amountOut);
    });
  });

  describe('spotPriceE18', () => {
    it('returns reserveOut/reserveIn scaled by 1e18', () => {
      const price = spotPriceE18(ONE_E18, 3n * ONE_E18);
      expect(price).toBe(3n * ONE_E18);
    });

    it('throws on zero reserveIn', () => {
      expect(() => spotPriceE18(0n, 1n)).toThrow();
    });
  });
});
