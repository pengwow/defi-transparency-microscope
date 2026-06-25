/**
 * AttackerAttribution — table of attacker breakdown rows for the
 * Report tab.
 *
 * Each row shows:
 *   - the attacker's address (short form)
 *   - the share of total profit they captured (%)
 *   - the profit they earned (USD)
 *   - the protocol they targeted
 *   - the timestamp of the attack
 *
 * The component is intentionally layout-only: the caller passes
 * the data and a render-only table is produced.
 */

import { formatAddress } from '@/utils/format';

export interface AttackerRow {
  address: string;
  /** Percentage of total profit captured (0-100). */
  share: number;
  /** Profit in USD. */
  profit: number;
  protocol: string;
  /** Unix epoch seconds. */
  timestamp: number;
}

export interface AttackerAttributionProps {
  rows: ReadonlyArray<AttackerRow>;
  testId?: string;
}

function formatTimestamp(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '—';
  const d = new Date(ts * 1000);
  const iso = d.toISOString();
  return iso.slice(0, 16).replace('T', ' ');
}

export function AttackerAttribution({
  rows,
  testId = 'attacker-attribution-panel',
}: AttackerAttributionProps) {
  return (
    <div className="dtm-report-attacker-attribution" data-testid={testId}>
      <div className="dtm-report-attacker-attribution-title">🕵️ 攻击者归因</div>
      <ul
        className="dtm-report-attacker-attribution-list"
        data-testid="attacker-attribution-list"
      >
        {rows.map((r, i) => (
          <li
            key={r.address}
            className="dtm-report-attacker-attribution-row"
            data-testid={`attacker-attribution-row-${i + 1}`}
          >
            <span className="dtm-report-attacker-attribution-cell mono">
              {formatAddress(r.address)}
            </span>
            <span className="dtm-report-attacker-attribution-cell">
              {r.share.toFixed(1)}%
            </span>
            <span className="dtm-report-attacker-attribution-cell mono">
              ${r.profit.toFixed(2)}
            </span>
            <span className="dtm-report-attacker-attribution-cell">
              {r.protocol}
            </span>
            <span className="dtm-report-attacker-attribution-cell mono">
              {formatTimestamp(r.timestamp)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AttackerAttribution;
