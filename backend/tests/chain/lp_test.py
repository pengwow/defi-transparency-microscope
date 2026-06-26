"""Unit tests for `dtm_backend.chain.lp`."""
from __future__ import annotations

import pytest

from dtm_backend.chain.lp import LpFetcher


def _stub_call(function_name, *args):
    async def _inner():
        if function_name == "balanceOf":
            return 1
        if function_name == "tokenOfOwnerByIndex":
            return 12345
        if function_name == "positions":
            # (nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity)
            return (
                1,  # nonce
                "0x" + "9" * 40,  # operator
                "0x" + "1" * 40,  # token0
                "0x" + "2" * 40,  # token1
                500,  # fee (5 bps, V3 encoding)
                -100,  # tickLower
                100,  # tickUpper
                10**15,  # liquidity
            )
        raise AssertionError(f"unexpected {function_name}")
    return _inner()


@pytest.mark.asyncio
async def test_lp_fetcher_returns_position() -> None:
    """An LP fetcher with canned `_call` returns an `LpPosition`."""
    f = LpFetcher(_call=_stub_call)
    positions = await f.list_positions("0xuser")
    assert len(positions) == 1
    p = positions[0]
    assert p.protocol == "uniswap_v3"
    assert p.amount0 == 10**15
    assert p.amount1 == 10**15
    # V3 encodes 5 bps as 500 → fetcher converts to bps.
    assert p.fee_tier == 5
    assert p.status == "active"


@pytest.mark.asyncio
async def test_lp_fetcher_handles_no_positions() -> None:
    """A user with no positions returns `[]`."""

    def _empty(fn, *args):
        async def _inner():
            if fn == "balanceOf":
                return 0
            raise AssertionError(f"unexpected {fn}")
        return _inner()

    f = LpFetcher(_call=_empty)
    positions = await f.list_positions("0xuser")
    assert positions == []
