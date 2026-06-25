/**
 * PendingMempool — the "待归因 Mempool" panel.
 *
 * Shows a list of 3-5 observed pending liquidations.  Each row
 * includes the protocol, the truncated address, the debt, the HF,
 * and the time until estimated execution.
 */

interface PendingRow {
  protocol: 'Aave V3' | 'Compound' | 'MakerDAO';
  addr: string;
  debt: string;
  hf: string;
  eta: string;
  color: string;
}

const ROWS: PendingRow[] = [
  { protocol: 'Aave V3', addr: '0xWhale…3f8E', debt: '$2.4M', hf: '0.94', eta: '4m', color: '#ff5e5e' },
  { protocol: 'Compound', addr: '0xBob…ab12', debt: '$850K', hf: '0.97', eta: '8m', color: '#ffab40' },
  { protocol: 'Aave V3', addr: '0xCar…91de', debt: '$1.1M', hf: '0.99', eta: '12m', color: '#ffab40' },
  { protocol: 'MakerDAO', addr: '0xDav…77aF', debt: '$640K', hf: '0.95', eta: '6m', color: '#ff5e5e' },
  { protocol: 'Compound', addr: '0xEve…02c1', debt: '$420K', hf: '0.98', eta: '15m', color: '#ffab40' },
];

export interface PendingMempoolProps {
  testId?: string;
}

export function PendingMempool({ testId = 'liquidation-pending-mempool-panel' }: PendingMempoolProps) {
  return (
    <div className="dtm-pending-mempool" data-testid={testId}>
      <div className="dtm-pending-mempool-title">📋 待归因 Mempool</div>
      <ul className="dtm-pending-mempool-list" data-testid="pending-mempool-list">
        {ROWS.map((row, i) => (
          <li
            key={i}
            className="dtm-pending-mempool-row"
            data-testid={`pending-mempool-row-${i}`}
            style={{ borderLeftColor: row.color }}
          >
            <span className="dtm-pending-mempool-protocol" style={{ color: row.color }}>
              {row.protocol}
            </span>
            <span className="dtm-pending-mempool-addr">{row.addr}</span>
            <span className="dtm-pending-mempool-debt">{row.debt}</span>
            <span className="dtm-pending-mempool-hf">HF {row.hf}</span>
            <span className="dtm-pending-mempool-eta">ETA {row.eta}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PendingMempool;
