"""EIP-55 mainnet address table.

The wire format is preserved from the previous TypeScript backend
(11 addresses, all EIP-55 checksummed).  The exact 11 addresses
are documented in `chain/addresses.test.py`.
"""
from __future__ import annotations

from types import MappingProxyType
from typing import Final

from eth_utils import is_checksum_address as _eth_is_checksum  # type: ignore[attr-defined]

# EIP-55 checksummed mainnet addresses.
#   5 ERC20 tokens  : WETH, USDC, USDT, DAI, WBTC
#   1 V2 pair       : USDC/WETH
#   3 V3 pools      : USDC/WETH 5bps, USDC/USDT 1bps, WBTC/WETH 5bps
#   1 Aave V3 Pool
#   1 Aave V3 PoolDataProvider
ADDRESSES: Final[MappingProxyType[str, str]] = MappingProxyType(
    {
        # ERC20 tokens
        "WETH": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        "USDC": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "USDT": "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
        "WBTC": "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
        # Uniswap V2 pair: USDC/WETH
        "UNI_V2_USDC_WETH": "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
        # Uniswap V3 pools
        "UNI_V3_USDC_WETH_5BPS": "0x88e6a0C2dDD26FEeb64f039A2c41292fc3a82be1",
        "UNI_V3_USDC_USDT_1BPS": "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6",
        "UNI_V3_WBTC_WETH_5BPS": "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",
        # Aave V3
        "AAVE_V3_POOL": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        "AAVE_V3_POOL_DATA_PROVIDER": "0x7b4Eb56E7cD4B454BA8ff9E4cC95bB0Df88ea145",
    }
)


def is_checksum_address(value: str) -> bool:
    """Return True iff `value` is EIP-55 checksummed.

    Thin wrapper around `eth_utils.is_checksum_address` that
    returns a plain `bool` (the upstream returns the address back
    on success, which is a footgun for type checkers).
    """
    try:
        return bool(_eth_is_checksum(value))
    except (ValueError, TypeError):
        return False


def assert_addresses_valid() -> None:
    """Raise `ValueError` if any entry in `ADDRESSES` is not EIP-55.

    Intended to be called once at process start (e.g. from
    `lifespan`) so a misconfiguration crashes loudly.
    """
    for key, addr in ADDRESSES.items():
        if not is_checksum_address(addr):
            raise ValueError(f"ADDRESSES[{key}] = {addr!r} is not EIP-55 checksummed")


__all__ = ["ADDRESSES", "assert_addresses_valid", "is_checksum_address"]
