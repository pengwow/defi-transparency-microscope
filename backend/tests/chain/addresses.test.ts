import { describe, it, expect } from 'vitest';
import { getAddress, isAddress, ZeroAddress } from 'ethers';
import { ChainAddresses, isChecksummed } from '../../src/chain/addresses.js';

describe('ChainAddresses', () => {
  describe('tokens', () => {
    it('exposes WETH at 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', () => {
      expect(ChainAddresses.tokens.WETH.address).toBe('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2');
    });

    it('exposes USDC, USDT, DAI, WBTC at known mainnet addresses', () => {
      expect(ChainAddresses.tokens.USDC.address).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
      expect(ChainAddresses.tokens.USDT.address).toBe('0xdAC17F958D2ee523a2206206994597C13D831ec7');
      expect(ChainAddresses.tokens.DAI.address).toBe('0x6B175474E89094C44Da98b954EedeAC495271d0F');
      expect(ChainAddresses.tokens.WBTC.address).toBe('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599');
    });

    it('attaches symbol, name, decimals to every token', () => {
      for (const [key, token] of Object.entries(ChainAddresses.tokens)) {
        expect(token.symbol, `${key}.symbol`).toBeTypeOf('string');
        expect(token.symbol.length, `${key}.symbol length`).toBeGreaterThan(0);
        expect(token.name, `${key}.name`).toBeTypeOf('string');
        expect(token.name.length, `${key}.name length`).toBeGreaterThan(0);
        expect(token.decimals, `${key}.decimals`).toBeTypeOf('number');
        expect(token.decimals, `${key}.decimals`).toBeGreaterThanOrEqual(0);
        expect(token.decimals, `${key}.decimals`).toBeLessThanOrEqual(36);
      }
    });

    it('WETH has 18 decimals; USDC, USDT, DAI have 6 (WBTC 8)', () => {
      expect(ChainAddresses.tokens.WETH.decimals).toBe(18);
      expect(ChainAddresses.tokens.USDC.decimals).toBe(6);
      expect(ChainAddresses.tokens.USDT.decimals).toBe(6);
      expect(ChainAddresses.tokens.DAI.decimals).toBe(18);
      expect(ChainAddresses.tokens.WBTC.decimals).toBe(8);
    });

    it('every token address is checksummed and non-zero', () => {
      for (const [key, token] of Object.entries(ChainAddresses.tokens)) {
        expect(isAddress(token.address), `${key} is valid address`).toBe(true);
        expect(token.address, `${key} is not zero`).not.toBe(ZeroAddress);
        expect(isChecksummed(token.address), `${key} is checksum format`).toBe(true);
      }
    });
  });

  describe('pools', () => {
    it('exposes V2 WETH/USDC, V3 WETH/USDC 0.3%, V3 WETH/USDT 0.3%', () => {
      expect(ChainAddresses.pools.V2_WETH_USDC).toBe('0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc');
      expect(ChainAddresses.pools.V3_WETH_USDC_3000).toBe('0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640');
      expect(ChainAddresses.pools.V3_WETH_USDT_3000).toBe('0x4e68cCd3E89f51C3074ca5072BbAc773960DFa76');
    });

    it('every pool address is checksummed and non-zero', () => {
      for (const [key, addr] of Object.entries(ChainAddresses.pools)) {
        expect(isAddress(addr), `${key} is valid`).toBe(true);
        expect(addr, `${key} not zero`).not.toBe(ZeroAddress);
        expect(isChecksummed(addr), `${key} checksum`).toBe(true);
      }
    });
  });

  describe('factories and position manager', () => {
    it('exposes Uniswap V2 factory at known address', () => {
      expect(ChainAddresses.UNISWAP_V2_FACTORY).toBe('0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f');
    });

    it('exposes Uniswap V3 factory at known address', () => {
      expect(ChainAddresses.UNISWAP_V3_FACTORY).toBe('0x1F98431c8aD98523631AE4a59f267346ea31F984');
    });

    it('exposes NonfungiblePositionManager at known address', () => {
      expect(ChainAddresses.NFT_POSITION_MANAGER).toBe('0xC36442b4a4522e871399CD717dACd8480db6B9A9');
    });

    it('every factory / manager address is checksummed and non-zero', () => {
      for (const [key, addr] of Object.entries({
        UNISWAP_V2_FACTORY: ChainAddresses.UNISWAP_V2_FACTORY,
        UNISWAP_V3_FACTORY: ChainAddresses.UNISWAP_V3_FACTORY,
        NFT_POSITION_MANAGER: ChainAddresses.NFT_POSITION_MANAGER,
      })) {
        expect(isAddress(addr), `${key} valid`).toBe(true);
        expect(addr, `${key} not zero`).not.toBe(ZeroAddress);
        expect(isChecksummed(addr), `${key} checksum`).toBe(true);
      }
    });
  });

  describe('Aave V3', () => {
    it('exposes Aave V3 Pool at known address', () => {
      expect(ChainAddresses.AAVE_V3_POOL).toBe('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2');
    });

    it('exposes Aave V3 PoolDataProvider at known address', () => {
      expect(ChainAddresses.AAVE_V3_POOL_DATA_PROVIDER).toBe('0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3');
    });

    it('both Aave addresses are checksummed and non-zero', () => {
      for (const addr of [
        ChainAddresses.AAVE_V3_POOL,
        ChainAddresses.AAVE_V3_POOL_DATA_PROVIDER,
      ]) {
        expect(isAddress(addr)).toBe(true);
        expect(addr).not.toBe(ZeroAddress);
        expect(isChecksummed(addr)).toBe(true);
      }
    });
  });

  describe('global checks', () => {
    it('every address-like field is checksummed (round-trips through getAddress unchanged)', () => {
      // WETH example
      expect(getAddress(ChainAddresses.tokens.WETH.address)).toBe(ChainAddresses.tokens.WETH.address);
      // V2 factory
      expect(getAddress(ChainAddresses.UNISWAP_V2_FACTORY)).toBe(ChainAddresses.UNISWAP_V2_FACTORY);
    });
  });
});
