/**
 * SandwichFeed — clickable list of mempool entries.
 *
 * Each row shows the entry's timestamp, MEV type, amount (looked up
 * from the matching full transaction by hash), and a coloured badge.
 * Clicking a row invokes `onSelect` with the entry's hash so the
 * parent can wire the inspector.
 */

import type { MempoolEntry } from '@/store/liveStore';
import type { MockTransaction } from '@/mocks/transactions';
import { formatTxHash } from '@/utils/format';
import { formatTime } from '@/utils/time';
import './SandwichFeed.css';

export interface SandwichFeedProps {
  entries: ReadonlyArray<MempoolEntry>;
  /** Lookup of hash → full transaction (for amount display). */
  txs: ReadonlyMap<string, MockTransaction>;
  selectedHash: string | null;
  onSelect: (hash: string) => void;
}

const BADGE_LABEL: Record<MempoolEntry['mevType'], string> = {
  sandwich: 'SANDWICH',
  arb: 'ARB',
  jit: 'JIT',
  liquidation: 'LIQ',
  normal: 'NORMAL',
};

function amountFor(entry: MempoolEntry, txs: ReadonlyMap<string, MockTransaction>): string {
  const tx = txs.get(entry.hash);
  if (!tx || !tx.swaps || tx.swaps.length === 0) return '—';
  const total = tx.swaps.reduce((acc, h) => acc + h.amountIn, 0n);
  // Show as a fixed-point value divided by 1e18 to make it readable.
  const asNumber = Number(total / 10n ** 18n);
  if (!Number.isFinite(asNumber)) return '—';
  return asNumber.toFixed(2);
}

export function SandwichFeed({ entries, txs, selectedHash, onSelect }: SandwichFeedProps) {
  if (entries.length === 0) {
    return <p className="dtm-sandwich-feed-empty">No transactions in mempool.</p>;
  }
  return (
    <ul className="dtm-sandwich-feed" data-testid="sandwich-feed-list">
      {entries.map((e) => {
        const active = e.hash === selectedHash;
        return (
          <li key={e.hash} className="dtm-sandwich-feed-item">
            <button
              type="button"
              className="dtm-sandwich-feed-row"
              data-active={active ? 'true' : 'false'}
              data-mevtype={e.mevType}
              onClick={() => onSelect(e.hash)}
              aria-pressed={active}
            >
              <span className="dtm-sandwich-feed-time mono">{formatTime(e.timestamp)}</span>
              <span className="dtm-sandwich-feed-hash mono">{formatTxHash(e.hash, 8, 4)}</span>
              <span className="dtm-sandwich-feed-amount mono">{amountFor(e, txs)}</span>
              <span className={`dtm-sandwich-feed-badge dtm-mev-${e.mevType}`}>
                {BADGE_LABEL[e.mevType]}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default SandwichFeed;
