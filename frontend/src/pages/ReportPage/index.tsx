/**
 * ReportPage — placeholder.
 *
 * Renders a Panel + ExplainBox announcing the module.  The real
 * implementation (summary + ECharts PnL chart + JSON export) lands in
 * Task 23.
 */

import { ExplainBox, Panel } from '@/components/common';

export function ReportPage() {
  return (
    <Panel title="Session Report" testId="report-panel">
      <p>Summarise the session: aggregate PnL, plot the PnL curve, and export the report as JSON.</p>
      <ExplainBox title="What is in a session report?">
        A session report collects the day's observations: which MEV
        strategies were seen, the cumulative extracted value, the
        aggregate PnL for the connected wallet, and a per-block
        timeline.  Export it as JSON to share or archive.
      </ExplainBox>
    </Panel>
  );
}

export default ReportPage;
