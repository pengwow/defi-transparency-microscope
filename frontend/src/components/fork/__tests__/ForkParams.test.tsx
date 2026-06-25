/**
 * Tests for ForkParams — the left-column param panel on the Fork tab.
 *
 * Renders 5 ParamSliders (block / pool depth / slippage / gas / attacker
 * capital) plus a WETH/USDC token-row pair and a "重放仿真" replay
 * button.  All state is held in the component (no Zustand).
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ForkParams } from '../ForkParams';

describe('ForkParams', () => {
  it('renders 5 sliders with their labels', () => {
    render(<ForkParams onReplay={() => undefined} />);
    expect(screen.getByText(/Fork 区块|区块/)).toBeInTheDocument();
    expect(screen.getByText(/池子深度/)).toBeInTheDocument();
    expect(screen.getByText(/滑点|滑点容忍/)).toBeInTheDocument();
    expect(screen.getByText(/Gas/)).toBeInTheDocument();
    expect(screen.getByText(/攻击者资本/)).toBeInTheDocument();
  });

  it('renders the WETH and USDC token symbols', () => {
    render(<ForkParams onReplay={() => undefined} />);
    expect(screen.getByText('WETH')).toBeInTheDocument();
    expect(screen.getByText('USDC')).toBeInTheDocument();
  });

  it('renders the replay button with the expected label', () => {
    render(<ForkParams onReplay={() => undefined} />);
    expect(screen.getByRole('button', { name: /重放仿真/ })).toBeInTheDocument();
  });

  it('invokes onReplay when the replay button is clicked', () => {
    const cb = vi.fn();
    render(<ForkParams onReplay={cb} />);
    fireEvent.click(screen.getByRole('button', { name: /重放仿真/ }));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('renders 5 range inputs', () => {
    render(<ForkParams onReplay={() => undefined} />);
    const inputs = document.querySelectorAll('input[type="range"]');
    expect(inputs).toHaveLength(5);
  });
});
