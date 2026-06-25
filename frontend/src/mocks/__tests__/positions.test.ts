import { describe, it, expect } from 'vitest';
import { generatePositions } from '../positions';

describe('mocks/positions', () => {
  describe('generatePositions', () => {
    it('returns 8 lending and 8 LP positions by default', () => {
      const { lending, lp } = generatePositions();
      expect(lending).toHaveLength(8);
      expect(lp).toHaveLength(8);
    });

    it('lending positions have the correct shape', () => {
      const { lending } = generatePositions();
      for (const pos of lending) {
        expect(typeof pos.id).toBe('string');
        expect(typeof pos.owner).toBe('string');
        expect(typeof pos.protocol).toBe('string');
        expect(typeof pos.collateral).toBe('object');
        expect(typeof pos.debt).toBe('object');
        expect(pos.liquidationThresholdE18 > 0n).toBe(true);
        expect(pos.timestamp).toBeGreaterThan(0);
      }
    });

    it('lending positions have non-zero collateral and debt', () => {
      const { lending } = generatePositions();
      for (const pos of lending) {
        const collateralSum = Object.values(pos.collateral).reduce(
          (a, b) => a + b,
          0n,
        );
        const debtSum = Object.values(pos.debt).reduce((a, b) => a + b, 0n);
        expect(collateralSum > 0n).toBe(true);
        expect(debtSum > 0n).toBe(true);
      }
    });

    it('LP positions have the correct shape', () => {
      const { lp } = generatePositions();
      for (const pos of lp) {
        expect(typeof pos.id).toBe('string');
        expect(typeof pos.owner).toBe('string');
        expect(typeof pos.poolAddress).toBe('string');
        expect(['uniswap_v2', 'uniswap_v3', 'sushiswap', 'balancer']).toContain(
          pos.protocol,
        );
        expect(['active', 'closed', 'out_of_range']).toContain(pos.status);
        expect(pos.openedAt).toBeGreaterThan(0);
        if (pos.protocol === 'uniswap_v3') {
          expect(pos.tickLower).toBeDefined();
          expect(pos.tickUpper).toBeDefined();
        }
      }
    });

    it('LP positions mix V2 and V3 protocols', () => {
      const { lp } = generatePositions();
      const v3Count = lp.filter((p) => p.protocol === 'uniswap_v3').length;
      const v2Count = lp.filter(
        (p) => p.protocol === 'uniswap_v2' || p.protocol === 'sushiswap',
      ).length;
      expect(v3Count).toBeGreaterThan(0);
      expect(v2Count).toBeGreaterThan(0);
    });

    it('is reproducible from the same seed', () => {
      const a = generatePositions({ seed: 7 });
      const b = generatePositions({ seed: 7 });
      expect(a.lending).toHaveLength(b.lending.length);
      expect(a.lp).toHaveLength(b.lp.length);
      for (let i = 0; i < a.lending.length; i++) {
        expect(a.lending[i].id).toBe(b.lending[i].id);
      }
      for (let i = 0; i < a.lp.length; i++) {
        expect(a.lp[i].id).toBe(b.lp[i].id);
        expect(a.lp[i].protocol).toBe(b.lp[i].protocol);
      }
    });
  });
});
