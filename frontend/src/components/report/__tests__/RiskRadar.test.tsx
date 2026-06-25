/**
 * Tests for the RiskRadar component.
 *
 * RiskRadar renders the 5-axis risk radar plus 5 axis labels.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskRadar } from '../RiskRadar';

const AXES = [
  { label: '频率', value: 80, max: 100 },
  { label: '复杂度', value: 60, max: 100 },
  { label: '单笔利润', value: 90, max: 100 },
  { label: '防御难度', value: 75, max: 100 },
  { label: '检测难度', value: 50, max: 100 },
];

describe('RiskRadar', () => {
  it('renders the canvas', () => {
    const { container } = render(<RiskRadar axes={AXES} />);
    expect(container.querySelector('[data-testid="risk-radar-canvas"]')).not.toBeNull();
  });

  it('renders exactly 5 axis labels', () => {
    render(<RiskRadar axes={AXES} />);
    const labels = screen.getAllByTestId(/^risk-radar-label-\d+$/);
    expect(labels.length).toBe(5);
  });

  it('shows every axis label text', () => {
    render(<RiskRadar axes={AXES} />);
    for (const a of AXES) {
      const matches = screen.getAllByText((_, node) => {
        if (!node || !node.textContent) return false;
        return node.textContent.includes(a.label);
      });
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
