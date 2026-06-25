/**
 * MevLegend — five horizontal chips, one per MEV strategy, used as a
 * key inside the Mempool panel.  Renders the colored dot, the Chinese
 * label, and a short description for each type.
 *
 * Pure presentational; data comes from `TX_TYPE_META` so the legend
 * stays in sync with the demo transaction factory.
 */

import { TX_TYPE_META, TX_TYPE_KEYS, type TxType } from '@/services/demoData';

export function MevLegend() {
  return (
    <div className="dtm-mev-legend" data-testid="mev-legend">
      {TX_TYPE_KEYS.map((t: TxType) => {
        const meta = TX_TYPE_META[t];
        return (
          <div
            key={t}
            className={`dtm-mev-legend-item dtm-${meta.class}`}
            data-testid={`mev-legend-${t}`}
          >
            <span
              className="dtm-mev-legend-dot"
              data-dot
              style={{ background: meta.color, boxShadow: `0 0 6px ${meta.color}` }}
              aria-hidden="true"
            />
            <span className="dtm-mev-legend-label">{meta.label}</span>
            <span className="dtm-mev-legend-desc">{meta.desc}</span>
          </div>
        );
      })}
    </div>
  );
}
