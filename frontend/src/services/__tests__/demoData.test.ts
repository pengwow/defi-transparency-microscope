/**
 * Tests for the demo data factory service.
 */

import { describe, expect, it } from 'vitest';
import { makeTransaction, makeLendingPosition, TX_TYPE_KEYS, type TxType } from '../demoData';

describe('makeTransaction', () => {
  it('produces a 64-char hex hash', () => {
    const tx = makeTransaction('sandwich');
    expect(tx.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });
  it('uses the requested type', () => {
    const tx = makeTransaction('liquidation');
    expect(tx.type).toBe('liquidation');
  });
  it('picks a random type when none given', () => {
    const tx = makeTransaction();
    expect(TX_TYPE_KEYS).toContain(tx.type as TxType);
  });
  it('attaches mevType equal to type for non-normal', () => {
    const tx = makeTransaction('jit');
    expect(tx.mevType).toBe('jit');
  });
});

describe('makeLendingPosition', () => {
  it('produces a position with valid HF', () => {
    const p = makeLendingPosition('AaveV3');
    expect(['safe', 'warning', 'danger', 'liquidated']).toContain(p.status);
    expect(p.healthFactor).toBeGreaterThan(0);
  });
});
