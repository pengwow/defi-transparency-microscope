/**
 * ReportOverview — top of the Report page.
 *
 * Visual: 4 metric boxes in a row (总利润 / 总损失 / 受害人数 /
 * 涉及交易数) plus the report id, block number, and an export
 * button.  In the production flow, the export button would hand
 * off to the dedicated `ExportPdfButton`; here we render an
 * embedded button stub so the panel is self-contained.
 */

import { MetricBox } from '@/components/panels';
import { formatUsd } from '@/utils/format';

export interface ReportOverviewData {
  reportId: string;
  blockNumber: number;
  totalProfitUsd: bigint;
  totalLossUsd: bigint;
  victimCount: number;
  txCount: number;
}

export interface ReportOverviewProps {
  data: ReportOverviewData;
  /** Optional click handler for the export button. */
  onExport?: () => void;
  testId?: string;
}

export function ReportOverview({
  data,
  onExport,
  testId = 'report-overview-panel',
}: ReportOverviewProps) {
  return (
    <div className="dtm-report-overview" data-testid={testId}>
      <header className="dtm-report-overview-header">
        <div className="dtm-report-overview-title">
          <h3>📊 MEV 合规披露报告</h3>
        </div>
        <div className="dtm-report-overview-meta">
          <span data-testid="report-overview-id" className="mono">
            报告 ID: {data.reportId}
          </span>
          <span data-testid="report-overview-block" className="mono">
            区块 #{data.blockNumber.toLocaleString()}
          </span>
          <button
            type="button"
            className="dtm-report-overview-export"
            data-testid="report-overview-export"
            onClick={onExport}
          >
            📥 导出 PDF
          </button>
        </div>
      </header>
      <div className="dtm-report-overview-metrics" data-testid="report-overview-metrics">
        <MetricBox
          testId="report-overview-metric-1"
          label="总利润 (Profit)"
          value={formatUsd(data.totalProfitUsd)}
          trend="up"
        />
        <MetricBox
          testId="report-overview-metric-2"
          label="总损失 (Loss)"
          value={formatUsd(data.totalLossUsd)}
          trend="down"
        />
        <MetricBox
          testId="report-overview-metric-3"
          label="受害人数"
          value={String(data.victimCount)}
          trend="flat"
        />
        <MetricBox
          testId="report-overview-metric-4"
          label="涉及交易数"
          value={String(data.txCount)}
          trend="flat"
        />
      </div>
    </div>
  );
}

export default ReportOverview;
