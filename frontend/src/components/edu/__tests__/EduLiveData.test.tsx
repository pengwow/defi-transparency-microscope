/**
 * Tests for EduLiveData — a 5-row mock live-data table for the
 * active scenario.  Each row shows a hash, a price change, and a
 * profit estimate.  The scenario is read from `eduStore`.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EduLiveData } from '../EduLiveData';
import { useEduStore } from '@/store/eduStore';

describe('EduLiveData', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<EduLiveData />);
    expect(screen.getByTestId('edu-live-data-panel')).toBeInTheDocument();
  });

  it('renders 5 mock transactions', () => {
    render(<EduLiveData />);
    const rows = screen.getAllByTestId(/^edu-live-row-/);
    expect(rows.length).toBe(5);
  });

  it('shows price and profit readouts per row', () => {
    render(<EduLiveData />);
    const table = screen.getByTestId('edu-live-data-panel');
    // Each row should mention a price ($...) and a profit ($...).
    const text = table.textContent || '';
    expect(text).toMatch(/\$/);
    // Profit column uses "Profit" / "收益" in either Chinese or English.
    expect(text).toMatch(/Profit|收益/);
  });

  it('mentions the active scenario type in the rows', () => {
    render(<EduLiveData />);
    const table = screen.getByTestId('edu-live-data-panel');
    // For the default sandwich scenario, the rows are labelled
    // "三明治" or "sandwich".
    expect(table.textContent).toMatch(/三明治|sandwich|Sandwich/);
  });
});
