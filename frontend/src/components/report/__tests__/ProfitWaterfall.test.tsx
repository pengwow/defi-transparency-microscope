/**
 * Tests for the ProfitWaterfall component.
 *
 * ProfitWaterfall renders the 6-step profit waterfall plus 6
 * step labels underneath.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfitWaterfall } from '../ProfitWaterfall';

const STEPS = [
  { label: '攻击者利润', delta: 1240, type: 'gain' as const },
  { label: '受害者损失', delta: -456, type: 'loss' as const },
  { label: 'LP 损失', delta: -89, type: 'loss' as const },
  { label: '协议费', delta: -12, type: 'loss' as const },
  { label: '验证者小费', delta: -45, type: 'loss' as const },
  { label: '净效果', delta: 638, type: 'total' as const },
];

describe('ProfitWaterfall', () => {
  it('renders the canvas', () => {
    const { container } = render(<ProfitWaterfall steps={STEPS} />);
    expect(container.querySelector('[data-testid="profit-waterfall-canvas"]')).not.toBeNull();
  });

  it('renders exactly 6 step labels', () => {
    render(<ProfitWaterfall steps={STEPS} />);
    const labels = screen.getAllByTestId(/^profit-waterfall-label-\d+$/);
    expect(labels.length).toBe(6);
  });

  it('shows every step label text', () => {
    render(<ProfitWaterfall steps={STEPS} />);
    for (const s of STEPS) {
      const matches = screen.getAllByText((_, node) => {
        if (!node || !node.textContent) return false;
        return node.textContent.includes(s.label);
      });
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
