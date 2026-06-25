/**
 * Tests for the ReportSummary component (Report page).
 */

import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ReportSummary } from './ReportSummary';
import type { ReportSummary as ReportSummaryData } from './ReportSummary';

afterEach(() => {
  cleanup();
});

function makeSummary(over: Partial<ReportSummaryData> = {}): ReportSummaryData {
  return {
    txCount: 42,
    mevCostUsd: 1234,
    lpValueUsd: 56789,
    debtUsd: 1000,
    scenarios: 7,
    ...over,
  };
}

describe('ReportSummary', () => {
  it('shows the tx count metric', () => {
    render(<ReportSummary summary={makeSummary({ txCount: 99 })} />);
    expect(screen.getByText('99')).toBeInTheDocument();
  });

  it('shows the MEV cost as USD', () => {
    render(<ReportSummary summary={makeSummary({ mevCostUsd: 1234 })} />);
    expect(screen.getByText(/\$1\.23K/)).toBeInTheDocument();
  });

  it('shows the LP value as USD', () => {
    render(<ReportSummary summary={makeSummary({ lpValueUsd: 56789 })} />);
    expect(screen.getByText(/\$56\.79K/)).toBeInTheDocument();
  });

  it('shows the debt as USD', () => {
    render(<ReportSummary summary={makeSummary({ debtUsd: 1000 })} />);
    expect(screen.getByText(/\$1K/)).toBeInTheDocument();
  });

  it('shows the scenarios count', () => {
    render(<ReportSummary summary={makeSummary({ scenarios: 7 })} />);
    expect(screen.getByText('7')).toBeInTheDocument();
  });

  it('renders all 5 metric labels', () => {
    render(<ReportSummary summary={makeSummary()} />);
    expect(screen.getByText(/transactions/i)).toBeInTheDocument();
    expect(screen.getByText(/mev cost/i)).toBeInTheDocument();
    expect(screen.getByText(/lp value/i)).toBeInTheDocument();
    expect(screen.getByText(/debt/i)).toBeInTheDocument();
    expect(screen.getByText(/scenarios/i)).toBeInTheDocument();
  });
});
