/**
 * Tests for the PositionList component (LP/IL page).
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PositionList } from './PositionList';
import type { LpPositionRow } from './PositionList';

afterEach(() => {
  cleanup();
});

function makeRow(over: Partial<LpPositionRow> = {}): LpPositionRow {
  return {
    id: 'lp-0',
    apr: 0.1234,
    value: 12345,
    protocol: 'uniswap_v2',
    ...over,
  };
}

describe('PositionList', () => {
  it('renders a row per LP position', () => {
    const rows = [makeRow({ id: 'lp-0' }), makeRow({ id: 'lp-1' })];
    render(<PositionList rows={rows} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the position id', () => {
    render(
      <PositionList rows={[makeRow({ id: 'lp-7' })]} selectedId={null} onSelect={() => undefined} />,
    );
    expect(screen.getByText('lp-7')).toBeInTheDocument();
  });

  it('shows the APR formatted as a percentage', () => {
    render(
      <PositionList rows={[makeRow({ apr: 0.1234 })]} selectedId={null} onSelect={() => undefined} />,
    );
    expect(screen.getByText(/12\.34%/)).toBeInTheDocument();
  });

  it('shows the value formatted as a USD amount', () => {
    render(
      <PositionList
        rows={[makeRow({ value: 12345 })]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/\$12\.35K/)).toBeInTheDocument();
  });

  it('invokes onSelect with the id of the clicked row', () => {
    const cb = vi.fn();
    const rows = [makeRow({ id: 'lp-0' }), makeRow({ id: 'lp-1' })];
    render(<PositionList rows={rows} selectedId={null} onSelect={cb} />);
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(cb).toHaveBeenCalledWith('lp-1');
  });

  it('marks the selected row with data-active="true"', () => {
    const rows = [makeRow({ id: 'lp-0' }), makeRow({ id: 'lp-1' })];
    render(<PositionList rows={rows} selectedId="lp-1" onSelect={() => undefined} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].getAttribute('data-active')).toBe('false');
    expect(buttons[1].getAttribute('data-active')).toBe('true');
  });

  it('shows the protocol name in the row', () => {
    render(
      <PositionList
        rows={[makeRow({ protocol: 'uniswap_v3' })]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/uniswap_v3/)).toBeInTheDocument();
  });

  it('renders an empty state when there are no positions', () => {
    render(<PositionList rows={[]} selectedId={null} onSelect={() => undefined} />);
    expect(screen.getByText(/no\s+lp\s+positions/i)).toBeInTheDocument();
  });
});
