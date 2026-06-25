/**
 * Tests for the ExportPdfButton component.
 *
 * The button shows the label "📄 导出 PDF 报告" and, on click,
 * fires a `window.alert('PDF 已生成（demo 模式）')` stub.
 */

import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ExportPdfButton } from '../ExportPdfButton';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ExportPdfButton', () => {
  it('renders the button with the expected label', () => {
    render(<ExportPdfButton />);
    const btn = screen.getByTestId('export-pdf-button');
    expect(btn).toBeInTheDocument();
    expect(btn.textContent).toMatch(/导出 PDF 报告/);
  });

  it('clicking the button triggers window.alert with the stub message', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<ExportPdfButton />);
    fireEvent.click(screen.getByTestId('export-pdf-button'));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy).toHaveBeenCalledWith('PDF 已生成（demo 模式）');
  });

  it('renders the panel wrapper testId when given', () => {
    render(<ExportPdfButton testId="export-pdf-panel" />);
    expect(screen.getByTestId('export-pdf-panel')).toBeInTheDocument();
  });
});
