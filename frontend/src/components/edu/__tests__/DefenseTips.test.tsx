/**
 * Tests for DefenseTips — a 3+ tip list of mitigations for the
 * active scenario.  Each tip is rendered as a row with an icon +
 * short text.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DefenseTips } from '../DefenseTips';
import { useEduStore } from '@/store/eduStore';

describe('DefenseTips', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<DefenseTips />);
    expect(screen.getByTestId('edu-defense-tips-panel')).toBeInTheDocument();
  });

  it('renders at least 3 tips for sandwich (default scenario)', () => {
    render(<DefenseTips />);
    const tips = screen.getAllByTestId(/^edu-defense-tip-/);
    expect(tips.length).toBeGreaterThanOrEqual(3);
  });

  it('renders a different tip count for each scenario (≥3 across the board)', () => {
    const scenarios = [
      'sandwich',
      'jit',
      'arbitrage',
      'liquidation',
      'front-running',
    ] as const;
    for (const s of scenarios) {
      useEduStore.getState().reset();
      act(() => {
        useEduStore.getState().setActiveScenario(s);
      });
      const { unmount } = render(<DefenseTips />);
      const tips = screen.getAllByTestId(/^edu-defense-tip-/);
      expect(tips.length).toBeGreaterThanOrEqual(3);
      unmount();
    }
  });

  it('each tip row contains an icon and text', () => {
    render(<DefenseTips />);
    const tips = screen.getAllByTestId(/^edu-defense-tip-/);
    for (const t of tips) {
      expect(t.textContent).toBeTruthy();
      // The icon lives in a <span> with a specific class.
      const icon = t.querySelector('.dtm-defense-tip-icon');
      expect(icon).toBeTruthy();
    }
  });
});
