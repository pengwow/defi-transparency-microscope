/**
 * Tests for the PositionList component (Liquidation).
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PositionList } from './PositionList';
import type { LendingPosition } from '@/types';

afterEach(() => {
  cleanup();
});

function makePos(over: Partial<LendingPosition> = {}): LendingPosition {
  return {
    id: 'p1',
    owner: '0xowner',
    protocol: 'aave_v3',
    timestamp: 1_700_000_000,
    collateral: { '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 10n * 10n ** 18n },
    debt: { '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 5_000n * 10n ** 6n },
    liquidationThresholdE18: 80_000n * 10n ** 18n,
    ...over,
  };
}

describe('PositionList', () => {
  it('renders a row per position', () => {
    const positions = [makePos({ id: 'p1' }), makePos({ id: 'p2' })];
    render(
      <PositionList
        positions={positions}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the position id as a heading', () => {
    render(
      <PositionList
        positions={[makePos({ id: 'p1' })]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('p1')).toBeInTheDocument();
  });

  it('invokes onSelect with the id of the clicked row', () => {
    const cb = vi.fn();
    const positions = [makePos({ id: 'p1' }), makePos({ id: 'p2' })];
    render(
      <PositionList
        positions={positions}
        selectedId={null}
        onSelect={cb}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(cb).toHaveBeenCalledWith('p2');
  });

  it('marks the selected row with data-active="true"', () => {
    const positions = [makePos({ id: 'p1' }), makePos({ id: 'p2' })];
    render(
      <PositionList
        positions={positions}
        selectedId="p2"
        onSelect={() => undefined}
      />,
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0].getAttribute('data-active')).toBe('false');
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('renders the HF for each position', () => {
    render(
      <PositionList
        positions={[makePos()]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/HF/)).toBeInTheDocument();
  });

  it('renders an empty state when there are no positions', () => {
    render(
      <PositionList
        positions={[]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/no\s+.*\s+positions/i)).toBeInTheDocument();
  });
});
