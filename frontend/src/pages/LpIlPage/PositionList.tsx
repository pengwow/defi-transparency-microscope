/**
 * PositionList — clickable list of LP positions for the LP/IL page.
 *
 * Each row shows the position id, protocol, the derived USD value
 * (sum of underlying token amounts), and a notional APR.  The active
 * row carries a `data-active` flag for styling and is rendered with
 * a coloured bar.
 */

import type { DexProtocol } from '@/types';
import { formatUsd, formatPct } from '@/utils/format';
import './PositionList.css';

export interface LpPositionRow {
  id: string;
  /** Notional APR expressed as a fraction (0.12 = 12%). */
  apr: number;
  /** USD value of the position's underlying tokens. */
  value: number;
  protocol: DexProtocol;
}

export interface PositionListProps {
  rows: ReadonlyArray<LpPositionRow>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function PositionList({ rows, selectedId, onSelect }: PositionListProps) {
  if (rows.length === 0) {
    return <p className="dtm-lp-list-empty">No LP positions.</p>;
  }
  return (
    <ul className="dtm-lp-list" data-testid="position-list-items">
      {rows.map((r) => {
        const active = r.id === selectedId;
        return (
          <li key={r.id} className="dtm-lp-list-item">
            <button
              type="button"
              className="dtm-lp-list-row"
              data-testid="position-list-row"
              data-active={active ? 'true' : 'false'}
              onClick={() => onSelect(r.id)}
              aria-pressed={active}
            >
              <div className="dtm-lp-list-head">
                <span className="dtm-lp-list-id mono">{r.id}</span>
                <span className="dtm-lp-list-apr mono">APR {formatPct(r.apr)}</span>
              </div>
              <div className="dtm-lp-list-meta">
                <span className="muted">protocol</span>
                <span className="mono">{r.protocol}</span>
              </div>
              <div className="dtm-lp-list-meta">
                <span className="muted">value</span>
                <span className="mono">{formatUsd(r.value)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default PositionList;
