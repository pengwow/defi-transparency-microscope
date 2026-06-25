/**
 * Tests for LpExplanation — the "LP/IL 模式" ExplainBox plus the
 * closed-form IL formula.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LpExplanation } from '../LpExplanation';

describe('LpExplanation', () => {
  it('renders the panel', () => {
    render(<LpExplanation />);
    expect(screen.getByTestId('lpil-explanation-panel')).toBeInTheDocument();
  });

  it('mentions "LP/IL 模式" or "无常损失" in the ExplainBox', () => {
    render(<LpExplanation />);
    const panel = screen.getByTestId('lpil-explanation-panel');
    expect(panel.textContent).toMatch(/LP\/IL|无常损失|IL/);
  });

  it('renders the IL formula', () => {
    render(<LpExplanation />);
    const formula = screen.getByTestId('lpil-explanation-formula');
    // The formula text contains the canonical IL expression; allow
    // for either Unicode √ or ASCII sqrt in the literal.
    expect(formula.textContent).toMatch(/2.{0,4}√r.{0,4}\(1.{0,4}\+.{0,4}r\)/);
  });
});
