/**
 * ProtocolStats — per-protocol liquidation statistics grid.
 *
 * 3 protocols (Aave V3, Compound, MakerDAO) × 4 metrics:
 *   - 24h count of liquidations
 *   - 24h USD volume
 *   - whale liquidations (>$1M)
 *   - average liquidation HF
 *
 * Rendered as a 3-row × 4-col grid; each cell is identified by
 * `protocol-stats-cell-{protocol}-{metric}`.
 */

interface ProtocolRow {
  key: string;
  label: string;
  count: string;
  value: string;
  whale: string;
  avgHf: string;
  color: string;
}

const ROWS: ProtocolRow[] = [
  { key: 'aave', label: 'Aave V3', count: '47', value: '$12.4M', whale: '3', avgHf: '0.97', color: '#00e5ff' },
  { key: 'compound', label: 'Compound', count: '23', value: '$4.1M', whale: '1', avgHf: '0.95', color: '#ffab40' },
  { key: 'makerdao', label: 'MakerDAO', count: '8', value: '$1.9M', whale: '0', avgHf: '0.99', color: '#b388ff' },
];

const METRICS: Array<{ key: string; label: string; getValue: (r: ProtocolRow) => string }> = [
  { key: 'count', label: '24h 笔数', getValue: (r) => r.count },
  { key: 'value', label: '24h 总额', getValue: (r) => r.value },
  { key: 'whale', label: '巨鲸 (>$1M)', getValue: (r) => r.whale },
  { key: 'avgHf', label: '平均清算 HF', getValue: (r) => r.avgHf },
];

export interface ProtocolStatsProps {
  testId?: string;
}

export function ProtocolStats({ testId = 'liquidation-protocol-stats-panel' }: ProtocolStatsProps) {
  return (
    <div className="dtm-protocol-stats" data-testid={testId}>
      <div className="dtm-protocol-stats-title">📊 协议清算统计</div>
      <div className="dtm-protocol-stats-grid">
        {ROWS.map((row) => (
          <div
            key={row.key}
            className="dtm-protocol-stats-row"
            data-testid={`protocol-stats-row-${row.key}`}
          >
            <div className="dtm-protocol-stats-label" style={{ color: row.color }}>
              {row.label}
            </div>
            {METRICS.map((m) => (
              <div
                key={m.key}
                className="dtm-protocol-stats-cell"
                data-testid={`protocol-stats-cell-${row.key}-${m.key}`}
              >
                <div className="dtm-protocol-stats-cell-value" style={{ color: row.color }}>
                  {m.getValue(row)}
                </div>
                <div className="dtm-protocol-stats-cell-label">{m.label}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ProtocolStats;
