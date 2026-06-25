/**
 * Tests for the ScenarioList component.
 *
 * Verifies the clickable list of scenarios, the active state, and
 * the empty state.
 */

import { describe, expect, it, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ScenarioList } from './ScenarioList';
import type { ExperimentPreset } from '@/services/api';

afterEach(() => {
  cleanup();
});

function makePreset(over: Partial<ExperimentPreset> = {}): ExperimentPreset {
  return {
    id: 'a',
    name: 'Scenario A',
    description: 'First scenario',
    config: {
      name: 'Scenario A',
      protocol: 'uniswap_v2',
      reserve0: 1n,
      reserve1: 1n,
      fee: 3000,
      runs: 1,
    },
    ...over,
  };
}

describe('ScenarioList', () => {
  it('renders a row per scenario', () => {
    const presets = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    render(
      <ScenarioList
        scenarios={presets}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the name and description of each scenario', () => {
    const presets = [makePreset({ id: 'a', name: 'Foo', description: 'Foo is great' })];
    render(
      <ScenarioList
        scenarios={presets}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText('Foo')).toBeInTheDocument();
    expect(screen.getByText('Foo is great')).toBeInTheDocument();
  });

  it('invokes onSelect with the id of the clicked row', () => {
    const cb = vi.fn();
    const presets = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    render(
      <ScenarioList
        scenarios={presets}
        selectedId={null}
        onSelect={cb}
      />,
    );
    fireEvent.click(screen.getAllByRole('button')[1]);
    expect(cb).toHaveBeenCalledWith('b');
  });

  it('marks the selected row with data-active="true"', () => {
    const presets = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    render(
      <ScenarioList
        scenarios={presets}
        selectedId="b"
        onSelect={() => undefined}
      />,
    );
    const rows = screen.getAllByRole('button');
    expect(rows[0].getAttribute('data-active')).toBe('false');
    expect(rows[1].getAttribute('data-active')).toBe('true');
  });

  it('renders an empty state when there are no scenarios', () => {
    render(
      <ScenarioList
        scenarios={[]}
        selectedId={null}
        onSelect={() => undefined}
      />,
    );
    expect(screen.getByText(/no scenarios/i)).toBeInTheDocument();
  });
});
