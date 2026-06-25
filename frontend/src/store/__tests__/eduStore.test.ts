/**
 * Tests for the `eduStore` — drives the Education tab's scenario
 * selector, 3 parameter sliders, and step index.
 *
 *   - default scenario is 'sandwich'
 *   - setActiveScenario updates state
 *   - setSlider updates each of the 3 slider values
 *   - setStepIndex updates state
 *   - reset restores defaults
 *   - the SCENARIO list contains all 5 expected keys
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { useEduStore, EDU_SCENARIOS } from '../eduStore';

describe('eduStore', () => {
  beforeEach(() => {
    useEduStore.getState().reset();
  });

  it('defaults to sandwich scenario', () => {
    expect(useEduStore.getState().activeScenario).toBe('sandwich');
  });

  it('starts with the default slider values', () => {
    const s = useEduStore.getState();
    expect(s.sliders.swapSize).toBe(10);
    expect(s.sliders.liquidity).toBe(1000);
    expect(s.sliders.gasPrice).toBe(50);
  });

  it('starts with stepIndex 0', () => {
    expect(useEduStore.getState().stepIndex).toBe(0);
  });

  it('exposes all 5 scenarios', () => {
    expect(EDU_SCENARIOS).toEqual(
      expect.arrayContaining(['sandwich', 'jit', 'arbitrage', 'liquidation', 'front-running']),
    );
    expect(EDU_SCENARIOS.length).toBe(5);
  });

  it('setActiveScenario updates the state', () => {
    useEduStore.getState().setActiveScenario('jit');
    expect(useEduStore.getState().activeScenario).toBe('jit');
  });

  it('setSlider updates each slider independently', () => {
    useEduStore.getState().setSlider('swapSize', 42);
    expect(useEduStore.getState().sliders.swapSize).toBe(42);
    useEduStore.getState().setSlider('liquidity', 5000);
    expect(useEduStore.getState().sliders.liquidity).toBe(5000);
    useEduStore.getState().setSlider('gasPrice', 120);
    expect(useEduStore.getState().sliders.gasPrice).toBe(120);
  });

  it('setStepIndex updates the step', () => {
    useEduStore.getState().setStepIndex(3);
    expect(useEduStore.getState().stepIndex).toBe(3);
  });

  it('reset restores all defaults', () => {
    useEduStore.getState().setActiveScenario('liquidation');
    useEduStore.getState().setSlider('swapSize', 99);
    useEduStore.getState().setStepIndex(4);
    useEduStore.getState().reset();
    const s = useEduStore.getState();
    expect(s.activeScenario).toBe('sandwich');
    expect(s.sliders.swapSize).toBe(10);
    expect(s.sliders.liquidity).toBe(1000);
    expect(s.sliders.gasPrice).toBe(50);
    expect(s.stepIndex).toBe(0);
  });
});
