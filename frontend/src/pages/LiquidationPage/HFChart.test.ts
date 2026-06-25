/**
 * Tests for the LiquidationPage HFChart (bar chart of health factors).
 */

import { describe, expect, it } from 'vitest';
import { draw } from './HFChart';
import { makeMockCtx } from '@/canvas/__tests__/_helpers';
import type { LendingPosition } from '@/types';

function makePos(id: string, coll: bigint, debt: bigint, thr: bigint): LendingPosition {
  return {
    id,
    owner: '0xowner',
    protocol: 'aave_v3',
    timestamp: 1_700_000_000,
    collateral: { '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': coll },
    debt: { '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': debt },
    liquidationThresholdE18: thr,
  };
}

describe('Liquidation HFChart (bar chart)', () => {
  it('draws without throwing for an empty list', () => {
    const ctx = makeMockCtx();
    expect(() => draw(ctx as unknown as CanvasRenderingContext2D, { width: 200, height: 100 }, { positions: [], threshold: 1 })).not.toThrow();
  });

  it('draws without throwing for a populated list', () => {
    const ctx = makeMockCtx();
    const positions = [
      makePos('a', 10n * 10n ** 18n, 1_000n * 10n ** 6n, 80_000n * 10n ** 18n),
      makePos('b', 5n * 10n ** 18n, 4_000n * 10n ** 6n, 80_000n * 10n ** 18n),
    ];
    expect(() => draw(ctx as unknown as CanvasRenderingContext2D, { width: 400, height: 200 }, { positions, threshold: 1 })).not.toThrow();
  });
});
