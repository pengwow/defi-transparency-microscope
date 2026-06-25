/**
 * Tests for ExplainBox — the cyan-bordered "info" callout used across
 * pages to introduce a concept.
 *
 * Variants:
 *   - default  → cyan top border + grey body
 *   - warning  → amber top border
 *   - danger   → coral top border
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExplainBox } from '../ExplainBox';

describe('ExplainBox', () => {
  it('renders children and uses the cyan-bordered variant by default', () => {
    const { container } = render(
      <ExplainBox>
        <p>explanation body</p>
      </ExplainBox>,
    );
    expect(screen.getByText('explanation body')).toBeInTheDocument();
    const box = container.querySelector('.dtm-explain-box');
    expect(box).not.toBeNull();
  });

  it('applies the warning class for variant="warning"', () => {
    const { container } = render(
      <ExplainBox variant="warning">
        <p>warning body</p>
      </ExplainBox>,
    );
    const box = container.querySelector('.dtm-explain-box');
    expect(box?.className).toContain('is-warning');
  });

  it('applies the danger class for variant="danger"', () => {
    const { container } = render(
      <ExplainBox variant="danger">
        <p>danger body</p>
      </ExplainBox>,
    );
    const box = container.querySelector('.dtm-explain-box');
    expect(box?.className).toContain('is-danger');
  });
});
