/**
 * Tests for Panel — the cross-page container primitive.
 *
 * Verifies:
 *   - title + children render
 *   - clicking the header toggles collapsed
 *   - the right slot is rendered
 *   - defaultCollapsed starts the panel collapsed
 *   - dotColor styles the leading dot
 */

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Panel } from '../Panel';

describe('Panel', () => {
  it('renders the title and children', () => {
    render(
      <Panel title="My Panel" testId="my-panel">
        <span>body</span>
      </Panel>,
    );
    expect(screen.getByText('My Panel')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
    expect(screen.getByTestId('my-panel')).toBeInTheDocument();
  });

  it('toggles collapsed when the header is clicked', () => {
    render(
      <Panel title="Toggle Me" testId="toggle-panel">
        <span>content</span>
      </Panel>,
    );
    const panel = screen.getByTestId('toggle-panel');
    expect(panel.className).not.toContain('is-collapsed');
    fireEvent.click(panel.querySelector('.dtm-panel-header')!);
    expect(panel.className).toContain('is-collapsed');
    fireEvent.click(panel.querySelector('.dtm-panel-header')!);
    expect(panel.className).not.toContain('is-collapsed');
  });

  it('renders the right slot next to the title', () => {
    render(
      <Panel
        title="With Right"
        testId="right-panel"
        right={<span data-testid="right-slot">live</span>}
      >
        <span>body</span>
      </Panel>,
    );
    expect(screen.getByTestId('right-slot')).toBeInTheDocument();
  });

  it('starts collapsed when defaultCollapsed is true', () => {
    render(
      <Panel title="Default Collapsed" defaultCollapsed testId="collapsed-panel">
        <span>hidden</span>
      </Panel>,
    );
    expect(screen.getByTestId('collapsed-panel').className).toContain('is-collapsed');
  });

  it('uses a custom dot color when dotColor is given', () => {
    render(
      <Panel title="Colored" dotColor="rgb(255, 0, 0)" testId="colored-panel">
        <span>body</span>
      </Panel>,
    );
    const dot = screen.getByTestId('colored-panel').querySelector('.dtm-panel-dot') as HTMLElement;
    expect(dot.style.background).toBe('rgb(255, 0, 0)');
  });
});
