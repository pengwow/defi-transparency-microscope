/**
 * PositionDetails — single-position info table (6 rows: user,
 * protocol, collateral, debt, HF, status).
 */

interface Row {
  key: string;
  label: string;
  value: string;
  color?: string;
}

const ROWS: Row[] = [
  { key: 'user', label: '用户', value: '0xWhale…3f8E' },
  { key: 'protocol', label: '协议', value: 'Aave V3', color: '#00e5ff' },
  { key: 'collateral', label: '抵押', value: '10.0 ETH ($24,000)' },
  { key: 'debt', label: '债务', value: '5,000 USDC' },
  { key: 'hf', label: 'HF', value: '0.97', color: '#ffab40' },
  { key: 'status', label: '状态', value: '⚠ 可清算', color: '#ff5e5e' },
];

export interface PositionDetailsProps {
  testId?: string;
}

export function PositionDetails({
  testId = 'liquidation-position-details-panel',
}: PositionDetailsProps) {
  return (
    <div className="dtm-position-details" data-testid={testId}>
      <div className="dtm-position-details-title">📋 仓位详情</div>
      <table className="dtm-position-details-table">
        <tbody>
          {ROWS.map((r) => (
            <tr
              key={r.key}
              className="dtm-position-details-row"
              data-testid={`position-details-row-${r.key}`}
            >
              <td className="dtm-position-details-label">{r.label}</td>
              <td
                className="dtm-position-details-value"
                style={{ color: r.color ?? 'inherit' }}
              >
                {r.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default PositionDetails;
