/**
 * Tests for the StrategyPie component.
 *
 * StrategyPie renders the 5-segment strategy-attribution pie chart
 * with a legend of 5 entries.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StrategyPie } from '../StrategyPie';

const SLICES = [
  { label: '三明治', value: 42, color: '#ff5e5e' },
  { label: '套利', value: 28, color: '#ffab40' },
  { label: 'JIT', value: 18, color: '#b388ff' },
  { label: '清算', value: 12, color: '#448aff' },
  { label: '前跑', value: 5, color: '#69f0ae' },
];

describe('StrategyPie', () => {
  it('renders the panel root', () => {
    const { container } = render(<StrategyPie slices={SLICES} />);
    expect(container.querySelector('[data-testid="strategy-pie-canvas"]')).not.toBeNull();
  });

  it('renders exactly 5 legend items', () => {
    render(<StrategyPie slices={SLICES} />);
    const items = screen.getAllByTestId(/^strategy-pie-legend-\d+$/);
    expect(items.length).toBe(5);
  });

  it('shows each slice label in the legend', () => {
    render(<StrategyPie slices={SLICES} />);
    for (const s of SLICES) {
      expect(screen.getByText(s.label)).toBeInTheDocument();
    }
  });
});
