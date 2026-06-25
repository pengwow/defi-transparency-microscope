/**
 * Tests for the RiskAssessment component.
 *
 * RiskAssessment renders one of 4 risk levels (low / medium / high
 * / critical), a short description, and an advice line.  The
 * rendered colour and text are derived from the level prop.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskAssessment, type RiskLevel } from '../RiskAssessment';

const LEVELS: ReadonlyArray<RiskLevel> = ['low', 'medium', 'high', 'critical'];

describe('RiskAssessment', () => {
  it('renders the panel root for every level', () => {
    for (const level of LEVELS) {
      const { unmount } = render(
        <RiskAssessment level={level} score={50} frequency={3} poolTvl="中等" mempool="低" />,
      );
      expect(screen.getByTestId('risk-assessment-panel')).toBeInTheDocument();
      unmount();
    }
  });

  it('shows the level name as a data attribute', () => {
    const { rerender } = render(
      <RiskAssessment level="low" score={20} frequency={0} poolTvl="高" mempool="低" />,
    );
    expect(screen.getByTestId('risk-assessment-level').getAttribute('data-level')).toBe('low');
    rerender(
      <RiskAssessment level="critical" score={90} frequency={23} poolTvl="中等" mempool="高" />,
    );
    expect(screen.getByTestId('risk-assessment-level').getAttribute('data-level')).toBe('critical');
  });

  it('renders the level-specific text for every level', () => {
    const EXPECTED: Record<RiskLevel, RegExp> = {
      low: /低风险/,
      medium: /中等风险/,
      high: /高风险/,
      critical: /极高风险/,
    };
    for (const level of LEVELS) {
      const { unmount } = render(
        <RiskAssessment level={level} score={50} frequency={3} poolTvl="中等" mempool="低" />,
      );
      expect(screen.getByTestId('risk-assessment-level').textContent).toMatch(EXPECTED[level]);
      unmount();
    }
  });

  it('renders an advice line', () => {
    render(
      <RiskAssessment level="high" score={75} frequency={10} poolTvl="低" mempool="中" />,
    );
    const advice = screen.getByTestId('risk-assessment-advice');
    expect(advice.textContent).toBeTruthy();
  });
});
