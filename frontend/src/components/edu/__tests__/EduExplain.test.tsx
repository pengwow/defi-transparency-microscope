/**
 * Tests for EduExplain — an ExplainBox that swaps its text and
 * formula based on the active scenario, plus a code block with
 * the closed-form formula.
 *
 * Verifies that all 5 scenarios produce a distinct headline and
 * that switching the store updates the rendered text.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { EduExplain } from '../EduExplain';
import { useEduStore } from '@/store/eduStore';

describe('EduExplain', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<EduExplain />);
    expect(screen.getByTestId('edu-explain-panel')).toBeInTheDocument();
  });

  it('shows the sandwich explain by default', () => {
    render(<EduExplain />);
    expect(screen.getByTestId('edu-explain-headline').textContent).toMatch(
      /三明治/,
    );
  });

  it('renders a formula block', () => {
    render(<EduExplain />);
    const formula = screen.getByTestId('edu-explain-formula');
    expect(formula.textContent).toBeTruthy();
  });

  it('renders distinct headlines for all 5 scenarios', () => {
    const scenarios = [
      { id: 'sandwich', keyword: /三明治/ },
      { id: 'jit', keyword: /JIT/ },
      { id: 'arbitrage', keyword: /套利/ },
      { id: 'liquidation', keyword: /清算/ },
      { id: 'front-running', keyword: /前跑|抢跑/ },
    ] as const;

    for (const s of scenarios) {
      useEduStore.getState().reset();
      act(() => {
        useEduStore.getState().setActiveScenario(s.id);
      });
      const { unmount } = render(<EduExplain />);
      expect(screen.getByTestId('edu-explain-headline').textContent).toMatch(
        s.keyword,
      );
      unmount();
    }
  });
});
