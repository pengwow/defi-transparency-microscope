/**
 * Tests for the SandwichFeed component.
 *
 * Verifies that the feed renders rows for each mempool entry, that
 * rows are clickable to select a transaction, and that the active
 * row carries a `data-active` attribute.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { SandwichFeed } from './SandwichFeed';
import type { MempoolEntry } from '@/store/liveStore';
import type { MockTransaction } from '@/mocks/transactions';

afterEach(() => {
  cleanup();
});

function makeEntry(over: Partial<MempoolEntry> = {}): MempoolEntry {
  return {
    hash: '0xabc',
    from: '0xfrom',
    timestamp: 1_700_000_000,
    mevType: 'sandwich',
    ...over,
  };
}

function makeTx(over: Partial<MockTransaction> = {}): MockTransaction {
  return {
    hash: '0xabc',
    blockNumber: 1,
    timestamp: 1_700_000_000,
    from: '0xfrom',
    to: '0xto',
    gasUsed: 100_000n,
    gasPrice: 30n * 10n ** 9n,
    type: 'swap',
    mevType: 'sandwich',
    ...over,
  };
}

describe('SandwichFeed', () => {
  it('renders a row per mempool entry', () => {
    const entries = [
      makeEntry({ hash: '0xa', mevType: 'sandwich' }),
      makeEntry({ hash: '0xb', mevType: 'normal' }),
      makeEntry({ hash: '0xc', mevType: 'arb' }),
    ];
    const txs = new Map<string, MockTransaction>([
      ['0xa', makeTx({ hash: '0xa' })],
      ['0xb', makeTx({ hash: '0xb' })],
      ['0xc', makeTx({ hash: '0xc' })],
    ]);
    render(
      <SandwichFeed
        entries={entries}
        txs={txs}
        selectedHash={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });

  it('shows the mevType label for each row', () => {
    const entries = [
      makeEntry({ hash: '0xa', mevType: 'sandwich' }),
      makeEntry({ hash: '0xb', mevType: 'normal' }),
    ];
    const txs = new Map<string, MockTransaction>();
    render(
      <SandwichFeed
        entries={entries}
        txs={txs}
        selectedHash={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('SANDWICH')).toBeInTheDocument();
    expect(screen.getByText('NORMAL')).toBeInTheDocument();
  });

  it('invokes onSelect when a row is clicked', () => {
    const cb = vi.fn();
    const entries = [makeEntry({ hash: '0xa' })];
    const txs = new Map<string, MockTransaction>([['0xa', makeTx({ hash: '0xa' })]]);
    render(
      <SandwichFeed
        entries={entries}
        txs={txs}
        selectedHash={null}
        onSelect={cb}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(cb).toHaveBeenCalledWith('0xa');
  });

  it('marks the selected row with a data-active attribute', () => {
    const entries = [makeEntry({ hash: '0xa' }), makeEntry({ hash: '0xb' })];
    const txs = new Map<string, MockTransaction>();
    render(
      <SandwichFeed
        entries={entries}
        txs={txs}
        selectedHash="0xb"
        onSelect={() => undefined}
      />,
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0].getAttribute('data-active')).toBe('false');
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('renders an empty state when there are no entries', () => {
    render(
      <SandwichFeed
        entries={[]}
        txs={new Map()}
        selectedHash={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/no transactions/i)).toBeInTheDocument();
  });
});
