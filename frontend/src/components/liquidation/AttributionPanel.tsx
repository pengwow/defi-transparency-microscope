/**
 * AttributionPanel — 5-row breakdown of who got what out of a
 * liquidation event:
 *   1. 清算人 (the liquidator bot)
 *   2. 罚金 (penalty paid)
 *   3. 实际到账 (liquidator's net received)
 *   4. 损失方 (the liquidated user)
 *   5. 协议费 (protocol fee)
 */

interface AttributionRow {
  label: string;
  actor: string;
  amount: string;
  detail: string;
  color: string;
}

const ROWS: AttributionRow[] = [
  { label: '清算人', actor: '0xBot…a1f9', amount: '+$50,000', detail: '0.0209 ETH × 清算', color: '#69f0ae' },
  { label: '罚金', actor: 'protocol penalty', amount: '5.0%', detail: 'debt × 5%', color: '#ffab40' },
  { label: '实际到账', actor: 'liquidator net', amount: '+$48,250', detail: '扣除 gas 后', color: '#00e5ff' },
  { label: '损失方', actor: '0xWhale…3f8E', amount: '-$48,250', detail: '抵押 ETH × 折价', color: '#ff5e5e' },
  { label: '协议费', actor: 'Aave V3 treasury', amount: '+$1,750', detail: '罚金 35% 入库', color: '#b388ff' },
];

export interface AttributionPanelProps {
  testId?: string;
}

export function AttributionPanel({
  testId = 'liquidation-attribution-panel',
}: AttributionPanelProps) {
  return (
    <div className="dtm-attribution-panel" data-testid={testId}>
      <div className="dtm-attribution-panel-title">🧮 清算归因分解</div>
      <ul className="dtm-attribution-panel-list">
        {ROWS.map((r, i) => (
          <li
            key={i}
            className="dtm-attribution-row"
            data-testid={`attribution-row-${i}`}
            style={{ borderLeftColor: r.color }}
          >
            <span className="dtm-attribution-label" style={{ color: r.color }}>
              {r.label}
            </span>
            <span className="dtm-attribution-actor">{r.actor}</span>
            <span className="dtm-attribution-amount" style={{ color: r.color }}>
              {r.amount}
            </span>
            <span className="dtm-attribution-detail">{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AttributionPanel;
