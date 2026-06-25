/**
 * Tests for HfGaugePanel — HF semi-arc gauge + status + value.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { HfGaugePanel } from '../HfGaugePanel';

describe('HfGaugePanel', () => {
  it('renders the panel', () => {
    render(<HfGaugePanel />);
    expect(screen.getByTestId('liquidation-hf-gauge-panel')).toBeInTheDocument();
  });

  it('renders the HF gauge canvas', () => {
    render(<HfGaugePanel />);
    expect(screen.getByTestId('hf-gauge-panel-canvas')).toBeInTheDocument();
  });

  it('renders a status (safe/warning/danger/liquidated)', () => {
    render(<HfGaugePanel />);
    expect(screen.getByTestId('hf-gauge-panel-level')).toBeInTheDocument();
  });

  it('renders a numeric HF value', () => {
    render(<HfGaugePanel />);
    expect(screen.getByTestId('hf-gauge-panel-value')).toBeInTheDocument();
  });
});
