/**
 * Tests for the liquidationStore — panorama/focus mode, focus
 * address, 5 simulation sliders, and the red-alert banner.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useLiquidationStore } from '../liquidationStore';

describe('store/liquidationStore', () => {
  beforeEach(() => {
    useLiquidationStore.getState().reset();
  });

  it('starts in panorama mode with default focus address and sliders', () => {
    const s = useLiquidationStore.getState();
    expect(s.liqMode).toBe('panorama');
    expect(s.focusAddress).toBe('0x1234...5678');
    expect(s.sliders.collateral).toBe(10);
    expect(s.sliders.debt).toBe(5000);
    expect(s.sliders.price).toBe(2400);
    expect(s.sliders.bonus).toBe(5);
    expect(s.sliders.ltv).toBe(0.8);
    expect(s.redAlert).toBeNull();
  });

  it('setLiqMode switches the mode', () => {
    useLiquidationStore.getState().setLiqMode('focus');
    expect(useLiquidationStore.getState().liqMode).toBe('focus');
  });

  it('setFocusAddress updates the address', () => {
    useLiquidationStore.getState().setFocusAddress('0xNew...1234');
    expect(useLiquidationStore.getState().focusAddress).toBe('0xNew...1234');
  });

  it('setSlider updates a single slider without touching the others', () => {
    useLiquidationStore.getState().setSlider('price', 1800);
    const s = useLiquidationStore.getState();
    expect(s.sliders.price).toBe(1800);
    expect(s.sliders.collateral).toBe(10);
    expect(s.sliders.debt).toBe(5000);
    expect(s.sliders.bonus).toBe(5);
    expect(s.sliders.ltv).toBe(0.8);
  });

  it('setRedAlert activates an alert', () => {
    useLiquidationStore.getState().setRedAlert({
      active: true,
      title: '清算预警',
      desc: 'HF < 1.05',
    });
    const a = useLiquidationStore.getState().redAlert;
    expect(a).not.toBeNull();
    expect(a?.active).toBe(true);
    expect(a?.title).toBe('清算预警');
  });

  it('dismissRedAlert clears the alert', () => {
    useLiquidationStore.getState().setRedAlert({ active: true, title: 'X', desc: 'Y' });
    useLiquidationStore.getState().dismissRedAlert();
    expect(useLiquidationStore.getState().redAlert).toBeNull();
  });

  it('setHeatmaps replaces the heatmap data', () => {
    const cells = [
      { row: 0, col: 0, value: 0.1 },
      { row: 1, col: 1, value: 0.9 },
    ];
    useLiquidationStore.getState().setHeatmaps(cells);
    expect(useLiquidationStore.getState().heatmaps).toEqual(cells);
  });

  it('setPositions replaces the positions list', () => {
    const positions = [
      {
        id: 'p1',
        owner: '0x1',
        protocol: 'aave_v3',
        timestamp: 0,
        collateral: {},
        debt: {},
        liquidationThresholdE18: 0n,
      },
    ];
    useLiquidationStore.getState().setPositions(positions);
    expect(useLiquidationStore.getState().positions).toHaveLength(1);
  });
});
