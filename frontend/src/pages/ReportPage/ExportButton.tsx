/**
 * ExportButton — download a session report as JSON.
 *
 * On click, serialises the `data` prop with `JSON.stringify` and
 * triggers a download of the resulting blob.  In jsdom tests
 * `URL.createObjectURL` is polyfilled to a no-op string.
 */

import './ExportButton.css';

export interface PnLSeriesPoint {
  ts: number;
  value: number;
}

export interface ReportData {
  sessionId: string;
  generatedAt: number;
  txCount: number;
  mevCostUsd: number;
  lpValueUsd: number;
  debtUsd: number;
  scenarios: number;
  pnlSeries: ReadonlyArray<PnLSeriesPoint>;
}

export interface ExportButtonProps {
  data: ReportData;
  /** Optional filename; defaults to `<sessionId>.json`. */
  filename?: string;
}

export function ExportButton({ data, filename }: ExportButtonProps) {
  function handleClick() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename ?? `${data.sessionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      className="dtm-export-button"
      data-testid="export-button"
      onClick={handleClick}
    >
      Export JSON
    </button>
  );
}

export default ExportButton;
