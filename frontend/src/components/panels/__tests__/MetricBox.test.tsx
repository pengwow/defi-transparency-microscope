/**
 * Tests for MetricBox — single labelled value tile with optional
 * trend indicator.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricBox } from '../MetricBox';

describe('MetricBox', () => {
  it('renders label and value', () => {
    render(<MetricBox label="Total" value="$100" testId="metric" />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('$100')).toBeInTheDocument();
    expect(screen.getByTestId('metric')).toBeInTheDocument();
  });

  it('applies the trend-up class for trend="up"', () => {
    render(<MetricBox label="P" value="1" trend="up" testId="up-metric" />);
    expect(screen.getByTestId('up-metric').className).toContain('is-up');
  });

  it('applies the trend-down class for trend="down"', () => {
    render(<MetricBox label="P" value="1" trend="down" testId="down-metric" />);
    expect(screen.getByTestId('down-metric').className).toContain('is-down');
  });

  it('applies the trend-flat class for trend="flat"', () => {
    render(<MetricBox label="P" value="1" trend="flat" testId="flat-metric" />);
    expect(screen.getByTestId('flat-metric').className).toContain('is-flat');
  });
});
