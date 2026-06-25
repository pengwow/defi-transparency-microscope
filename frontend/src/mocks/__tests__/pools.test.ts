import { describe, it, expect } from 'vitest';
import { generatePools, TOKENS, getTokenByAddress } from '../pools';
import type { DexProtocol, Pool, PoolType } from '@/types';

describe('mocks/pools', () => {
  describe('TOKENS', () => {
    it('contains ETH, USDC, WBTC, and DAI', () => {
      const symbols = TOKENS.map((t) => t.symbol);
      expect(symbols).toContain('ETH');
      expect(symbols).toContain('USDC');
      expect(symbols).toContain('WBTC');
      expect(symbols).toContain('DAI');
    });

    it('tokens have unique addresses', () => {
      const addrs = TOKENS.map((t) => t.address);
      expect(new Set(addrs).size).toBe(addrs.length);
    });
  });

  describe('getTokenByAddress', () => {
    it('returns the matching token', () => {
      const eth = TOKENS.find((t) => t.symbol === 'ETH')!;
      expect(getTokenByAddress(eth.address).symbol).toBe('ETH');
    });

    it('throws for unknown address', () => {
      expect(() => getTokenByAddress('0xdeadbeef')).toThrow(/UNKNOWN_TOKEN/);
    });
  });

  describe('generatePools', () => {
    it('returns at least 5 pools', () => {
      const pools = generatePools();
      expect(pools.length).toBeGreaterThanOrEqual(5);
    });

    it('returns a mix of V2 and V3 protocols', () => {
      const pools = generatePools();
      const protocols = new Set(pools.map((p) => p.protocol));
      expect(protocols.has('uniswap_v2')).toBe(true);
      expect(protocols.has('uniswap_v3')).toBe(true);
    });

    it('returns pools with the correct shape', () => {
      const pools = generatePools();
      for (const p of pools) {
        expect(typeof p.address).toBe('string');
        expect(p.address.startsWith('0x')).toBe(true);
        const allowed: DexProtocol[] = [
          'uniswap_v2',
          'uniswap_v3',
          'sushiswap',
          'curve',
          'balancer',
        ];
        expect(allowed).toContain(p.protocol);
        const allowedTypes: PoolType[] = [
          'constant_product',
          'concentrated',
          'stable',
          'weighted',
        ];
        expect(allowedTypes).toContain(p.type);
        expect(p.token0.address).toMatch(/^0x/);
        expect(p.token1.address).toMatch(/^0x/);
        expect(p.reserve0 > 0n).toBe(true);
        expect(p.reserve1 > 0n).toBe(true);
        expect(p.fee).toBeGreaterThan(0);
        expect(p.blockNumber).toBeGreaterThan(0);
        expect(p.timestamp).toBeGreaterThan(0);
      }
    });

    it('uses ETH, USDC, WBTC, and DAI somewhere in the pools', () => {
      const pools = generatePools();
      const allSymbols = new Set<string>();
      for (const p of pools) {
        allSymbols.add(p.token0.symbol);
        allSymbols.add(p.token1.symbol);
      }
      expect(allSymbols.has('ETH')).toBe(true);
      expect(allSymbols.has('USDC')).toBe(true);
      expect(allSymbols.has('WBTC')).toBe(true);
      expect(allSymbols.has('DAI')).toBe(true);
    });

    it('V3 pools have sqrtPriceX96 and tick fields', () => {
      const pools = generatePools();
      const v3 = pools.find((p) => p.protocol === 'uniswap_v3');
      expect(v3).toBeDefined();
      const v3Pool = v3 as Pool;
      expect(v3Pool.sqrtPriceX96 !== undefined).toBe(true);
      expect(v3Pool.tick !== undefined).toBe(true);
      expect(v3Pool.sqrtPriceX96! > 0n).toBe(true);
    });

    it('V2 pools have a totalSupply', () => {
      const pools = generatePools();
      const v2 = pools.find((p) => p.protocol === 'uniswap_v2');
      expect(v2).toBeDefined();
      const v2Pool = v2 as Pool;
      expect(v2Pool.totalSupply !== undefined).toBe(true);
      expect(v2Pool.totalSupply! > 0n).toBe(true);
    });

    it('is reproducible when called with the same seed', () => {
      const a = generatePools({ seed: 1234 });
      const b = generatePools({ seed: 1234 });
      expect(a.length).toBe(b.length);
      for (let i = 0; i < a.length; i++) {
        expect(a[i].address).toBe(b[i].address);
        expect(a[i].reserve0).toBe(b[i].reserve0);
        expect(a[i].reserve1).toBe(b[i].reserve1);
      }
    });
  });
});
