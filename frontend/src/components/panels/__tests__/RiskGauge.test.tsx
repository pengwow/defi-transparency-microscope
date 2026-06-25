/**
 * Tests for RiskGauge — circular ring + central value with
 * level-tinted stroke.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RiskGauge } from '../RiskGauge';

describe('RiskGauge', () => {
  it('renders the value and label', () => {
    render(<RiskGauge value={73} label="Health" testId="gauge" />);
    expect(screen.getByText('73')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByTestId('gauge')).toBeInTheDocument();
  });

  it('applies the level-low class for level="low"', () => {
    render(<RiskGauge value={10} level="low" testId="gauge-low" />);
    expect(screen.getByTestId('gauge-low').className).toContain('is-low');
  });

  it('applies the level-high class for level="high"', () => {
    render(<RiskGauge value={90} level="high" testId="gauge-high" />);
    expect(screen.getByTestId('gauge-high').className).toContain('is-high');
  });
});
