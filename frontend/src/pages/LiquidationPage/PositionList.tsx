/**
 * PositionList — clickable list of lending positions.
 *
 * Each row shows the position id, the collateral and debt totals, and
 * the current health factor.  The active row carries a `data-active`
 * flag for styling and is rendered with a coloured bar matching the
 * risk level.
 */

import type { LendingPosition } from '@/types';
import { calculateHealthFactor } from '@/algorithms/hf';
import { formatUsd, formatAddress } from '@/utils/format';
import './PositionList.css';

export interface PositionListProps {
  positions: ReadonlyArray<LendingPosition>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ONE_E18 = 10n ** 18n;

function totalToken(map: Record<string, bigint>): bigint {
  let s = 0n;
  for (const v of Object.values(map)) s += v;
  return s;
}

function healthFor(p: LendingPosition): number {
  const coll = totalToken(p.collateral);
  const debt = totalToken(p.debt);
  return (
    Number(calculateHealthFactor(coll, debt, p.liquidationThresholdE18)) /
    Number(ONE_E18)
  );
}

function riskClass(hf: number): string {
  if (hf < 1.05) return 'dtm-risk-critical';
  if (hf < 1.5) return 'dtm-risk-warning';
  if (hf < 2.0) return 'dtm-risk-ok';
  return 'dtm-risk-safe';
}

export function PositionList({ positions, selectedId, onSelect }: PositionListProps) {
  if (positions.length === 0) {
    return <p className="dtm-position-list-empty">No lending positions.</p>;
  }
  return (
    <ul className="dtm-position-list" data-testid="position-list-items">
      {positions.map((p) => {
        const active = p.id === selectedId;
        const hf = healthFor(p);
        const coll = totalToken(p.collateral);
        const debt = totalToken(p.debt);
        return (
          <li key={p.id} className="dtm-position-list-item">
            <button
              type="button"
              className="dtm-position-list-row"
              data-active={active ? 'true' : 'false'}
              onClick={() => onSelect(p.id)}
              aria-pressed={active}
            >
              <div className="dtm-position-list-head">
                <span className="dtm-position-list-id mono">{p.id}</span>
                <span className={`dtm-position-list-hf ${riskClass(hf)}`}>
                  HF {hf.toFixed(2)}
                </span>
              </div>
              <div className="dtm-position-list-meta">
                <span className="muted">owner</span>
                <span className="mono">{formatAddress(p.owner)}</span>
              </div>
              <div className="dtm-position-list-meta">
                <span className="muted">collateral</span>
                <span className="mono">{formatUsd(coll)}</span>
              </div>
              <div className="dtm-position-list-meta">
                <span className="muted">debt</span>
                <span className="mono">{formatUsd(debt)}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default PositionList;
