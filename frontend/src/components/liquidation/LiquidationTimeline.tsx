/**
 * LiquidationTimeline — a 4-step horizontal timeline that walks the
 * user through the lifecycle of a liquidation event.
 */

interface Step {
  time: string;
  title: string;
  desc: string;
  color: string;
}

const STEPS: Step[] = [
  { time: 'T+0', title: '初始', desc: '抵押 10 ETH · 借出 5000 USDC', color: '#8b9bb4' },
  { time: 'T+5m', title: 'HF 接近 1.0', desc: '价格下移, 风险抬升', color: '#ffab40' },
  { time: 'T+8m', title: '触发清算', desc: 'bot 抢跑, 攻击线开始', color: '#ff5e5e' },
  { time: 'T+9m', title: '罚金分配', desc: '罚金归清算人, 协议费归 treasury', color: '#b388ff' },
];

export interface LiquidationTimelineProps {
  testId?: string;
}

export function LiquidationTimeline({
  testId = 'liquidation-timeline-panel',
}: LiquidationTimelineProps) {
  return (
    <div className="dtm-liquidation-timeline" data-testid={testId}>
      <div className="dtm-liquidation-timeline-title">⏱ 清算事件时间线</div>
      <ol className="dtm-liquidation-timeline-list">
        {STEPS.map((s, i) => (
          <li
            key={i}
            className="dtm-liquidation-timeline-step"
            data-testid={`liquidation-timeline-step-${i}`}
            style={{ borderColor: s.color }}
          >
            <span className="dtm-liquidation-timeline-time" style={{ color: s.color }}>
              {s.time}
            </span>
            <div className="dtm-liquidation-timeline-body">
              <div className="dtm-liquidation-timeline-step-title">{s.title}</div>
              <div className="dtm-liquidation-timeline-step-desc">{s.desc}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default LiquidationTimeline;
