import { describe, it, expect } from 'vitest';
import { Interface, type InterfaceAbi, type Fragment } from 'ethers';
import {
  ERC20_ABI,
  ERC721_ABI,
  UNISWAP_V2_PAIR_ABI,
  UNISWAP_V3_POOL_ABI,
  AAVE_V3_POOL_DATA_PROVIDER_ABI,
  AAVE_V3_POOL_ABI,
  ABIS,
} from '../../src/chain/abis.js';

function isFragmentArray(value: unknown): value is readonly Fragment[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (f) => (typeof f === 'object' && f !== null) || typeof f === 'string',
  );
}

function canBuildInterface(abi: InterfaceAbi): boolean {
  try {
    new Interface(abi);
    return true;
  } catch {
    return false;
  }
}

describe('ABIs', () => {
  describe('ERC20_ABI', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(ERC20_ABI)).toBe(true);
      expect(ERC20_ABI.length).toBeGreaterThan(0);
      expect(isFragmentArray(ERC20_ABI)).toBe(true);
    });

    it('builds a valid Interface with ethers', () => {
      expect(canBuildInterface(ERC20_ABI)).toBe(true);
    });

    it('contains symbol, decimals, balanceOf', () => {
      const iface = new Interface(ERC20_ABI);
      expect(Object.keys(iface.getFunction('symbol()') ?? {})).toBeDefined();
      expect(iface.hasFunction('symbol()')).toBe(true);
      expect(iface.hasFunction('decimals()')).toBe(true);
      expect(iface.hasFunction('balanceOf(address)')).toBe(true);
    });
  });

  describe('ERC721_ABI', () => {
    it('is a non-empty array and valid Interface', () => {
      expect(ERC721_ABI.length).toBeGreaterThan(0);
      expect(canBuildInterface(ERC721_ABI)).toBe(true);
    });

    it('contains balanceOf, tokenOfOwnerByIndex, ownerOf, name', () => {
      const iface = new Interface(ERC721_ABI);
      expect(iface.hasFunction('balanceOf(address)')).toBe(true);
      expect(iface.hasFunction('tokenOfOwnerByIndex(address,uint256)')).toBe(true);
      expect(iface.hasFunction('ownerOf(uint256)')).toBe(true);
      expect(iface.hasFunction('name()')).toBe(true);
    });
  });

  describe('UNISWAP_V2_PAIR_ABI', () => {
    it('is a non-empty array and valid Interface', () => {
      expect(UNISWAP_V2_PAIR_ABI.length).toBeGreaterThan(0);
      expect(canBuildInterface(UNISWAP_V2_PAIR_ABI)).toBe(true);
    });

    it('contains getReserves, token0, token1', () => {
      const iface = new Interface(UNISWAP_V2_PAIR_ABI);
      expect(iface.hasFunction('getReserves()')).toBe(true);
      expect(iface.hasFunction('token0()')).toBe(true);
      expect(iface.hasFunction('token1()')).toBe(true);
    });

    it('contains Swap and Sync events', () => {
      const iface = new Interface(UNISWAP_V2_PAIR_ABI);
      expect(iface.hasEvent('Swap')).toBe(true);
      expect(iface.hasEvent('Sync')).toBe(true);
    });
  });

  describe('UNISWAP_V3_POOL_ABI', () => {
    it('is a non-empty array and valid Interface', () => {
      expect(UNISWAP_V3_POOL_ABI.length).toBeGreaterThan(0);
      expect(canBuildInterface(UNISWAP_V3_POOL_ABI)).toBe(true);
    });

    it('contains slot0, liquidity, token0, token1, fee', () => {
      const iface = new Interface(UNISWAP_V3_POOL_ABI);
      expect(iface.hasFunction('slot0()')).toBe(true);
      expect(iface.hasFunction('liquidity()')).toBe(true);
      expect(iface.hasFunction('token0()')).toBe(true);
      expect(iface.hasFunction('token1()')).toBe(true);
      expect(iface.hasFunction('fee()')).toBe(true);
    });

    it('contains Swap event', () => {
      const iface = new Interface(UNISWAP_V3_POOL_ABI);
      expect(iface.hasEvent('Swap')).toBe(true);
    });
  });

  describe('AAVE_V3_POOL_DATA_PROVIDER_ABI', () => {
    it('is a non-empty array and valid Interface', () => {
      expect(AAVE_V3_POOL_DATA_PROVIDER_ABI.length).toBeGreaterThan(0);
      expect(canBuildInterface(AAVE_V3_POOL_DATA_PROVIDER_ABI)).toBe(true);
    });

    it('contains getUserReserveData, getReserveData', () => {
      const iface = new Interface(AAVE_V3_POOL_DATA_PROVIDER_ABI);
      expect(iface.hasFunction('getUserReserveData(address,address)')).toBe(true);
      expect(iface.hasFunction('getReserveData(address)')).toBe(true);
    });
  });

  describe('AAVE_V3_POOL_ABI', () => {
    it('is a non-empty array and valid Interface', () => {
      expect(AAVE_V3_POOL_ABI.length).toBeGreaterThan(0);
      expect(canBuildInterface(AAVE_V3_POOL_ABI)).toBe(true);
    });

    it('contains LiquidationCall event', () => {
      const iface = new Interface(AAVE_V3_POOL_ABI);
      expect(iface.hasEvent('LiquidationCall')).toBe(true);
    });
  });

  describe('ABIS collection', () => {
    it('exports an object containing every named ABI', () => {
      expect(ABIS.ERC20).toBe(ERC20_ABI);
      expect(ABIS.ERC721).toBe(ERC721_ABI);
      expect(ABIS.UNISWAP_V2_PAIR).toBe(UNISWAP_V2_PAIR_ABI);
      expect(ABIS.UNISWAP_V3_POOL).toBe(UNISWAP_V3_POOL_ABI);
      expect(ABIS.AAVE_V3_POOL_DATA_PROVIDER).toBe(AAVE_V3_POOL_DATA_PROVIDER_ABI);
      expect(ABIS.AAVE_V3_POOL).toBe(AAVE_V3_POOL_ABI);
    });

    it('all ABIs in the collection are non-empty arrays of valid fragments', () => {
      for (const [key, abi] of Object.entries(ABIS)) {
        expect(Array.isArray(abi), `${key} is array`).toBe(true);
        expect(abi.length, `${key} non-empty`).toBeGreaterThan(0);
        expect(canBuildInterface(abi), `${key} builds Interface`).toBe(true);
      }
    });
  });
});
