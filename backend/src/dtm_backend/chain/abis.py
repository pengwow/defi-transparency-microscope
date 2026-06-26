"""ABI fragments used by the chain layer.

These are minimal Human-Readable ABI strings — `web3.py` accepts
either JSON ABI or a list of HRA strings.  Each fragment covers
only the functions/events the fetcher actually calls.
"""
from __future__ import annotations

from types import MappingProxyType
from typing import Final

# ERC20 — symbol, decimals, balanceOf (read-only subset)
ERC20: Final[list[str]] = [
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address owner) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
]

# ERC721 — symbol, balanceOf (read-only subset)
ERC721: Final[list[str]] = [
    "function symbol() view returns (string)",
    "function name() view returns (string)",
    "function balanceOf(address owner) view returns (uint256)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function tokenURI(uint256 tokenId) view returns (string)",
]

# Uniswap V2 Pair — getReserves, token0/1
UNI_V2_PAIR: Final[list[str]] = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "function totalSupply() view returns (uint256)",
    "event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)",
    "event Sync(uint112 reserve0, uint112 reserve1)",
]

# Uniswap V3 Pool — slot0, liquidity, tickSpacing, fee
UNI_V3_POOL: Final[list[str]] = [
    "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() view returns (uint128)",
    "function tickSpacing() view returns (int24)",
    "function fee() view returns (uint24)",
    "function token0() view returns (address)",
    "function token1() view returns (address)",
    "event Swap(address indexed sender, address indexed recipient, int256 amount0, int256 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick)",
]

# Aave V3 Pool — getReservesList (used to discover reserve assets)
AAVE_V3_POOL: Final[list[str]] = [
    "function getReservesList() view returns (address[])",
    "function getReserveData(address asset) view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id)",
]

# Aave V3 PoolDataProvider — getUserReservesData + getReserveCaps
AAVE_V3_POOL_DATA_PROVIDER: Final[list[str]] = [
    "function getUserReservesData(address user) view returns (tuple(address underlyingAsset, uint256 scaledATokenBalance, uint256 usageAsCollateralEnabledOnUser, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 oldAverageStableBorrowRate, uint256 stableRateSlope1, uint256 stableRateSlope2, uint256 averageStableBorrowRate, uint256 stableDebtLastUpdateTimestamp, uint256 variableDebtIndex)[])",
    "function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)",
]


ABIS: Final[MappingProxyType[str, list[str]]] = MappingProxyType(
    {
        "ERC20": ERC20,
        "ERC721": ERC721,
        "UNI_V2_PAIR": UNI_V2_PAIR,
        "UNI_V3_POOL": UNI_V3_POOL,
        "AAVE_V3_POOL": AAVE_V3_POOL,
        "AAVE_V3_POOL_DATA_PROVIDER": AAVE_V3_POOL_DATA_PROVIDER,
    }
)


def abi_for(key: str) -> list[str]:
    """Return the ABI fragment for `key` (raises `KeyError` if unknown)."""
    return ABIS[key]


__all__ = ["ABIS", "abi_for"]
