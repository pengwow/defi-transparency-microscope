/**
 * Display formatting helpers.
 *
 * All formatters accept bigint | number | string (numeric) and return
 * a short, human-readable string suitable for direct rendering in
 * the UI.  Nothing here depends on the locale — we use the en-US
 * conventions because DeFi dashboards are typically English-first.
 */

const COMPACT = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

/**
 * Convert a bigint / number / string to a JS number for formatting.
 *
 * For huge bigints (e.g. 1e30 wei) this loses precision, so callers
 * that need exact precision should pre-scale and pass a number.
 */
function toNumber(value: bigint | number | string): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') {
    // Up to 1e15 — beyond that, fall through to Number() which loses
    // precision but at least stays finite.
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Format a USD-denominated value.
 *
 *   formatUsd(1234)        -> "$1.23K"
 *   formatUsd(0.5)         -> "$0.50"
 *   formatUsd(1_500_000)   -> "$1.50M"
 *   formatUsd(2.5e9)       -> "$2.50B"
 */
export function formatUsd(value: bigint | number | string): string {
  const n = toNumber(value);
  if (!Number.isFinite(n)) return '$—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs === 0) return '$0';
  if (abs < 1000) return `${sign}$${abs.toFixed(2)}`;
  return `${sign}$${COMPACT.format(abs)}`;
}

/**
 * Format a fractional value (0.05 = 5%) as a percentage string.
 *
 *   formatPct(0.05)    -> "5.00%"
 *   formatPct(-0.123)  -> "-12.30%"
 *   formatPct(0)       -> "0.00%"
 */
export function formatPct(value: number): string {
  if (!Number.isFinite(value)) return '—%';
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * Format a 0x address for display: `0x1234…abcd`.
 *
 * If the address is shorter than the head/tail slice, it is returned
 * unchanged.
 */
export function formatAddress(address: string, head = 6, tail = 4): string {
  if (!address) return '';
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

/**
 * Format a transaction hash for display: `0x12345678…`.
 *
 * The default head is 10 chars (0x + 8 hex), tail is 6.
 */
export function formatTxHash(hash: string, head = 10, tail = 6): string {
  return formatAddress(hash, head, tail);
}
