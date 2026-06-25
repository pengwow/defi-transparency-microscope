/**
 * Tests for the MevLegend chip strip.
 *
 * The component renders one chip per entry in `TX_TYPE_META`, showing
 * the type's color dot, label, and description.  It is purely
 * presentational — no store, no side effects.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MevLegend } from '../MevLegend';
import { TX_TYPE_KEYS, TX_TYPE_META } from '@/services/demoData';

describe('MevLegend', () => {
  it('renders one chip per MEV type', () => {
    render(<MevLegend />);
    for (const t of TX_TYPE_KEYS) {
      expect(screen.getByTestId(`mev-legend-${t}`)).toBeInTheDocument();
    }
  });

  it('shows the type label and a description for each chip', () => {
    render(<MevLegend />);
    for (const meta of Object.values(TX_TYPE_META)) {
      // The label appears inside the chip.
      expect(screen.getAllByText(meta.label).length).toBeGreaterThanOrEqual(1);
      // The description is also rendered.
      expect(screen.getAllByText(meta.desc).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses the type color as the chip dot background', () => {
    render(<MevLegend />);
    const sandwich = screen.getByTestId('mev-legend-sandwich');
    const dot = sandwich.querySelector('[data-dot]') as HTMLElement;
    // JSDOM normalizes CSS colors to rgb() — check for the expected
    // normalized form of #ff5e5e.
    expect(dot.style.background).toBe('rgb(255, 94, 94)');
  });
});
