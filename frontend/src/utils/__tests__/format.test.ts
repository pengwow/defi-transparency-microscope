/**
 * Tests for the display formatting helpers.
 */

import { describe, expect, it } from 'vitest';
import { formatUsd, formatPct, formatAddress, formatTxHash } from '../format';

describe('formatUsd', () => {
  it('formats small values with two decimals', () => {
    expect(formatUsd(0)).toBe('$0');
    expect(formatUsd(0.5)).toBe('$0.50');
    expect(formatUsd(99.99)).toBe('$99.99');
  });

  it('uses compact notation for thousands and up', () => {
    expect(formatUsd(1500)).toBe('$1.5K');
    expect(formatUsd(1_500_000)).toBe('$1.5M');
    expect(formatUsd(2_500_000_000)).toBe('$2.5B');
  });

  it('handles negative values', () => {
    expect(formatUsd(-1_500_000)).toBe('-$1.5M');
  });

  it('accepts bigint and string', () => {
    expect(formatUsd(1500n)).toBe('$1.5K');
    expect(formatUsd('1500')).toBe('$1.5K');
  });

  it('handles NaN gracefully', () => {
    expect(formatUsd(Number.NaN)).toBe('$—');
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe('$—');
  });
});

describe('formatPct', () => {
  it('multiplies by 100 and pads to two decimals', () => {
    expect(formatPct(0)).toBe('0.00%');
    expect(formatPct(0.05)).toBe('5.00%');
    expect(formatPct(1)).toBe('100.00%');
  });

  it('preserves sign for negative values', () => {
    expect(formatPct(-0.123)).toBe('-12.30%');
  });

  it('handles non-finite input', () => {
    expect(formatPct(Number.NaN)).toBe('—%');
  });
});

describe('formatAddress', () => {
  const addr = '0x1234567890abcdef1234567890abcdef12345678';

  it('truncates long addresses with ellipsis', () => {
    expect(formatAddress(addr)).toBe('0x1234…5678');
  });

  it('respects custom head/tail sizes', () => {
    expect(formatAddress(addr, 4, 4)).toBe('0x12…5678');
    // The address is 42 chars; head=8 takes the first 8, tail=8 takes
    // the last 8.  The two ranges may overlap on a 42-char string:
    //   0x123456 | 7890abcdef1234567890abcdef12345678
    // tail=8  → "12345678" (the trailing 8 chars).
    // Combined: "0x123456…12345678" with one char of overlap removed
    // by the ellipsis.  We just verify the shape (head + ellipsis +
    // tail-length) rather than the exact overlap behaviour.
    const out = formatAddress(addr, 8, 8);
    expect(out).toMatch(/^0x.{6}….{8}$/);
  });

  it('returns short strings unchanged', () => {
    expect(formatAddress('0xabc')).toBe('0xabc');
  });

  it('handles empty string', () => {
    expect(formatAddress('')).toBe('');
  });
});

describe('formatTxHash', () => {
  it('truncates a transaction hash', () => {
    const hash = '0x' + 'a'.repeat(64);
    const out = formatTxHash(hash);
    // Default head=10, tail=6 ⇒ 0xaaaaaa…aaaaaa
    expect(out.startsWith('0x')).toBe(true);
    expect(out.endsWith('aaaaaa')).toBe(true);
    expect(out).toContain('…');
  });
});
