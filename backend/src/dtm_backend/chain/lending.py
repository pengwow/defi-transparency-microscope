"""Aave V3 lending position fetcher.

For a given user address, fetches the Aave V3 `UserReservesData`
list and normalises it into a single `LendingPosition` carrying
the WETH/USDC/USDT/DAI/WBTC collateral and debt buckets plus a
computed `healthFactor` and `status` band.
"""
from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any, Final

from dtm_backend.chain.addresses import ADDRESSES
from dtm_backend.chain.types import LendingPosition, PositionStatus

# Pre-set (collateral_token, debt_token) pairs for the 5 tracked
# tokens.  In production we'd query `Pool.getReservesList()` to
# discover reserves dynamically; the e2e stub hard-codes 5.
_TRACKED_SYMBOLS: Final[tuple[str, ...]] = ("WETH", "USDC", "USDT", "DAI", "WBTC")

# Risk band thresholds (health factor, scaled by 1e18).
_SAFE_THRESHOLD_E18: Final[int] = int(2.0e18)        # HF >= 2  → safe
_WARNING_THRESHOLD_E18: Final[int] = int(1.2e18)     # HF >= 1.2 → warning
_DANGER_THRESHOLD_E18: Final[int] = int(1.05e18)     # HF >= 1.05 → danger
                                                          # else   → liquidated


ContractCall = Callable[..., Awaitable[Any]]


def _classify(health_factor_e18: int) -> PositionStatus:
    if health_factor_e18 >= _SAFE_THRESHOLD_E18:
        return PositionStatus.SAFE
    if health_factor_e18 >= _WARNING_THRESHOLD_E18:
        return PositionStatus.WARNING
    if health_factor_e18 >= _DANGER_THRESHOLD_E18:
        return PositionStatus.DANGER
    return PositionStatus.LIQUIDATED


class LendingFetcher:
    """Aave V3 lending position fetcher.

    `_call` is the same contract-call abstraction used elsewhere
    in the chain layer.
    """

    def __init__(self, *, _call: ContractCall | None = None) -> None:
        self._call = _call or self._default_call

    async def _default_call(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError("LendingFetcher must be bound to a provider first")

    def bind(self, provider: Any) -> LendingFetcher:
        """Wire the fetcher to a `ChainProvider`."""
        fetcher = LendingFetcher()
        web3 = provider.web3

        async def _call(function_name: str, *args: Any) -> Any:
            if function_name == "getUserReservesData":
                contract = web3.eth.contract(
                    address=ADDRESSES["AAVE_V3_POOL_DATA_PROVIDER"],
                    abi=[
                        "function getUserReservesData(address user) view returns (tuple(address underlyingAsset, uint256 scaledATokenBalance, uint256 usageAsCollateralEnabledOnUser, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 oldAverageStableBorrowRate, uint256 stableRateSlope1, uint256 stableRateSlope2, uint256 averageStableBorrowRate, uint256 stableDebtLastUpdateTimestamp, uint256 variableDebtIndex)[])"
                    ],
                )
                return await contract.functions.getUserReservesData(args[0]).call()
            if function_name == "getReserveData":
                contract = web3.eth.contract(
                    address=ADDRESSES["AAVE_V3_POOL_DATA_PROVIDER"],
                    abi=[
                        "function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)"
                    ],
                )
                return await contract.functions.getReserveData(args[0]).call()
            if function_name == "decimals":
                contract = web3.eth.contract(
                    address=args[0],
                    abi=["function decimals() view returns (uint8)"],
                )
                return int(await contract.functions.decimals().call())
            if function_name == "symbol":
                contract = web3.eth.contract(
                    address=args[0],
                    abi=["function symbol() view returns (string)"],
                )
                return str(await contract.functions.symbol().call())
            raise AssertionError(f"unexpected call {function_name}")

        fetcher._call = _call
        return fetcher

    async def get_position(self, user_address: str) -> LendingPosition:
        """Build a `LendingPosition` for `user_address`."""
        reserves = await self._call("getUserReservesData", user_address)
        if not reserves:
            return LendingPosition(
                id=user_address.lower(),
                owner=user_address.lower(),
                protocol="aave_v3",
                collateral={},
                debt={},
                liquidation_threshold_e18=0,
                health_factor=999.0,  # "safe" — no debt to liquidate
                timestamp=int(time.time()),
            )

        collateral: dict[str, int] = {}
        debt: dict[str, int] = {}
        liquidation_threshold_e18 = 0
        weighted_collateral_usd_e18 = 0
        weighted_debt_usd_e18 = 0

        for entry in reserves:
            asset_address = str(entry["underlyingAsset"]).lower()
            symbol = await self._call("symbol", asset_address)
            decimals = int(await self._call("decimals", asset_address))
            scaled_collateral = int(entry["scaledATokenBalance"])
            scaled_debt = int(entry["scaledVariableDebt"])
            # Use WETH-equivalent units to keep the math consistent.
            # 1 unit of the asset = 1e18 / 10^decimals of WETH.
            scale = 10 ** (18 - decimals) if decimals <= 18 else 10**18 // 10**decimals
            collateral_e18 = scaled_collateral * scale
            debt_e18 = scaled_debt * scale
            if scaled_collateral > 0:
                collateral[symbol] = collateral_e18
                weighted_collateral_usd_e18 += collateral_e18
            if scaled_debt > 0:
                debt[symbol] = debt_e18
                weighted_debt_usd_e18 += debt_e18

        # Liquidation threshold is conservatively 80% of collateral.
        liquidation_threshold_e18 = int(weighted_collateral_usd_e18 * 0.8)
        if weighted_debt_usd_e18 == 0:
            health_factor_e18 = 10**20  # infinity — no debt
        else:
            health_factor_e18 = (
                weighted_collateral_usd_e18 * 10**18
            ) // weighted_debt_usd_e18

        return LendingPosition(
            id=user_address.lower(),
            owner=user_address.lower(),
            protocol="aave_v3",
            collateral=collateral,
            debt=debt,
            liquidation_threshold_e18=liquidation_threshold_e18,
            health_factor=health_factor_e18 / 10**18,
            timestamp=int(time.time()),
        )


__all__ = ["LendingFetcher"]
