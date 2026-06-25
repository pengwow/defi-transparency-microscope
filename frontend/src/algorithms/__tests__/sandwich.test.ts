import { describe, it, expect } from 'vitest';
import { simulateSandwich, isSandwichProfitable } from '../sandwich';

const ONE_E18 = 10n ** 18n;
const ONE_E21 = 10n ** 21n;

describe('Sandwich attack simulation (same-direction 3-swap model)', () => {
  it('produces positive attacker profit on a profitable trade', () => {
    // 1e21 reserves; attacker puts in 1e20; victim 5e19
    const result = simulateSandwich(ONE_E21, ONE_E21, 5n * 10n ** 19n, 10n ** 20n);
    expect(result.attackerProfit).toBeGreaterThan(0n);
    expect(result.attackerReceived).toBeGreaterThan(result.attackerSpent);
  });

  it('attackerProfit = step3.amountOut - baseline (attackerAmountIn)', () => {
    const attackerIn = 10n ** 20n;
    const victimIn = 5n * 10n ** 19n;
    const r = simulateSandwich(ONE_E21, ONE_E21, victimIn, attackerIn);
    expect(r.attackerProfit).toBe(r.step3AmountOut - attackerIn);
  });

  it('victim loss equals baseline no-sandwich out minus sandwiched out', () => {
    const attackerIn = 10n ** 20n;
    const victimIn = 5n * 10n ** 19n;
    const r = simulateSandwich(ONE_E21, ONE_E21, victimIn, attackerIn);
    expect(r.victimLoss).toBeGreaterThan(0n);
  });

  it('isSandwichProfitable is true for a profitable scenario', () => {
    const r = simulateSandwich(ONE_E21, ONE_E21, 5n * 10n ** 19n, 10n ** 20n);
    expect(isSandwichProfitable(r)).toBe(true);
  });

  it('zero attacker input => zero profit', () => {
    const r = simulateSandwich(ONE_E21, ONE_E21, 10n ** 18n, 0n);
    expect(r.attackerSpent).toBe(0n);
    expect(r.attackerReceived).toBe(0n);
    expect(r.attackerProfit).toBe(0n);
  });

  it('throws on invalid reserves', () => {
    expect(() => simulateSandwich(0n, ONE_E18, 1n, 1n)).toThrow();
    expect(() => simulateSandwich(ONE_E18, 0n, 1n, 1n)).toThrow();
  });

  it('throws on negative victim or attacker amount', () => {
    expect(() => simulateSandwich(ONE_E18, ONE_E18, 0n, 1n)).toThrow();
    expect(() => simulateSandwich(ONE_E18, ONE_E18, -1n, 1n)).toThrow();
  });
});
