/**
 * ReportSummary — top-level session metrics for the Report page.
 *
 * Displays five headline numbers: tx count, MEV cost, LP value, debt,
 * and scenarios run.  Each metric is rendered as a tile with a label
 * and a formatted value.
 */

import { formatUsd } from '@/utils/format';
import './ReportSummary.css';

export interface ReportSummary {
  txCount: number;
  mevCostUsd: number;
  lpValueUsd: number;
  debtUsd: number;
  scenarios: number;
}

export interface ReportSummaryProps {
  summary: ReportSummary;
}

interface Metric {
  key: keyof ReportSummary | string;
  label: string;
  value: string;
  format: 'number' | 'usd';
}

export function ReportSummary({ summary }: ReportSummaryProps) {
  const metrics: Metric[] = [
    { key: 'txCount', label: 'Transactions', value: String(summary.txCount), format: 'number' },
    { key: 'mevCostUsd', label: 'MEV cost', value: formatUsd(summary.mevCostUsd), format: 'usd' },
    { key: 'lpValueUsd', label: 'LP value', value: formatUsd(summary.lpValueUsd), format: 'usd' },
    { key: 'debtUsd', label: 'Debt', value: formatUsd(summary.debtUsd), format: 'usd' },
    { key: 'scenarios', label: 'Scenarios', value: String(summary.scenarios), format: 'number' },
  ];
  return (
    <ul className="dtm-report-summary" data-testid="report-summary">
      {metrics.map((m) => (
        <li key={m.key} className="dtm-report-summary-tile" data-format={m.format}>
          <span className="dtm-report-summary-label">{m.label}</span>
          <span className="dtm-report-summary-value mono">{m.value}</span>
        </li>
      ))}
    </ul>
  );
}

export default ReportSummary;
