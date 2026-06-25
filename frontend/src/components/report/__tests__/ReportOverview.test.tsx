/**
 * Tests for the ReportOverview component.
 *
 * ReportOverview renders 4 metric boxes (总利润 / 总损失 / 受害人数 /
 * 涉及交易数), the report id, the block number, and an export
 * button placeholder.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportOverview } from '../ReportOverview';

const OVERVIEW = {
  reportId: 'DTM-RPT-20260625-001',
  blockNumber: 22_180_543,
  totalProfitUsd: 1_240_500_000_000_000_000n,
  totalLossUsd: 456_200_000_000_000_000n,
  victimCount: 12,
  txCount: 38,
};

describe('ReportOverview', () => {
  it('renders the panel root', () => {
    render(<ReportOverview data={OVERVIEW} />);
    expect(screen.getByTestId('report-overview-panel')).toBeInTheDocument();
  });

  it('renders 4 metric boxes', () => {
    render(<ReportOverview data={OVERVIEW} />);
    const metrics = screen.getAllByTestId(/^report-overview-metric-\d+$/);
    expect(metrics.length).toBe(4);
  });

  it('shows the report id and block number', () => {
    render(<ReportOverview data={OVERVIEW} />);
    expect(screen.getByTestId('report-overview-id').textContent).toContain('DTM-RPT-20260625-001');
    expect(screen.getByTestId('report-overview-block').textContent).toContain('22,180,543');
  });

  it('renders the export button', () => {
    render(<ReportOverview data={OVERVIEW} />);
    expect(screen.getByTestId('report-overview-export')).toBeInTheDocument();
  });
});
