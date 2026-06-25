/**
 * Tests for PanoramaView — the left column of the Liquidation
 * panorama mode (heatmap + protocol stats).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { PanoramaView } from '../PanoramaView';

describe('PanoramaView', () => {
  it('renders the heatmap canvas', () => {
    render(<PanoramaView />);
    expect(screen.getByTestId('panorama-heatmap-canvas')).toBeInTheDocument();
  });

  it('renders the 3 protocol stat boxes', () => {
    render(<PanoramaView />);
    expect(screen.getByTestId('panorama-protocol-aave')).toBeInTheDocument();
    expect(screen.getByTestId('panorama-protocol-compound')).toBeInTheDocument();
    expect(screen.getByTestId('panorama-protocol-makerdao')).toBeInTheDocument();
  });

  it('renders the root panel with the correct testId', () => {
    render(<PanoramaView />);
    expect(screen.getByTestId('liquidation-panorama-panel')).toBeInTheDocument();
  });
});
