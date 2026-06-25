/**
 * ExportPdfButton — "📄 导出 PDF 报告" stub.
 *
 * Clicking the button calls `window.alert('PDF 已生成（demo 模式）')`
 * so we have a deterministic side-effect to assert against in tests.
 * In production this would dispatch to a real PDF generator and
 * trigger a file download.
 */

export interface ExportPdfButtonProps {
  testId?: string;
  /** Optional click handler to chain after the demo alert. */
  onClick?: () => void;
}

export function ExportPdfButton({ testId, onClick }: ExportPdfButtonProps) {
  function handleClick() {
    window.alert('PDF 已生成（demo 模式）');
    onClick?.();
  }
  return (
    <div className="dtm-report-export-pdf" data-testid={testId}>
      <button
        type="button"
        className="dtm-report-export-pdf-button"
        data-testid="export-pdf-button"
        onClick={handleClick}
      >
        📄 导出 PDF 报告
      </button>
    </div>
  );
}

export default ExportPdfButton;
