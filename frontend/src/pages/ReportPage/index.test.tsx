/**
 * Tests for the ReportPage.
 *
 * Verifies that all 10 panel testIds (Phase 8) are present along
 * with the legacy `report-summary-panel` from Batch 4.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReportPage } from './index';

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
  })),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ReportPage', () => {
  it('renders the page test id root', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('report-page')).toBeInTheDocument();
  });

  it('renders all 10 new panel testIds', () => {
    render(<ReportPage />);
    const testIds = [
      'report-overview-panel',
      'strategy-pie-panel',
      'risk-radar-panel',
      'profit-waterfall-panel',
      'attacker-attribution-panel',
      'vulnerability-panel',
      'compliance-advice-panel',
      'evm-trace-panel',
      'risk-assessment-panel',
      'export-pdf-panel',
    ];
    for (const id of testIds) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('preserves the legacy report-summary-panel testId', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('report-summary-panel')).toBeInTheDocument();
  });

  it('shows an explain box that mentions the report id', () => {
    render(<ReportPage />);
    const matches = screen.getAllByText((_, node) => {
      if (!node || !node.textContent) return false;
      return /报告|切片 ID|DTM-RPT|合规/.test(node.textContent);
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows the EVM trace table with 6 rows', () => {
    const { container } = render(<ReportPage />);
    const rows = container.querySelectorAll('[data-testid^="evm-trace-row-"]');
    expect(rows.length).toBe(6);
  });

  it('renders the strategy pie with 5 legend items', () => {
    const { container } = render(<ReportPage />);
    const items = container.querySelectorAll('[data-testid^="strategy-pie-legend-"]');
    expect(items.length).toBe(5);
  });
});
