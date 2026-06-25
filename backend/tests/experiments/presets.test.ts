/**
 * Tests for `experiments/presets.ts` — in-memory experiment presets.
 *
 * - Exactly 4 presets (matching the frontend `EXPERIMENT_PRESETS`).
 * - `getExperimentById` returns the matching preset.
 * - Unknown id returns `undefined` (not throw — the route maps to 404).
 * - Preset ids are unique.
 * - Each preset has the expected shape (id, name, description, config).
 */
import { describe, it, expect } from 'vitest';

import { EXPERIMENT_PRESETS, getExperimentById } from '../../src/experiments/presets.js';

describe('experiments/presets', () => {
  it('exposes exactly 4 presets', () => {
    expect(EXPERIMENT_PRESETS).toHaveLength(4);
  });

  it('preset ids are unique', () => {
    const ids = EXPERIMENT_PRESETS.map((p) => p.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('every preset has the required shape', () => {
    for (const p of EXPERIMENT_PRESETS) {
      expect(p.id).toBeTypeOf('string');
      expect(p.id.length).toBeGreaterThan(0);
      expect(p.name).toBeTypeOf('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.description).toBeTypeOf('string');
      expect(p.description.length).toBeGreaterThan(0);
      expect(p.config).toBeDefined();
      expect(p.config.name).toBeTypeOf('string');
      expect(['uniswap_v2', 'uniswap_v3']).toContain(p.config.protocol);
      expect(typeof p.config.fee).toBe('number');
      expect(typeof p.config.runs).toBe('number');
      expect(p.config.reserve0).toBeDefined();
      expect(p.config.reserve1).toBeDefined();
    }
  });

  it('getExperimentById returns the matching preset', () => {
    for (const p of EXPERIMENT_PRESETS) {
      const found = getExperimentById(p.id);
      expect(found).toBeDefined();
      expect(found?.id).toBe(p.id);
    }
  });

  it('getExperimentById returns undefined for an unknown id', () => {
    expect(getExperimentById('does-not-exist')).toBeUndefined();
    expect(getExperimentById('')).toBeUndefined();
  });

  it('contains the canonical 4 experiments (sandwich-eth-usdc, sandwich-wbtc-eth-v3, il-eth-usdc, attribution-eth-usdc)', () => {
    const ids = EXPERIMENT_PRESETS.map((p) => p.id).sort();
    expect(ids).toEqual(
      [
        'attribution-eth-usdc',
        'il-eth-usdc',
        'sandwich-eth-usdc',
        'sandwich-wbtc-eth-v3',
      ].sort(),
    );
  });
});
