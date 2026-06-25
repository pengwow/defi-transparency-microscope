import { describe, it, expect } from 'vitest';
import { generateTransactions } from '../transactions';

describe('mocks/transactions', () => {
  describe('generateTransactions', () => {
    it('returns ~30 transactions by default', () => {
      const txs = generateTransactions();
      expect(txs.length).toBeGreaterThanOrEqual(28);
      expect(txs.length).toBeLessThanOrEqual(32);
    });

    it('has roughly 30% sandwich transactions', () => {
      const txs = generateTransactions();
      const sandwichTxs = txs.filter((tx) => tx.mevType === 'sandwich');
      // Allow some variance: 25% – 35%
      expect(sandwichTxs.length / txs.length).toBeGreaterThan(0.25);
      expect(sandwichTxs.length / txs.length).toBeLessThan(0.35);
    });

    it('includes a mix of MEV categories', () => {
      const txs = generateTransactions();
      const types = new Set(txs.map((tx) => tx.mevType));
      expect(types.has('sandwich')).toBe(true);
      expect(types.has('normal')).toBe(true);
    });

    it('has the correct transaction shape', () => {
      const txs = generateTransactions();
      for (const tx of txs) {
        expect(typeof tx.hash).toBe('string');
        expect(tx.hash.startsWith('0x')).toBe(true);
        expect(tx.blockNumber).toBeGreaterThan(0);
        expect(tx.timestamp).toBeGreaterThan(0);
        expect(typeof tx.from).toBe('string');
        expect(tx.from.startsWith('0x')).toBe(true);
        expect(tx.gasUsed >= 0n).toBe(true);
        expect(tx.gasPrice >= 0n).toBe(true);
        expect(['swap', 'add_liquidity', 'remove_liquidity', 'transfer', 'approve']).toContain(
          tx.type,
        );
        expect(['sandwich', 'arb', 'jit', 'liquidation', 'normal']).toContain(tx.mevType);
      }
    });

    it('sandwiches have frontrun + victim + backrun with same pool', () => {
      const txs = generateTransactions();
      const sandwiches = txs.filter((tx) => tx.mevType === 'sandwich');
      expect(sandwiches.length).toBeGreaterThan(0);
      for (const tx of sandwiches) {
        expect(tx.bundle).toBeDefined();
        expect(tx.bundle).toHaveLength(3);
        const [front, victim, back] = tx.bundle!;
        // All three legs share a pool
        const pool = front.swaps?.[0]?.pool;
        expect(victim.swaps?.[0]?.pool).toBe(pool);
        expect(back.swaps?.[0]?.pool).toBe(pool);
        // frontrun then victim then backrun, by block ordering
        expect(front.blockNumber).toBeLessThanOrEqual(victim.blockNumber);
        expect(victim.blockNumber).toBeLessThanOrEqual(back.blockNumber);
      }
    });

    it('is reproducible from the same seed', () => {
      const a = generateTransactions({ seed: 42 });
      const b = generateTransactions({ seed: 42 });
      expect(a.length).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        expect(a[i].hash).toBe(b[i].hash);
        expect(a[i].mevType).toBe(b[i].mevType);
      }
    });
  });
});
