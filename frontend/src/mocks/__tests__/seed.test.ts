import { describe, it, expect } from 'vitest';
import { createRng, randomBetween, randomBigInt } from '../seed';

describe('seed (deterministic RNG)', () => {
  describe('createRng', () => {
    it('returns a function that produces numbers in [0, 1)', () => {
      const rng = createRng(42);
      for (let i = 0; i < 100; i++) {
        const v = rng();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('is reproducible from the same seed', () => {
      const a = createRng(123);
      const b = createRng(123);
      const seqA = Array.from({ length: 20 }, () => a());
      const seqB = Array.from({ length: 20 }, () => b());
      expect(seqA).toEqual(seqB);
    });

    it('produces different sequences for different seeds', () => {
      const a = createRng(1);
      const b = createRng(2);
      const seqA = Array.from({ length: 10 }, () => a());
      const seqB = Array.from({ length: 10 }, () => b());
      expect(seqA).not.toEqual(seqB);
    });
  });

  describe('randomBetween', () => {
    it('returns integers within the inclusive range', () => {
      const rng = createRng(7);
      for (let i = 0; i < 200; i++) {
        const v = randomBetween(rng, 5, 10);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
      }
    });

    it('is reproducible from the same seed', () => {
      const a = createRng(99);
      const b = createRng(99);
      const seqA = Array.from({ length: 50 }, () => randomBetween(a, 0, 1000));
      const seqB = Array.from({ length: 50 }, () => randomBetween(b, 0, 1000));
      expect(seqA).toEqual(seqB);
    });

    it('returns min when min === max', () => {
      const rng = createRng(0);
      expect(randomBetween(rng, 7, 7)).toBe(7);
    });
  });

  describe('randomBigInt', () => {
    it('returns bigints within the inclusive range', () => {
      const rng = createRng(2024);
      const lo = 10n ** 18n;
      const hi = 10n ** 21n;
      for (let i = 0; i < 100; i++) {
        const v = randomBigInt(rng, lo, hi);
        expect(typeof v).toBe('bigint');
        expect(v >= lo).toBe(true);
        expect(v <= hi).toBe(true);
      }
    });

    it('is reproducible from the same seed', () => {
      const a = createRng(7);
      const b = createRng(7);
      const seqA = Array.from({ length: 20 }, () => randomBigInt(a, 0n, 10n ** 24n));
      const seqB = Array.from({ length: 20 }, () => randomBigInt(b, 0n, 10n ** 24n));
      expect(seqA).toEqual(seqB);
    });

    it('returns lo when lo === hi', () => {
      const rng = createRng(0);
      expect(randomBigInt(rng, 42n, 42n)).toBe(42n);
    });
  });
});
