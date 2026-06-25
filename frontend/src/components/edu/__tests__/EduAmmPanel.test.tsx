/**
 * Tests for EduAmmPanel — hosts the EduAmm canvas with a
 * "演示 AMM 路径" label and live reserves / slippage readouts
 * derived from the eduStore.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EduAmmPanel } from '../EduAmmPanel';
import { useEduStore } from '@/store/eduStore';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

describe('EduAmmPanel', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('renders the panel root and the AMM canvas', () => {
    render(<EduAmmPanel />);
    expect(screen.getByTestId('edu-amm-panel')).toBeInTheDocument();
    expect(screen.getByTestId('edu-amm-canvas')).toBeInTheDocument();
  });

  it('shows the AMM path label', () => {
    render(<EduAmmPanel />);
    expect(screen.getByText(/演示 AMM 路径/)).toBeInTheDocument();
  });

  it('shows a reserves readout (reserve0 / reserve1 derived from liquidity)', () => {
    render(<EduAmmPanel />);
    const reserves = screen.getByTestId('edu-amm-reserves');
    expect(reserves.textContent).toMatch(/reserve|储备|深度|liquidity/i);
  });

  it('shows a slippage readout derived from the sliders', () => {
    render(<EduAmmPanel />);
    const slippage = screen.getByTestId('edu-amm-slippage');
    expect(slippage.textContent).toMatch(/%|滑点/);
  });
});
