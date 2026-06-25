/**
 * Tests for StepControls — the 3-step pill toggle on the Fork tab.
 *
 * Renders three labeled steps ("1. 捕获", "2. 切片", "3. 解析"),
 * a description for the active step, and propagates clicks back via
 * onChange(i).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StepControls } from '../StepControls';

const DESC = '策略方在区块 N-1 买入 WETH，把价格推高到 P_front。';

describe('StepControls', () => {
  it('renders all 3 step buttons', () => {
    render(<StepControls active={0} onChange={() => undefined} description={DESC} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    expect(buttons[0].textContent).toMatch(/捕获/);
    expect(buttons[1].textContent).toMatch(/切片/);
    expect(buttons[2].textContent).toMatch(/解析/);
  });

  it('marks the active step with the is-active class', () => {
    render(<StepControls active={1} onChange={() => undefined} description={DESC} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[1].className).toContain('is-active');
    expect(buttons[0].className).not.toContain('is-active');
  });

  it('renders the description for the active step', () => {
    render(<StepControls active={0} onChange={() => undefined} description={DESC} />);
    expect(screen.getByText(DESC)).toBeInTheDocument();
  });

  it('invokes onChange with the clicked step index', () => {
    const cb = vi.fn();
    render(<StepControls active={0} onChange={cb} description={DESC} />);
    fireEvent.click(screen.getAllByRole('button')[2]);
    expect(cb).toHaveBeenCalledWith(2);
  });
});
