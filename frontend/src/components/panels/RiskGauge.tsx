/**
 * RiskGauge — circular ring + central value with level-tinted stroke.
 *
 * The ring is drawn with a single SVG circle; the stroke is colored
 * by the `level` prop (low=lime, medium=cyan, high=coral).  The
 * value (and optional `label`) is shown in the center.
 *
 *   <RiskGauge value={73} max={100} level="medium" label="HF" />
 */

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskGaugeProps {
  value: number;
  max?: number;
  level?: RiskLevel;
  label?: string;
  testId?: string;
}

const LEVEL_CLASS: Record<RiskLevel, string> = {
  low: 'is-low',
  medium: 'is-medium',
  high: 'is-high',
};

export function RiskGauge({
  value,
  max = 100,
  level = 'medium',
  label,
  testId,
}: RiskGaugeProps) {
  const cls = `dtm-risk-gauge ${LEVEL_CLASS[level]}`;
  const pct = Math.max(0, Math.min(1, value / max)) * 100;
  // Simple SVG ring: 100x100, r=40, circumference ≈ 251.3.
  const r = 40;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <div className={cls} data-testid={testId} data-level={level}>
      <svg viewBox="0 0 100 100" className="dtm-risk-gauge-ring" aria-hidden="true">
        <circle
          className="dtm-risk-gauge-track"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="6"
        />
        <circle
          className="dtm-risk-gauge-progress"
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeDasharray={`${dash} ${c - dash}`}
          strokeDashoffset={c / 4}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="dtm-risk-gauge-center">
        <div className="dtm-risk-gauge-value">{value}</div>
        {label && <div className="dtm-risk-gauge-label">{label}</div>}
      </div>
    </div>
  );
}
