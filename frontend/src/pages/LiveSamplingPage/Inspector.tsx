/**
 * Inspector — display the details of a single transaction.
 *
 * Shows the tx hash, block, timestamp, gas usage, swap summary, and
 * — when the tx is part of a sandwich — the bundle's frontrun /
 * victim / backrun breakdown.
 */

import type { MockTransaction } from '@/mocks/transactions';
import { formatTxHash, formatAddress } from '@/utils/format';
import { formatTime, formatDate } from '@/utils/time';
import './Inspector.css';

export interface InspectorProps {
  tx: MockTransaction | null;
}

function formatAmount(raw: bigint, decimals: number): string {
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const frac = raw % scale;
  if (frac === 0n) return whole.toString();
  return `${whole.toString()}.${frac.toString().padStart(decimals, '0').slice(0, 4)}`;
}

export function Inspector({ tx }: InspectorProps) {
  if (!tx) {
    return (
      <div className="dtm-inspector-empty" data-testid="inspector-empty">
        <p>No transaction selected. Click a row in the feed to inspect it.</p>
      </div>
    );
  }

  return (
    <div className="dtm-inspector" data-testid="inspector-content">
      <dl className="dtm-inspector-grid">
        <dt>Hash</dt>
        <dd className="mono">{formatTxHash(tx.hash)}</dd>

        <dt>Block</dt>
        <dd className="mono">{tx.blockNumber.toLocaleString()}</dd>

        <dt>Time</dt>
        <dd className="mono">
          {formatDate(tx.timestamp)} {formatTime(tx.timestamp)}
        </dd>

        <dt>From / To</dt>
        <dd className="mono">
          {formatAddress(tx.from)} → {formatAddress(tx.to)}
        </dd>

        <dt>Type</dt>
        <dd>
          <span className="dtm-inspector-type">{tx.type}</span>
          <span className="dtm-inspector-mev">{tx.mevType}</span>
        </dd>

        <dt>Gas</dt>
        <dd className="mono">
          {tx.gasUsed.toLocaleString()} @ {tx.gasPrice.toString()} wei
        </dd>
      </dl>

      {tx.swaps && tx.swaps.length > 0 && (
        <section className="dtm-inspector-section">
          <h4>Swaps</h4>
          <ul className="dtm-inspector-swaps">
            {tx.swaps.map((hop, i) => (
              <li key={i} className="dtm-inspector-swap">
                <div>
                  <span className="muted">amount in</span>
                  <span className="mono">{formatAmount(hop.amountIn, 18)}</span>
                </div>
                <div>
                  <span className="muted">amount out</span>
                  <span className="mono">{formatAmount(hop.amountOut, 18)}</span>
                </div>
                <div>
                  <span className="muted">protocol</span>
                  <span className="mono">{hop.protocol}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tx.bundle && tx.bundle.length > 0 && (
        <section className="dtm-inspector-section">
          <h4>Sandwich bundle</h4>
          <ol className="dtm-inspector-bundle">
            {tx.bundle.map((b, i) => {
              const role = i === 0 ? 'frontrun' : i === 1 ? 'victim' : 'backrun';
              return (
                <li key={b.hash} className={`dtm-inspector-bundle-item dtm-bundle-${role}`}>
                  <span className="dtm-inspector-bundle-role">{role}</span>
                  <span className="mono">{b.hash}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

export default Inspector;
