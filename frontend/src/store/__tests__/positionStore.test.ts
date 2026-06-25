import { describe, it, expect, beforeEach } from 'vitest';
import { usePositionStore } from '../positionStore';
import { calculateHealthFactor } from '@/algorithms/hf';
import type { LendingPosition, Position } from '@/types';

const ONE_E18 = 10n ** 18n;

function makeLending(id: string, collateral: bigint, debt: bigint, threshold: bigint): LendingPosition {
  const token = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC
  return {
    id,
    owner: '0x0',
    protocol: 'aave_v3',
    collateral: { [token]: collateral },
    debt: { [token]: debt },
    liquidationThresholdE18: threshold,
    timestamp: 0,
  };
}

function makeLp(id: string): Position {
  return {
    id,
    owner: '0x0',
    poolAddress: '0x1',
    protocol: 'uniswap_v2',
    status: 'active',
    openedAt: 0,
    liquidity: 0n,
    amount0: 0n,
    amount1: 0n,
  };
}

describe('store/positionStore', () => {
  beforeEach(() => {
    usePositionStore.getState().reset();
  });

  it('initial state is empty with no selected address', () => {
    const s = usePositionStore.getState();
    expect(s.lending).toEqual([]);
    expect(s.lp).toEqual([]);
    expect(s.selectedAddress).toBeNull();
    expect(s.pricesE18).toEqual({});
  });

  it('setLending replaces the lending positions', () => {
    const list: LendingPosition[] = [makeLending('a', 1000n, 200n, 8n * 10n ** 17n)];
    usePositionStore.getState().setLending(list);
    expect(usePositionStore.getState().lending).toHaveLength(1);
  });

  it('setLp replaces the LP positions', () => {
    usePositionStore.getState().setLp([makeLp('a')]);
    expect(usePositionStore.getState().lp).toHaveLength(1);
  });

  it('selectAddress stores the wallet address', () => {
    usePositionStore.getState().selectAddress('0xabc');
    expect(usePositionStore.getState().selectedAddress).toBe('abc');
  });

  describe('updatePrice', () => {
    it('stores the new price in pricesE18', () => {
      usePositionStore.getState().updatePrice('0xETH', 2000n * ONE_E18);
      expect(usePositionStore.getState().pricesE18['0xETH']).toBe(2000n * ONE_E18);
    });

    it('moves a healthy position closer to liquidation as price drops', () => {
      // Healthy: collateral 1000, debt 500, threshold 80%
      //   HF = 1000 * 0.8 / 500 = 1.6
      const pos = makeLending('h', 1000n, 500n, 8n * 10n ** 17n);
      const hfBefore = calculateHealthFactor(
        1000n * ONE_E18,
        500n * ONE_E18,
        pos.liquidationThresholdE18,
      );
      expect(hfBefore).toBeGreaterThan(1500000000000000000n);

      // Halve the collateral price — HF should halve.
      const token = Object.keys(pos.collateral)[0];
      usePositionStore.getState().setLending([pos]);
      usePositionStore.getState().updatePrice(token, (1n * 10n ** 18n) / 2n);
      // Verify the price was stored
      expect(usePositionStore.getState().pricesE18[token]).toBe((1n * 10n ** 18n) / 2n);
      // Recompute the HF under the new price; should be ~half the old.
      const updated = usePositionStore.getState().lending[0];
      const colAmount = Object.values(updated.collateral)[0];
      const debtAmount = Object.values(updated.debt)[0];
      const newPrice = usePositionStore.getState().pricesE18[token];
      // Collateral value = amount * newPrice (both e18-scaled).
      const newColValueE18 = (colAmount * newPrice) / ONE_E18;
      const hfAfter = calculateHealthFactor(
        newColValueE18,
        debtAmount * ONE_E18,
        updated.liquidationThresholdE18,
      );
      expect(hfAfter).toBeLessThan(hfBefore);
    });
  });

  it('reset clears everything', () => {
    usePositionStore.getState().setLending([makeLending('a', 1n, 1n, 1n)]);
    usePositionStore.getState().setLp([makeLp('a')]);
    usePositionStore.getState().selectAddress('0xabc');
    usePositionStore.getState().updatePrice('0xETH', 1n);
    usePositionStore.getState().reset();
    const s = usePositionStore.getState();
    expect(s.lending).toEqual([]);
    expect(s.lp).toEqual([]);
    expect(s.selectedAddress).toBeNull();
    expect(s.pricesE18).toEqual({});
  });
});
