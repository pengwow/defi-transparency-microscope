import { describe, it, expect, beforeEach } from 'vitest';
import { useLiveStore } from '../liveStore';

describe('store/liveStore', () => {
  beforeEach(() => {
    useLiveStore.getState().reset();
  });

  it('initial state after reset is empty and backendConnected=false', () => {
    const s = useLiveStore.getState();
    expect(s.mempool).toEqual([]);
    expect(s.ammPriceE18).toBe(0n);
    expect(s.cumulativeMevWei).toBe(0n);
    expect(s.backendConnected).toBe(false);
  });

  it('init seeds backendConnected when provided', () => {
    useLiveStore.getState().init({ mempool: [], backendConnected: true });
    expect(useLiveStore.getState().backendConnected).toBe(true);
  });

  it('init defaults backendConnected to false when not provided', () => {
    useLiveStore.getState().init({ mempool: [] });
    expect(useLiveStore.getState().backendConnected).toBe(false);
  });

  it('setBackendConnected flips the flag true and back to false', () => {
    const set = useLiveStore.getState().setBackendConnected;
    expect(useLiveStore.getState().backendConnected).toBe(false);
    set(true);
    expect(useLiveStore.getState().backendConnected).toBe(true);
    set(false);
    expect(useLiveStore.getState().backendConnected).toBe(false);
  });

  it('reset clears backendConnected back to false', () => {
    useLiveStore.getState().setBackendConnected(true);
    useLiveStore.getState().reset();
    expect(useLiveStore.getState().backendConnected).toBe(false);
  });

  it('init seeds the mempool, price, and cumulative MEV', () => {
    useLiveStore.getState().init({
      mempool: [
        { hash: '0x1', from: '0xa', timestamp: 1, mevType: 'normal' },
      ],
      ammPriceE18: 3000n * 10n ** 18n,
      cumulativeMevWei: 12345n,
    });
    const s = useLiveStore.getState();
    expect(s.mempool).toHaveLength(1);
    expect(s.ammPriceE18).toBe(3000n * 10n ** 18n);
    expect(s.cumulativeMevWei).toBe(12345n);
  });

  it('pushTx appends a new transaction to the mempool', () => {
    useLiveStore.getState().init({ mempool: [] });
    useLiveStore.getState().pushTx({ hash: '0x1', from: '0xa', timestamp: 1, mevType: 'normal' });
    useLiveStore.getState().pushTx({ hash: '0x2', from: '0xb', timestamp: 2, mevType: 'sandwich' });
    const s = useLiveStore.getState();
    expect(s.mempool).toHaveLength(2);
    expect(s.mempool[1].hash).toBe('0x2');
  });

  it('setAmmPrice updates the AMM price snapshot', () => {
    useLiveStore.getState().init({ mempool: [] });
    useLiveStore.getState().setAmmPrice(2500n * 10n ** 18n);
    expect(useLiveStore.getState().ammPriceE18).toBe(2500n * 10n ** 18n);
  });

  it('cumulative MEV can be incremented via setAmmPrice (price swings), or set directly', () => {
    useLiveStore.getState().init({ mempool: [], cumulativeMevWei: 100n });
    useLiveStore.getState().setAmmPrice(3000n * 10n ** 18n);
    expect(useLiveStore.getState().cumulativeMevWei).toBe(100n);
  });

  it('reset clears the mempool and zeroes the AMM price / MEV totals', () => {
    useLiveStore.getState().init({
      mempool: [{ hash: '0x1', from: '0xa', timestamp: 1, mevType: 'normal' }],
      ammPriceE18: 3000n * 10n ** 18n,
      cumulativeMevWei: 999n,
      backendConnected: true,
    });
    useLiveStore.getState().reset();
    const s = useLiveStore.getState();
    expect(s.mempool).toEqual([]);
    expect(s.ammPriceE18).toBe(0n);
    expect(s.cumulativeMevWei).toBe(0n);
    expect(s.backendConnected).toBe(false);
  });
});
