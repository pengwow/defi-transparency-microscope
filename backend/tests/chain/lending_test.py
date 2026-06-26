"""Unit tests for `dtm_backend.chain.lending`."""
from __future__ import annotations

import pytest

from dtm_backend.chain.lending import LendingFetcher


def _stub_call(function_name, *args):
    async def _inner():
        if function_name == "getUserReservesData":
            return [
                {
                    "underlyingAsset": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  # WETH
                    "scaledATokenBalance": 10**18,
                    "usageAsCollateralEnabledOnUser": 1,
                    "scaledVariableDebt": 0,
                    "stableBorrowRate": 0,
                    "oldAverageStableBorrowRate": 0,
                    "stableRateSlope1": 0,
                    "stableRateSlope2": 0,
                    "averageStableBorrowRate": 0,
                    "stableDebtLastUpdateTimestamp": 0,
                    "variableDebtIndex": 0,
                },
                {
                    "underlyingAsset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC
                    "scaledATokenBalance": 0,
                    "usageAsCollateralEnabledOnUser": 0,
                    "scaledVariableDebt": 10**6,
                    "stableBorrowRate": 0,
                    "oldAverageStableBorrowRate": 0,
                    "stableRateSlope1": 0,
                    "stableRateSlope2": 0,
                    "averageStableBorrowRate": 0,
                    "stableDebtLastUpdateTimestamp": 0,
                    "variableDebtIndex": 0,
                },
            ]
        if function_name == "getReserveData":
            return {
                "unbacked": 0,
                "accruedToTreasuryScaled": 0,
                "totalAToken": 10**18,
                "totalStableDebt": 0,
                "totalVariableDebt": 10**6,
                "liquidityRate": 0,
                "variableBorrowRate": 0,
                "stableBorrowRate": 0,
                "averageStableBorrowRate": 0,
                "liquidityIndex": 0,
                "variableBorrowIndex": 0,
                "lastUpdateTimestamp": 0,
            }
        if function_name == "decimals":
            asset = str(args[0]).lower()
            if asset == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2":
                return 18
            return 6
        if function_name == "symbol":
            asset = str(args[0]).lower()
            if asset == "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2":
                return "WETH"
            return "USDC"
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


@pytest.mark.asyncio
async def test_lending_fetcher_returns_position() -> None:
    """A lending fetcher with canned `_call` returns a `LendingPosition`."""
    f = LendingFetcher(_call=_stub_call)
    pos = await f.get_position("0xuser")
    assert pos.protocol == "aave_v3"
    assert pos.id == "0xuser"
    # Both are normalised to 1e18 scale inside `LendingFetcher`.
    assert pos.collateral.get("WETH", 0) == 10**18
    assert pos.debt.get("USDC", 0) == 10**18  # 10**6 USDC raw → 10**18 in 1e18
    assert pos.health_factor > 0


@pytest.mark.asyncio
async def test_lending_fetcher_propagates_error() -> None:
    """Network errors propagate from the fetcher."""

    def _err(fn, *args):
        async def _inner():
            raise ConnectionError("rpc down")
        return _inner()

    f = LendingFetcher(_call=_err)
    with pytest.raises(ConnectionError):
        await f.get_position("0xuser")


@pytest.mark.asyncio
async def test_lending_fetcher_handles_empty_reserves() -> None:
    """A user with no Aave positions returns a safe empty position."""

    def _empty(fn, *args):
        async def _inner():
            if fn == "getUserReservesData":
                return []
            raise AssertionError(f"unexpected {fn}")
        return _inner()

    f = LendingFetcher(_call=_empty)
    pos = await f.get_position("0xuser")
    assert pos.collateral == {}
    assert pos.debt == {}
    assert pos.liquidation_threshold_e18 == 0
    # No debt ⇒ very high health factor.
    assert pos.health_factor >= 100.0
