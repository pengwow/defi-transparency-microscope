/**
 * Tests for the MevAttribution row-list.
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MevAttribution } from '../MevAttribution';

describe('MevAttribution', () => {
  it('renders five category rows', () => {
    render(<MevAttribution />);
    expect(screen.getAllByTestId(/^mev-attr-row-/).length).toBe(5);
  });

  it('shows the percentage and profit for the dominant category', () => {
    render(<MevAttribution />);
    const sandwich = screen.getByTestId('mev-attr-row-sandwich');
    expect(sandwich.textContent).toMatch(/38/);
    expect(sandwich.textContent).toMatch(/\$\d/);
  });
});
