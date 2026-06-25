/**
 * Tests for the Inspector component.
 *
 * Verifies the inspector displays transaction details, swap
 * information, and the sandwich bundle breakdown when present.
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Inspector } from './Inspector';
import type { MockTransaction } from '@/mocks/transactions';

afterEach(() => {
  cleanup();
});

function makeTx(over: Partial<MockTransaction> = {}): MockTransaction {
  return {
    hash: '0xabcdef',
    blockNumber: 18_000_000,
    timestamp: 1_700_000_000,
    from: '0xfrom',
    to: '0xto',
    gasUsed: 200_000n,
    gasPrice: 50n * 10n ** 9n,
    type: 'swap',
    swaps: [
      {
        pool: '0xpool',
        tokenIn: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        tokenOut: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amountIn: 10n ** 18n,
        amountOut: 3_000n * 10n ** 6n,
        protocol: 'uniswap_v2',
      },
    ],
    mevType: 'sandwich',
    ...over,
  };
}

describe('Inspector', () => {
  it('renders an empty state when no tx is selected', () => {
    render(<Inspector tx={null} />);
    expect(screen.getByText(/no transaction selected/i)).toBeInTheDocument();
  });

  it('shows the transaction hash', () => {
    render(<Inspector tx={makeTx()} />);
    expect(screen.getByText(/0xabcdef/)).toBeInTheDocument();
  });

  it('shows the block number and type', () => {
    render(<Inspector tx={makeTx()} />);
    expect(screen.getByText(/18,000,000/)).toBeInTheDocument();
    expect(screen.getByText('swap')).toBeInTheDocument();
  });

  it('shows swap amounts when present', () => {
    render(<Inspector tx={makeTx()} />);
    expect(screen.getByText(/amount in/i)).toBeInTheDocument();
    expect(screen.getByText(/amount out/i)).toBeInTheDocument();
  });

  it('shows sandwich bundle breakdown when present', () => {
    const frontrun = makeTx({ hash: '0xfront', mevType: 'sandwich' });
    const victim = makeTx({ hash: '0xvictim', mevType: 'sandwich' });
    const backrun = makeTx({ hash: '0xback', mevType: 'sandwich' });
    const tx = makeTx({ bundle: [frontrun, victim, backrun] });
    render(<Inspector tx={tx} />);
    expect(screen.getByText(/frontrun/i)).toBeInTheDocument();
    expect(screen.getByText(/backrun/i)).toBeInTheDocument();
    expect(screen.getByText(/0xfront/)).toBeInTheDocument();
    expect(screen.getByText(/0xback/)).toBeInTheDocument();
  });

  it('does not show a bundle section when the tx has none', () => {
    render(<Inspector tx={makeTx({ bundle: undefined })} />);
    expect(screen.queryByText(/frontrun/i)).toBeNull();
  });
});
