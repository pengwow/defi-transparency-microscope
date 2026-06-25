/**
 * Tests for the ReportPage.
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
  it('renders the three panels', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('report-summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('pnl-over-time-panel')).toBeInTheDocument();
    expect(screen.getByTestId('export-panel')).toBeInTheDocument();
  });

  it('shows the page test id root', () => {
    render(<ReportPage />);
    expect(screen.getByTestId('report-page')).toBeInTheDocument();
  });

  it('renders the report summary metrics', () => {
    render(<ReportPage />);
    expect(screen.getByText(/transactions/i)).toBeInTheDocument();
  });

  it('renders the PnL chart container', () => {
    const { container } = render(<ReportPage />);
    expect(container.querySelector('[data-testid="pnl-chart"]')).not.toBeNull();
  });

  it('renders the export button', () => {
    render(<ReportPage />);
    expect(screen.getByRole('button', { name: /export json/i })).toBeInTheDocument();
  });

  it('shows an explain box in each panel', () => {
    render(<ReportPage />);
    expect(screen.getAllByTestId('explain-box').length).toBeGreaterThanOrEqual(3);
  });
});
