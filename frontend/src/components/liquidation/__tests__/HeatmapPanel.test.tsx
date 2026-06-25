/**
 * Tests for HeatmapPanel — wraps the LiquidationHeatmap canvas with a
 * "风险热力图" title.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { HeatmapPanel } from '../HeatmapPanel';

describe('HeatmapPanel', () => {
  it('renders the heatmap canvas', () => {
    render(<HeatmapPanel />);
    expect(screen.getByTestId('liquidation-heatmap-panel')).toBeInTheDocument();
    expect(screen.getByTestId('heatmap-panel-canvas')).toBeInTheDocument();
  });

  it('renders the title', () => {
    render(<HeatmapPanel />);
    expect(screen.getByText(/风险热力图/)).toBeInTheDocument();
  });
});
