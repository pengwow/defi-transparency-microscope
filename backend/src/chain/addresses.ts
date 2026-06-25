/**
 * Hardcoded Ethereum mainnet contract addresses.
 *
 * Per the design spec §6, v1 keeps addresses as constants — no override env.
 * If you ever need a different chain, fork this file rather than threading
 * config through.
 *
 * Every address is stored in EIP-55 checksum format. Use `isChecksummed` to
 * verify, or `getAddress` to round-trip.
 */
import { getAddress, ZeroAddress } from 'ethers';

export interface TokenMeta {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const TOKENS = {
  WETH: {
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
  },
  USDT: {
    address: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
  },
  DAI: {
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
  },
  WBTC: {
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    symbol: 'WBTC',
    name: 'Wrapped BTC',
    decimals: 8,
  },
} as const satisfies Record<string, TokenMeta>;

export const POOLS = {
  V2_WETH_USDC: '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc',
  V3_WETH_USDC_3000: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  V3_WETH_USDT_3000: '0x4e68cCd3E89f51C3074ca5072BbAc773960DFa76',
} as const;

export const UNISWAP_V2_FACTORY = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
export const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
export const NFT_POSITION_MANAGER = '0xC36442b4a4522e871399CD717dACd8480db6B9A9';

export const AAVE_V3_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
export const AAVE_V3_POOL_DATA_PROVIDER = '0x7B4EB56E7CD4b454BA8ff71E4518426369a138a3';

export const ChainAddresses = {
  tokens: TOKENS,
  pools: POOLS,
  UNISWAP_V2_FACTORY,
  UNISWAP_V3_FACTORY,
  NFT_POSITION_MANAGER,
  AAVE_V3_POOL,
  AAVE_V3_POOL_DATA_PROVIDER,
} as const;

export type ChainAddressesType = typeof ChainAddresses;
export type TokenSymbol = keyof typeof TOKENS;
export type PoolKey = keyof typeof POOLS;

/**
 * Returns true if the address is in EIP-55 checksum format (mixed case).
 * Lowercase and all-uppercase hex strings are considered unchecksummed.
 */
export function isChecksummed(address: string): boolean {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return false;
  // Lowercase or all-uppercase → not checksummed
  if (address === address.toLowerCase() || address === address.toUpperCase()) {
    return false;
  }
  try {
    return getAddress(address) === address;
  } catch {
    return false;
  }
}

/**
 * Throw if any address in the registry is malformed or zero. Use at boot
 * time to fail fast on typos.
 */
export function assertAddressesValid(): void {
  const all: string[] = Object.values(TOKENS).map((t) => t.address);
  for (const pool of Object.values(POOLS)) all.push(pool);
  for (const constant of [
    UNISWAP_V2_FACTORY,
    UNISWAP_V3_FACTORY,
    NFT_POSITION_MANAGER,
    AAVE_V3_POOL,
    AAVE_V3_POOL_DATA_PROVIDER,
  ]) {
    all.push(constant);
  }
  for (const addr of all) {
    if (addr === ZeroAddress) {
      throw new Error('ChainAddresses contains a zero address');
    }
    if (getAddress(addr) !== addr) {
      throw new Error(`ChainAddresses contains a non-checksummed address: ${addr}`);
    }
  }
}
