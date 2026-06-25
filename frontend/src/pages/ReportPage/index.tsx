/**
 * ReportPage — the session summary view.
 *
 * Three columns:
 *   1. Report Summary  — five headline metrics (tx count, MEV cost,
 *      LP value, debt, scenarios).
 *   2. PnL Over Time   — ECharts line chart of the session's PnL
 *      series.
 *   3. Export          — a button that downloads the report as JSON.
 *
 * The data is mocked locally for the MVP; in a follow-up it would be
 * aggregated from the live store / experiment runner.
 */

import { ExplainBox, Panel } from '@/components/common';
import { ReportSummary, type ReportSummary as ReportSummaryData } from './ReportSummary';
import { PnLChart, type PnLPoint } from './PnLChart';
import { ExportButton, type ReportData } from './ExportButton';
import './ReportPage.css';

const SUMMARY: ReportSummaryData = {
  txCount: 128,
  mevCostUsd: 4_215.5,
  lpValueUsd: 312_500,
  debtUsd: 75_000,
  scenarios: 6,
};

const PNL: ReadonlyArray<PnLPoint> = [
  { ts: 1_700_000_000, value: 0 },
  { ts: 1_700_086_400, value: 250 },
  { ts: 1_700_172_800, value: 180 },
  { ts: 1_700_259_200, value: 420 },
  { ts: 1_700_345_600, value: 360 },
  { ts: 1_700_432_000, value: 510 },
  { ts: 1_700_518_400, value: 680 },
];

const REPORT_DATA: ReportData = {
  sessionId: 'sess-2026-06-25',
  generatedAt: 1_700_518_400,
  txCount: SUMMARY.txCount,
  mevCostUsd: SUMMARY.mevCostUsd,
  lpValueUsd: SUMMARY.lpValueUsd,
  debtUsd: SUMMARY.debtUsd,
  scenarios: SUMMARY.scenarios,
  pnlSeries: PNL,
};

export function ReportPage() {
  return (
    <div className="dtm-report-grid" data-testid="report-page">
      <Panel title="Report Summary" testId="report-summary-panel">
        <ReportSummary summary={SUMMARY} />
        <ExplainBox title="What do the numbers mean?">
          Transactions is the total number of txs the dashboard
          observed in this session.  MEV cost is the cumulative
          extracted value (sandwich profit + arb rebates).  LP value
          and debt are the end-of-session positions.
        </ExplainBox>
      </Panel>

      <Panel title="PnL Over Time" testId="pnl-over-time-panel">
        <PnLChart points={PNL} />
        <ExplainBox title="Reading the curve">
          Each point is a snapshot of the cumulative P&amp;L at that
          timestamp.  The line goes up when the wallet is up; flat
          or down segments are quiet periods or losses.  Hover for
          exact values.
        </ExplainBox>
      </Panel>

      <Panel title="Export" testId="export-panel">
        <ExportButton data={REPORT_DATA} />
        <p className="muted dtm-report-export-hint">
          Downloads <code>{REPORT_DATA.sessionId}.json</code> with the full
          report payload (summary, PnL series, metadata).
        </p>
        <ExplainBox title="What is exported?">
          The JSON contains the same five summary metrics shown on
          the left, the PnL series, the session id, and the
          generation timestamp.  Use it to archive a session or
          share it with another tool.
        </ExplainBox>
      </Panel>
    </div>
  );
}

export default ReportPage;
