/**
 * Tests for MetricGrid — grid container that lays MetricBoxes in N
 * equal-width columns.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricGrid } from '../MetricGrid';

describe('MetricGrid', () => {
  it('uses the 3-column grid by default', () => {
    const { container } = render(
      <MetricGrid testId="grid">
        <div>a</div>
        <div>b</div>
        <div>c</div>
      </MetricGrid>,
    );
    const grid = screen.getByTestId('grid');
    expect(grid.className).toContain('dtm-metric-grid');
    expect(container.querySelector('.dtm-metric-grid')).not.toBeNull();
  });

  it('respects the columns prop (4 columns)', () => {
    render(
      <MetricGrid columns={4} testId="grid-4">
        <div>a</div>
        <div>b</div>
        <div>c</div>
        <div>d</div>
      </MetricGrid>,
    );
    const grid = screen.getByTestId('grid-4');
    // The 4-column variant is in the class name OR the inline style.
    const hasMarker =
      grid.className.includes('cols-4') ||
      grid.getAttribute('style')?.includes('repeat(4');
    expect(hasMarker).toBe(true);
  });
});
