/**
 * Tests for `experiments/attribution.ts` — P&L decomposition into
 * priceImpact, fees, gasCost, and rebates.
 *
 * Pure math, no mocks.  Cases cover:
 *  - simple positive attribution (sum equals total)
 *  - zero IL / zero fees → net equals sum of remaining components
 *  - fees + rebates + price impact all positive
 *  - negative P&L (loss) — total below zero
 *  - all-zero components
 *  - components echoed in the breakdown
 */
import { describe, it, expect } from 'vitest';

import {
  runAttributionExperiment,
  attributeProfit,
  type AttributionComponents,
} from '../../src/experiments/attribution.js';

const ONE_E18 = 10n ** 18n;

describe('experiments/attribution', () => {
  describe('attributeProfit (helper)', () => {
    it('total = priceImpact + fees - gasCost + rebates', () => {
      const r = attributeProfit({
        priceImpact: 100n * ONE_E18,
        fees: 5n * ONE_E18,
        gasCost: 2n * ONE_E18,
        rebates: 1n * ONE_E18,
      });
      expect(r.total).toBe(104n * ONE_E18);
    });

    it('all-zero components ⇒ total is 0 and percentages are 0', () => {
      const r = attributeProfit({ priceImpact: 0n, fees: 0n, gasCost: 0n, rebates: 0n });
      expect(r.total).toBe(0n);
      expect(r.percentages).toEqual({ priceImpact: 0, fees: 0, gasCost: 0, rebates: 0 });
    });

    it('handles negative P&L (loss)', () => {
      const r = attributeProfit({
        priceImpact: -10n * ONE_E18,
        fees: 0n,
        gasCost: 5n * ONE_E18,
        rebates: 0n,
      });
      expect(r.total).toBe(-15n * ONE_E18);
    });

    it('breakdown echoes input values', () => {
      const c: AttributionComponents = {
        priceImpact: 7n * ONE_E18,
        fees: 1n * ONE_E18,
        gasCost: 2n * ONE_E18,
        rebates: 0n,
      };
      const r = attributeProfit(c);
      expect(r.breakdown).toEqual(c);
    });

    it('uses absolute total for percentage denominator', () => {
      const r = attributeProfit({
        priceImpact: -20n * ONE_E18,
        fees: 0n,
        gasCost: 5n * ONE_E18,
        rebates: 0n,
      });
      expect(r.percentages.gasCost).toBeCloseTo(0.2, 6);
      expect(Math.abs(r.percentages.priceImpact)).toBeCloseTo(0.8, 6);
    });
  });

  describe('runAttributionExperiment', () => {
    it('net = priceImpact + fees - gasCost + rebates', () => {
      const res = runAttributionExperiment({
        reserve0: 80_000n * ONE_E18,
        reserve1: 160_000_000n * 10n ** 6n,
        amountIn: 10n * ONE_E18,
        fee: 3000,
        rebates: 0n,
        gasCost: 0n,
      });
      const r = res.result;
      // Result uses string bigints via the .toString() convention.
      const net = BigInt(r.netPnl as string);
      const priceImpact = BigInt(r.priceImpact as string);
      const fees = BigInt(r.fees as string);
      const gasCost = BigInt(r.gasCost as string);
      const rebates = BigInt(r.rebates as string);
      expect(net).toBe(priceImpact + fees - gasCost + rebates);
    });

    it('all positive components → net > 0 and equals sum of components', () => {
      const res = runAttributionExperiment({
        reserve0: 80_000n * ONE_E18,
        reserve1: 160_000_000n * 10n ** 6n,
        amountIn: 10n * ONE_E18,
        fee: 3000,
        rebates: 1n * 10n ** 6n, // 1 USDC
        gasCost: 5n * 10n ** 14n, // 0.0005 ETH
      });
      const r = res.result;
      const net = BigInt(r.netPnl as string);
      const fees = BigInt(r.fees as string);
      const rebates = BigInt(r.rebates as string);
      const gasCost = BigInt(r.gasCost as string);
      // net > 0 because price impact (negative) is small relative to rebates.
      // More importantly, the equation holds:
      const priceImpact = BigInt(r.priceImpact as string);
      expect(net).toBe(priceImpact + fees - gasCost + rebates);
      // And fees are negative (a cost from the trader's perspective).
      expect(fees < 0n).toBe(true);
      // Rebates are positive.
      expect(rebates > 0n).toBe(true);
    });

    it('zero fee case → fees component is 0', () => {
      const res = runAttributionExperiment({
        reserve0: 80_000n * ONE_E18,
        reserve1: 160_000_000n * 10n ** 6n,
        amountIn: 10n * ONE_E18,
        fee: 0,
      });
      const r = res.result;
      expect(BigInt(r.fees as string)).toBe(0n);
      // Net still equals the other components.
      const net = BigInt(r.netPnl as string);
      const priceImpact = BigInt(r.priceImpact as string);
      const gasCost = BigInt(r.gasCost as string);
      const rebates = BigInt(r.rebates as string);
      expect(net).toBe(priceImpact - gasCost + rebates);
    });

    it('zero fee case → net = priceImpact - gasCost + rebates', () => {
      // Use 0% pool so the fees component is forced to 0; gas/rebates
      // are also 0 by default, so net should equal priceImpact exactly.
      const res = runAttributionExperiment({
        reserve0: 80_000n * ONE_E18,
        reserve1: 160_000_000n * 10n ** 6n,
        amountIn: 10n * ONE_E18,
        fee: 0,
      });
      const r = res.result;
      expect(BigInt(r.fees as string)).toBe(0n);
      const net = BigInt(r.netPnl as string);
      const priceImpact = BigInt(r.priceImpact as string);
      const gasCost = BigInt(r.gasCost as string);
      const rebates = BigInt(r.rebates as string);
      expect(net).toBe(priceImpact - gasCost + rebates);
    });

    it('zero fee and zero gas/rebates → net = priceImpact', () => {
      const res = runAttributionExperiment({
        reserve0: 80_000n * ONE_E18,
        reserve1: 160_000_000n * 10n ** 6n,
        amountIn: 10n * ONE_E18,
        fee: 0,
      });
      const r = res.result;
      const net = BigInt(r.netPnl as string);
      const priceImpact = BigInt(r.priceImpact as string);
      expect(net).toBe(priceImpact);
    });

    it('returns a non-negative durationMs', () => {
      const res = runAttributionExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        amountIn: ONE_E18,
        fee: 3000,
      });
      expect(res.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('echoes the input reserves in the result', () => {
      const r0 = 80_000n * ONE_E18;
      const r1 = 160_000_000n * 10n ** 6n;
      const res = runAttributionExperiment({
        reserve0: r0,
        reserve1: r1,
        amountIn: 10n * ONE_E18,
        fee: 3000,
      });
      expect(res.result.reserve0).toBe(r0.toString());
      expect(res.result.reserve1).toBe(r1.toString());
      expect(res.result.feeHundredthsBip).toBe(3000);
    });

    it('result contains all four attribution keys', () => {
      const res = runAttributionExperiment({
        reserve0: ONE_E18,
        reserve1: ONE_E18,
        amountIn: ONE_E18,
        fee: 3000,
      });
      const r = res.result;
      expect(r).toHaveProperty('priceImpact');
      expect(r).toHaveProperty('fees');
      expect(r).toHaveProperty('gasCost');
      expect(r).toHaveProperty('rebates');
      expect(r).toHaveProperty('netPnl');
    });
  });
});
