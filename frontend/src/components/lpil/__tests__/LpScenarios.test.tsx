/**
 * Tests for LpScenarios — 4 preset scenario cards that flip
 * `lpStore.priceRatio` to 2 / 0.5 / 1 / 5.
 *
 *   📈 ETH 涨 2x        → 2
 *   📉 ETH 跌 50%       → 0.5
 *   🔄 横盘 0.5-1.5     → 1
 *   💥 极端 5x          → 5
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LpScenarios } from '../LpScenarios';
import { useLpStore } from '@/store/lpStore';

describe('LpScenarios', () => {
  beforeEach(() => {
    useLpStore.getState().reset();
  });

  it('renders the panel root with 4 cards', () => {
    render(<LpScenarios />);
    expect(screen.getByTestId('lpil-scenarios-panel')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-scenario-up-2x')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-scenario-down-50')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-scenario-flat')).toBeInTheDocument();
    expect(screen.getByTestId('lpil-scenario-extreme-5x')).toBeInTheDocument();
  });

  it('clicking "ETH 涨 2x" sets priceRatio to 2', () => {
    render(<LpScenarios />);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-scenario-up-2x'));
    });
    expect(useLpStore.getState().priceRatio).toBe(2);
  });

  it('clicking "ETH 跌 50%" sets priceRatio to 0.5', () => {
    render(<LpScenarios />);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-scenario-down-50'));
    });
    expect(useLpStore.getState().priceRatio).toBe(0.5);
  });

  it('clicking "横盘 0.5-1.5" sets priceRatio to 1', () => {
    render(<LpScenarios />);
    useLpStore.getState().setPriceRatio(2);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-scenario-flat'));
    });
    expect(useLpStore.getState().priceRatio).toBe(1);
  });

  it('clicking "极端 5x" sets priceRatio to 5', () => {
    render(<LpScenarios />);
    act(() => {
      fireEvent.click(screen.getByTestId('lpil-scenario-extreme-5x'));
    });
    expect(useLpStore.getState().priceRatio).toBe(5);
  });
});
