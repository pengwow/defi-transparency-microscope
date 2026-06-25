import { describe, it, expect } from 'vitest';
import {
  calculateHealthFactor,
  isLiquidatable,
  liquidationPriceE18,
  formatHF,
} from '../hf';
import type { LendingPosition } from '../../types';

const E18 = 10n ** 18n;

function makePosition(collateral: Record<string, bigint>, debt: Record<string, bigint>, lt: bigint = 8n * 10n ** 17n): LendingPosition {
  return {
    id: 'pos-1',
    owner: '0xowner',
    protocol: 'aave',
    collateral,
    debt,
    liquidationThresholdE18: lt,
    timestamp: 0,
  };
}

describe('Health Factor (Aave-style)', () => {
  describe('calculateHealthFactor', () => {
    it('HF >= 1 means safe (collateral * threshold > debt)', () => {
      // 1000 USD collateral, 80% threshold, 500 USD debt
      // HF = (1000 * 0.8) / 500 = 1.6
      const collateralE18 = 1000n * E18;
      const debtE18 = 500n * E18;
      const thresholdE18 = 8n * 10n ** 17n; // 0.8
      const hf = calculateHealthFactor(collateralE18, debtE18, thresholdE18);
      expect(hf).toBe(16n * 10n ** 17n); // 1.6e18
    });

    it('HF < 1 means liquidatable', () => {
      // 1000 USD collateral, 80% threshold, 1000 USD debt
      // HF = (1000 * 0.8) / 1000 = 0.8
      const collateralE18 = 1000n * E18;
      const debtE18 = 1000n * E18;
      const thresholdE18 = 8n * 10n ** 17n;
      const hf = calculateHealthFactor(collateralE18, debtE18, thresholdE18);
      expect(hf).toBeLessThan(E18);
    });

    it('zero debt returns very large HF (effectively infinite)', () => {
      const hf = calculateHealthFactor(1000n * E18, 0n, 8n * 10n ** 17n);
      expect(hf).toBeGreaterThanOrEqual(10n ** 36n);
    });

    it('zero collateral with debt => 0 HF', () => {
      const hf = calculateHealthFactor(0n, 1000n * E18, 8n * 10n ** 17n);
      expect(hf).toBe(0n);
    });

    it('throws on negative threshold', () => {
      expect(() => calculateHealthFactor(1000n * E18, 500n * E18, -1n)).toThrow();
    });
  });

  describe('isLiquidatable', () => {
    it('returns false for HF >= 1', () => {
      const pos = makePosition({ A: 1000n * E18 }, { B: 500n * E18 });
      expect(isLiquidatable(pos, 1000n * E18, 500n * E18)).toBe(false);
    });

    it('returns true for HF < 1', () => {
      const pos = makePosition({ A: 100n * E18 }, { B: 500n * E18 });
      expect(isLiquidatable(pos, 100n * E18, 500n * E18)).toBe(true);
    });
  });

  describe('liquidationPriceE18', () => {
    it('returns price at which HF = 1', () => {
      // 1 ETH collateral, 0.8 threshold, 500 USDC debt
      // P_liq = debt / (collateralAmount * threshold) = 500 / (1 * 0.8) = 625 USDC/ETH
      const collateralAmount = 1n * E18;
      const debt = 500n * E18;
      const thresholdE18 = 8n * 10n ** 17n;
      const lp = liquidationPriceE18(collateralAmount, debt, thresholdE18);
      expect(lp).toBe(625n * E18);
    });

    it('throws when threshold is 0', () => {
      expect(() => liquidationPriceE18(1n * E18, 1n * E18, 0n)).toThrow();
    });
  });

  describe('formatHF', () => {
    it('formats a 1e18 value as "1.0000"', () => {
      expect(formatHF(E18)).toBe('1.0000');
    });

    it('formats a 16e17 value as "1.6000"', () => {
      expect(formatHF(16n * 10n ** 17n)).toBe('1.6000');
    });

    it('returns "∞" for very large HF', () => {
      expect(formatHF(10n ** 50n)).toBe('∞');
    });
  });
});
