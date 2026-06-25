/**
 * Tests for ForkSankeyPanel — hosts the ForkSankey canvas plus 4
 * target labels and proportional value chips.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/canvas/useCanvas', () => ({
  useCanvas: (_drawFn: unknown, _deps: unknown) => ({ ref: { current: null } }),
}));

import { ForkSankeyPanel } from '../ForkSankeyPanel';

describe('ForkSankeyPanel', () => {
  it('renders the canvas element', () => {
    render(<ForkSankeyPanel />);
    expect(screen.getByTestId('fork-sankey-canvas')).toBeInTheDocument();
  });

  it('renders 4 target labels', () => {
    render(<ForkSankeyPanel />);
    expect(screen.getByText('策略方')).toBeInTheDocument();
    expect(screen.getByText('交易发起方')).toBeInTheDocument();
    expect(screen.getByText('LP 手续费')).toBeInTheDocument();
    expect(screen.getByText('Validator')).toBeInTheDocument();
  });

  it('renders the proportional $ values for each target', () => {
    render(<ForkSankeyPanel />);
    const panel = screen.getByTestId('fork-sankey-panel');
    expect(panel.textContent).toMatch(/\$1,?240/);
    expect(panel.textContent).toMatch(/\$456/);
    expect(panel.textContent).toMatch(/\$28/);
    expect(panel.textContent).toMatch(/\$185/);
  });
});
