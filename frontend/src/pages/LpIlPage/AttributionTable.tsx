/**
 * AttributionTable — P&L attribution for a single LP position.
 *
 * Decomposes the position's net P&L into fees, rewards, and IL.
 * `net = fees + rewards + il` (IL is always ≤ 0).
 */

import { formatUsd } from '@/utils/format';
import './AttributionTable.css';

export interface AttributionRow {
  id: string;
  /** LP fees earned, in USD. */
  fees: number;
  /** Token / incentive rewards, in USD. */
  rewards: number;
  /** Impermanent loss, in USD (always ≤ 0). */
  il: number;
}

export interface AttributionTableProps {
  row: AttributionRow | null;
}

export function AttributionTable({ row }: AttributionTableProps) {
  if (!row) {
    return (
      <div className="dtm-attribution-empty" data-testid="attribution-empty">
        <p>No position selected. Click a row in the list to see attribution.</p>
      </div>
    );
  }
  const net = row.fees + row.rewards + row.il;
  return (
    <table className="dtm-attribution-table" data-testid="attribution-table">
      <thead>
        <tr>
          <th>Position</th>
          <th>Fees</th>
          <th>Rewards</th>
          <th>IL</th>
          <th>Net P&amp;L</th>
        </tr>
      </thead>
      <tbody>
        <tr data-testid="attribution-row">
          <th scope="row" className="mono">
            {row.id}
          </th>
          <td className="mono dtm-attribution-fees">{formatUsd(row.fees)}</td>
          <td className="mono dtm-attribution-rewards">{formatUsd(row.rewards)}</td>
          <td className="mono dtm-attribution-il">{formatUsd(row.il)}</td>
          <td
            className={`mono dtm-attribution-net ${
              net >= 0 ? 'dtm-attribution-net-pos' : 'dtm-attribution-net-neg'
            }`}
          >
            {formatUsd(net)}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export default AttributionTable;
