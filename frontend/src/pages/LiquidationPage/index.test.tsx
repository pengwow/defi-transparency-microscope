/**
 * Tests for the new dual-view LiquidationPage (panorama + focus).
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { LiquidationPage } from './index';
import { useLiquidationStore } from '@/store/liquidationStore';

beforeEach(() => {
  useLiquidationStore.getState().reset();
});

describe('LiquidationPage (dual views)', () => {
  it('renders both mode buttons', () => {
    render(<LiquidationPage />);
    expect(screen.getByTestId('liquidation-mode-panorama')).toBeInTheDocument();
    expect(screen.getByTestId('liquidation-mode-focus')).toBeInTheDocument();
  });

  it('renders the LiquidationExplanation panel mentioning "清算"', () => {
    render(<LiquidationPage />);
    const panel = screen.getByTestId('liquidation-explanation-panel');
    expect(panel.textContent).toMatch(/清算/);
  });

  it('shows the panorama panel by default', () => {
    render(<LiquidationPage />);
    expect(screen.getByTestId('liquidation-panorama-container')).toBeInTheDocument();
  });

  it('switches to the focus panel when the focus button is clicked', () => {
    render(<LiquidationPage />);
    fireEvent.click(screen.getByTestId('liquidation-mode-focus'));
    expect(screen.getByTestId('liquidation-focus-panel')).toBeInTheDocument();
    // AddressInput is rendered inside the focus view.
    expect(screen.getByTestId('liquidation-address-input')).toBeInTheDocument();
  });

  it('switches back to the panorama panel when the panorama button is clicked', () => {
    useLiquidationStore.getState().setLiqMode('focus');
    render(<LiquidationPage />);
    expect(screen.getByTestId('liquidation-focus-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('liquidation-mode-panorama'));
    expect(screen.getByTestId('liquidation-panorama-container')).toBeInTheDocument();
  });
});
