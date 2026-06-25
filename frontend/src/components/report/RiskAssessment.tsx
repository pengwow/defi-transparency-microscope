/**
 * RiskAssessment — risk rating (low / medium / high / critical) for
 * the Report tab, plus a short description and an advice line.
 *
 * The colour of the level chip and the rendered text are derived
 * from the `level` prop.  The data attributes on the level span
 * (`data-level`) are stable so tests can pin to them.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface RiskAssessmentProps {
  level: RiskLevel;
  /** Numeric risk score 0-100. */
  score: number;
  /** Past 30-day strategy frequency. */
  frequency: number;
  /** Pool liquidity description (e.g. "高 / 中等 / 低"). */
  poolTvl: string;
  /** Mempool competition description (e.g. "高 / 中等 / 低"). */
  mempool: string;
  testId?: string;
}

const LEVEL_META: Record<
  RiskLevel,
  { label: string; color: string; description: string; advice: string }
> = {
  low: {
    label: '低风险',
    color: '#69f0ae',
    description: '当前活动在历史基线范围内，未发现主动攻击迹象。',
    advice: '保持当前监控频率即可，建议每周回看一次报告。',
  },
  medium: {
    label: '中等风险',
    color: '#ffab40',
    description: '观察到一些可疑活动，但尚未达到攻击阈值。',
    advice: '建议开启 mempool 监控并设置滑点告警。',
  },
  high: {
    label: '高风险',
    color: '#ff5e5e',
    description: '已检测到高频攻击模式，部分交易可能已被夹。',
    advice: '建议立即接入 MEV-Protect 中继并拆分大额 swap。',
  },
  critical: {
    label: '极高风险',
    color: '#ff1744',
    description: '极大概率遭受三明治策略，损失显著。',
    advice: '立即停止公开 mempool 提交，迁至私有中继并复盘损失。',
  },
};

export function RiskAssessment({
  level,
  score,
  frequency,
  poolTvl,
  mempool,
  testId = 'risk-assessment-panel',
}: RiskAssessmentProps) {
  const meta = LEVEL_META[level];
  return (
    <div className="dtm-report-risk-assessment" data-testid={testId}>
      <div className="dtm-report-risk-assessment-title">🛡️ 风险评估</div>
      <div className="dtm-report-risk-assessment-row">
        <div
          className="dtm-report-risk-assessment-chip"
          data-level={level}
          style={{ borderColor: meta.color, color: meta.color }}
          data-testid="risk-assessment-level"
        >
          <span className="dtm-report-risk-assessment-score">{score}</span>
          <span className="dtm-report-risk-assessment-label">{meta.label}</span>
        </div>
        <p className="dtm-report-risk-assessment-desc">{meta.description}</p>
      </div>
      <ul className="dtm-report-risk-assessment-meta">
        <li>
          <span className="muted">历史策略频率:</span> 过去 30 天 {frequency} 次
        </li>
        <li>
          <span className="muted">池子流动性:</span> {poolTvl}
        </li>
        <li>
          <span className="muted">Mempool 竞争度:</span> {mempool}
        </li>
      </ul>
      <p
        className="dtm-report-risk-assessment-advice"
        data-testid="risk-assessment-advice"
      >
        💡 {meta.advice}
      </p>
    </div>
  );
}

export default RiskAssessment;
