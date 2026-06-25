/**
 * Tests for the chain name resolver.
 *
 * Per spec: 1→mainnet, 11155111→sepolia, 137→polygon, 42161→arbitrum,
 * 8453→base, else `chain-${id}`. This module is independent of the
 * existing `defaultChainName` in `routes/health.ts` (which uses a slightly
 * different fallback format `chain:${id}`) — the new resolver lives in
 * `chain/chainName.ts` and is the canonical implementation for the
 * `chain/*` layer.
 */
import { describe, it, expect } from 'vitest';
import { resolveChainName } from '../../src/chain/chainName.js';

describe('resolveChainName', () => {
  describe('known chainIds', () => {
    it('maps 1 to "mainnet"', () => {
      expect(resolveChainName(1)).toBe('mainnet');
    });

    it('maps 11155111 to "sepolia"', () => {
      expect(resolveChainName(11155111)).toBe('sepolia');
    });

    it('maps 137 to "polygon"', () => {
      expect(resolveChainName(137)).toBe('polygon');
    });

    it('maps 42161 to "arbitrum"', () => {
      expect(resolveChainName(42161)).toBe('arbitrum');
    });

    it('maps 8453 to "base"', () => {
      expect(resolveChainName(8453)).toBe('base');
    });
  });

  describe('unknown chainIds', () => {
    it('returns "chain-<id>" for unmapped chains', () => {
      expect(resolveChainName(999)).toBe('chain-999');
      expect(resolveChainName(12345)).toBe('chain-12345');
      expect(resolveChainName(42)).toBe('chain-42');
    });

    it('does not collide with the named chains', () => {
      // Make sure no well-known id is also matched by the fallback
      expect(resolveChainName(1)).not.toBe('chain-1');
      expect(resolveChainName(137)).not.toBe('chain-137');
    });
  });

  describe('idempotence and purity', () => {
    it('returns a string for every input', () => {
      for (const id of [1, 137, 42161, 8453, 11155111, 0, 99, 999_999]) {
        expect(typeof resolveChainName(id)).toBe('string');
      }
    });

    it('is a pure function (no side effects across calls)', () => {
      expect(resolveChainName(1)).toBe('mainnet');
      expect(resolveChainName(1)).toBe('mainnet');
      expect(resolveChainName(137)).toBe('polygon');
      expect(resolveChainName(1)).toBe('mainnet');
    });
  });
});
