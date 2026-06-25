import { describe, it, expect, beforeEach } from 'vitest';
import { useExperimentStore } from '../experimentStore';

describe('store/experimentStore', () => {
  beforeEach(() => {
    useExperimentStore.getState().reset();
  });

  it('initial state has no scenarios and step 0', () => {
    const s = useExperimentStore.getState();
    expect(s.scenarios).toEqual([]);
    expect(s.parameters).toEqual({});
    expect(s.step).toBe(0);
    expect(s.opened).toBeNull();
  });

  it('loadList stores the list of scenarios', () => {
    useExperimentStore.getState().loadList([
      {
        id: 'a',
        name: 'A',
        description: '',
        config: { name: 'A', protocol: 'uniswap_v2', reserve0: 1n, reserve1: 1n, fee: 3000, runs: 1 },
      },
      {
        id: 'b',
        name: 'B',
        description: '',
        config: { name: 'B', protocol: 'uniswap_v3', reserve0: 1n, reserve1: 1n, fee: 500, runs: 1 },
      },
    ]);
    expect(useExperimentStore.getState().scenarios).toHaveLength(2);
  });

  it('open selects a scenario and seeds its parameters', () => {
    useExperimentStore.getState().loadList([
      {
        id: 'a',
        name: 'A',
        description: '',
        config: { name: 'A', protocol: 'uniswap_v2', reserve0: 100n, reserve1: 200n, fee: 3000, runs: 5 },
      },
    ]);
    useExperimentStore.getState().open('a');
    const s = useExperimentStore.getState();
    expect(s.opened?.id).toBe('a');
    expect(s.parameters.reserve0).toBe(100n);
    expect(s.parameters.fee).toBe(3000);
    expect(s.parameters.runs).toBe(5);
  });

  it('setParam updates a parameter and resets the step counter', () => {
    useExperimentStore.getState().loadList([
      {
        id: 'a',
        name: 'A',
        description: '',
        config: { name: 'A', protocol: 'uniswap_v2', reserve0: 1n, reserve1: 1n, fee: 3000, runs: 5 },
      },
    ]);
    useExperimentStore.getState().open('a');
    useExperimentStore.getState().nextStep();
    useExperimentStore.getState().nextStep();
    expect(useExperimentStore.getState().step).toBe(2);
    useExperimentStore.getState().setParam('fee', 500);
    const s = useExperimentStore.getState();
    expect(s.parameters.fee).toBe(500);
    expect(s.step).toBe(0);
  });

  it('nextStep advances the step counter and caps at runs - 1', () => {
    useExperimentStore.getState().loadList([
      {
        id: 'a',
        name: 'A',
        description: '',
        config: { name: 'A', protocol: 'uniswap_v2', reserve0: 1n, reserve1: 1n, fee: 3000, runs: 3 },
      },
    ]);
    useExperimentStore.getState().open('a');
    useExperimentStore.getState().nextStep();
    expect(useExperimentStore.getState().step).toBe(1);
    useExperimentStore.getState().nextStep();
    useExperimentStore.getState().nextStep();
    useExperimentStore.getState().nextStep();
    // Capped at runs - 1
    expect(useExperimentStore.getState().step).toBe(2);
  });

  it('reset returns the store to its initial state', () => {
    useExperimentStore.getState().loadList([
      {
        id: 'a',
        name: 'A',
        description: '',
        config: { name: 'A', protocol: 'uniswap_v2', reserve0: 1n, reserve1: 1n, fee: 3000, runs: 1 },
      },
    ]);
    useExperimentStore.getState().open('a');
    useExperimentStore.getState().nextStep();
    useExperimentStore.getState().reset();
    const s = useExperimentStore.getState();
    expect(s.scenarios).toEqual([]);
    expect(s.parameters).toEqual({});
    expect(s.step).toBe(0);
    expect(s.opened).toBeNull();
  });

  it('open with an unknown id throws', () => {
    useExperimentStore.getState().loadList([
      {
        id: 'a',
        name: 'A',
        description: '',
        config: { name: 'A', protocol: 'uniswap_v2', reserve0: 1n, reserve1: 1n, fee: 3000, runs: 1 },
      },
    ]);
    expect(() => useExperimentStore.getState().open('zzz')).toThrow(/UNKNOWN_SCENARIO/);
  });
});
