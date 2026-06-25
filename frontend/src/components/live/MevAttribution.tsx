/**
 * MevAttribution — five-row breakdown of the live mempool's MEV mix.
 *
 * Each row shows the strategy icon, label, percent of total mempool
 * volume, and the estimated profit captured in the period.  Numbers
 * are mocked for the demo; in production they would be derived from
 * the `useLiveStore` snapshot.
 */

import { TX_TYPE_META, TX_TYPE_KEYS, type TxType } from '@/services/demoData';

const ROWS: Array<{ type: TxType; pct: number; profitUsd: number }> = [
  { type: 'sandwich', pct: 38, profitUsd: 1240 },
  { type: 'arbitrage', pct: 24, profitUsd: 890 },
  { type: 'jit', pct: 18, profitUsd: 340 },
  { type: 'liquidation', pct: 12, profitUsd: 320 },
  { type: 'normal', pct: 8, profitUsd: 0 },
];

// Sanity-check the data covers every known type so the legend never
// disagrees with the attribution.
const ROW_TYPES = new Set(ROWS.map((r) => r.type));
for (const k of TX_TYPE_KEYS) {
  if (!ROW_TYPES.has(k)) {
    // tslint:disable-next-line:no-console
    console.warn(`MevAttribution: no row for TX type "${k}"`);
  }
}

export function MevAttribution() {
  return (
    <div className="dtm-mev-attribution" data-testid="mev-attribution">
      {ROWS.map((r) => {
        const meta = TX_TYPE_META[r.type];
        return (
          <div
            key={r.type}
            className={`dtm-mev-attr-row dtm-${meta.class}`}
            data-testid={`mev-attr-row-${r.type}`}
          >
            <span
              className="dtm-mev-attr-bar"
              style={{ background: meta.color }}
              aria-hidden="true"
            />
            <span className="dtm-mev-attr-icon">{meta.icon}</span>
            <span className="dtm-mev-attr-label">{meta.label}</span>
            <span className="dtm-mev-attr-pct" style={{ color: meta.color }}>
              {r.pct}%
            </span>
            <span className="dtm-mev-attr-profit">
              {r.profitUsd > 0 ? `$${r.profitUsd.toLocaleString()}` : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
