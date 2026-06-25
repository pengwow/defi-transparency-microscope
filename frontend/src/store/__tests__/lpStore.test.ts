/**
 * Tests for the lpStore — the V2/V3 + 4-slider state for the
 * LP/IL microscope tab.
 *
 * State surface:
 *   - version:        'v2' | 'v3'
 *   - priceRatio:     number (clamped to 0.1..10)
 *   - concentration:  number (V3-only, ±range, default 0)
 *   - fee:            number (LP fee tier, default 0.3 %)
 *   - depositUsd:     number (default $10,000)
 *
 * Actions:
 *   - setVersion, setPriceRatio, setConcentration, setFee, setDepositUsd, reset
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLpStore } from '../lpStore';

describe('store/lpStore', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('starts on v2 with the default parameter set', () => {
    const s = useLpStore.getState();
    expect(s.version).toBe('v2');
    expect(s.priceRatio).toBe(1.0);
    expect(s.concentration).toBe(0);
    expect(s.fee).toBe(0.3);
    expect(s.depositUsd).toBe(10000);
  });

  it('setVersion toggles between v2 and v3', () => {
    useLpStore.getState().setVersion('v3');
    expect(useLpStore.getState().version).toBe('v3');
    useLpStore.getState().setVersion('v2');
    expect(useLpStore.getState().version).toBe('v2');
  });

  it('setPriceRatio stores a valid ratio', () => {
    useLpStore.getState().setPriceRatio(2.5);
    expect(useLpStore.getState().priceRatio).toBe(2.5);
  });

  it('setPriceRatio clamps values below 0.1 up to 0.1', () => {
    useLpStore.getState().setPriceRatio(0);
    expect(useLpStore.getState().priceRatio).toBe(0.1);
    useLpStore.getState().setPriceRatio(-5);
    expect(useLpStore.getState().priceRatio).toBe(0.1);
  });

  it('setPriceRatio clamps values above 10 down to 10', () => {
    useLpStore.getState().setPriceRatio(20);
    expect(useLpStore.getState().priceRatio).toBe(10);
    useLpStore.getState().setPriceRatio(99);
    expect(useLpStore.getState().priceRatio).toBe(10);
  });

  it('setPriceRatio accepts the boundary values 0.1 and 10', () => {
    useLpStore.getState().setPriceRatio(0.1);
    expect(useLpStore.getState().priceRatio).toBe(0.1);
    useLpStore.getState().setPriceRatio(10);
    expect(useLpStore.getState().priceRatio).toBe(10);
  });

  it('setConcentration stores a ± range value', () => {
    useLpStore.getState().setConcentration(0.2);
    expect(useLpStore.getState().concentration).toBe(0.2);
    useLpStore.getState().setConcentration(-0.1);
    expect(useLpStore.getState().concentration).toBe(-0.1);
  });

  it('setFee updates the fee tier', () => {
    useLpStore.getState().setFee(0.05);
    expect(useLpStore.getState().fee).toBe(0.05);
  });

  it('setDepositUsd updates the deposit amount', () => {
    useLpStore.getState().setDepositUsd(25000);
    expect(useLpStore.getState().depositUsd).toBe(25000);
  });

  it('reset restores the default state', () => {
    useLpStore.getState().setVersion('v3');
    useLpStore.getState().setPriceRatio(5);
    useLpStore.getState().setConcentration(0.1);
    useLpStore.getState().setFee(1);
    useLpStore.getState().setDepositUsd(99999);
    useLpStore.getState().reset();
    const s = useLpStore.getState();
    expect(s.version).toBe('v2');
    expect(s.priceRatio).toBe(1.0);
    expect(s.concentration).toBe(0);
    expect(s.fee).toBe(0.3);
    expect(s.depositUsd).toBe(10000);
  });
});
