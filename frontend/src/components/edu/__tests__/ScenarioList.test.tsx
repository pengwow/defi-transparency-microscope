/**
 * Tests for ScenarioList — 5 MEV scenario cards laid out horizontally
 * on the Education tab.
 *
 *   🥪 三明治       (sandwich)
 *   🎯 JIT          (jit)
 *   ⚡ 套利         (arbitrage)
 *   💥 清算         (liquidation)
 *   🐢 前跑         (front-running)
 *
 * The active card (driven by `eduStore.activeScenario`) shows the
 * `is-active` class.  Clicking a card calls
 * `useEduStore.setActiveScenario(scenario)`.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ScenarioList } from '../ScenarioList';
import { useEduStore } from '@/store/eduStore';

describe('ScenarioList', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('renders the panel root', () => {
    render(<ScenarioList />);
    expect(screen.getByTestId('edu-scenario-list-panel')).toBeInTheDocument();
  });

  it('renders all 5 scenario cards', () => {
    render(<ScenarioList />);
    expect(screen.getByTestId('edu-scenario-sandwich')).toBeInTheDocument();
    expect(screen.getByTestId('edu-scenario-jit')).toBeInTheDocument();
    expect(screen.getByTestId('edu-scenario-arbitrage')).toBeInTheDocument();
    expect(screen.getByTestId('edu-scenario-liquidation')).toBeInTheDocument();
    expect(screen.getByTestId('edu-scenario-front-running')).toBeInTheDocument();
  });

  it('marks the default active scenario (sandwich) as active', () => {
    render(<ScenarioList />);
    expect(
      screen.getByTestId('edu-scenario-sandwich').getAttribute('data-active'),
    ).toBe('true');
    expect(
      screen.getByTestId('edu-scenario-jit').getAttribute('data-active'),
    ).toBe('false');
  });

  it('clicking a card triggers setActiveScenario', () => {
    render(<ScenarioList />);
    act(() => {
      fireEvent.click(screen.getByTestId('edu-scenario-jit'));
    });
    expect(useEduStore.getState().activeScenario).toBe('jit');
  });

  it('after clicking, the previously-inactive card is now active', () => {
    render(<ScenarioList />);
    act(() => {
      fireEvent.click(screen.getByTestId('edu-scenario-arbitrage'));
    });
    expect(
      screen.getByTestId('edu-scenario-arbitrage').getAttribute('data-active'),
    ).toBe('true');
    expect(
      screen.getByTestId('edu-scenario-sandwich').getAttribute('data-active'),
    ).toBe('false');
  });
});
