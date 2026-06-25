/**
 * Tests for the AttackerAttribution component.
 *
 * AttackerAttribution renders 5 rows of attacker breakdown:
 *   address | share | profit | protocol | timestamp
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AttackerAttribution, type AttackerRow } from '../AttackerAttribution';

const ROWS: AttackerRow[] = [
  { address: '0x7a25a3f2b8c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7', share: 42, profit: 1240.5, protocol: 'Uniswap V3', timestamp: 1_716_000_000 },
  { address: '0x1234567890abcdef1234567890abcdef12345678', share: 28, profit: 824.2, protocol: 'SushiSwap', timestamp: 1_716_005_000 },
  { address: '0xabcdef1234567890abcdef1234567890abcdef12', share: 18, profit: 530.0, protocol: 'Curve', timestamp: 1_716_010_000 },
  { address: '0x9876543210fedcba9876543210fedcba98765432', share: 7, profit: 207.8, protocol: 'Balancer', timestamp: 1_716_015_000 },
  { address: '0xdeadbeefcafebabe0123456789abcdef01234567', share: 5, profit: 148.4, protocol: 'PancakeSwap', timestamp: 1_716_020_000 },
];

describe('AttackerAttribution', () => {
  it('renders the panel root', () => {
    render(<AttackerAttribution rows={ROWS} />);
    expect(screen.getByTestId('attacker-attribution-panel')).toBeInTheDocument();
  });

  it('renders exactly 5 rows', () => {
    render(<AttackerAttribution rows={ROWS} />);
    const items = screen.getAllByTestId(/^attacker-attribution-row-\d+$/);
    expect(items.length).toBe(5);
  });

  it('shows each address (short form)', () => {
    render(<AttackerAttribution rows={ROWS} />);
    for (const r of ROWS) {
      // Short form: 0x + 4 chars + … + 4 chars
      const head = r.address.slice(0, 6);
      const tail = r.address.slice(-4);
      const short = `${head}…${tail}`;
      const matches = screen.getAllByText((_, node) => {
        if (!node || !node.textContent) return false;
        return node.textContent.includes(short);
      });
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
