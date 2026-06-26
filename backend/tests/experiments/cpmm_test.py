"""Unit tests for `dtm_backend.experiments.cpmm`.

These are pure-math tests — no chain access, no FastAPI.  The
`get_amount_out` function implements the constant-product AMM
output formula with a fee in *hundredths of a basis point*
(units of 1/100 bp, e.g. `3000` for the standard V2 0.3% tier,
`500` for the V3 5 bps tier).
"""
from __future__ import annotations

import pytest

from dtm_backend.experiments.cpmm import get_amount_in, get_amount_out


def test_get_amount_out_v2_eth_usdc() -> None:
    """1 ETH in, V2 0.3% pool, 100 ETH / 200_000 USDC → ~1_974 USDC.

    Sanity: pre-trade `k = reserve_in * reserve_out = 20_000_000`;
    after the trade the same `k` should be approximately
    conserved (slightly larger because of the fee kept in the
    pool).
    """
    out = get_amount_out(
        amount_in=1 * 10**18,
        reserve_in=100 * 10**18,
        reserve_out=200_000 * 10**6,
        fee_bip=3000,  # 0.3%
    )
    # 0.3% of 1 ETH = 0.003 ETH fee; k grows by 0.003 * 200_000 USDC.
    # Out is ~1_974 USDC.
    assert 1_970 * 10**6 < out < 1_980 * 10**6, f"out={out}"


def test_get_amount_out_v3_5bps_pool() -> None:
    """V3 5 bps pool, 10 WBTC in, reserves 100/1000 → ~9.05 WBTC out.

    Lower fee (5 bps) ⇒ attacker / victim extracts more value.
    """
    out = get_amount_out(
        amount_in=10 * 10**8,
        reserve_in=100 * 10**8,
        reserve_out=1_000 * 10**18,
        fee_bip=500,  # 5 bps
    )
    # 5 bps of 10 = 0.005 WBTC; new reserve_in = 109.995
    # new reserve_out = 100_000 / 109.995 = ~909.12 WETH
    # amount_out = 1000 - 909.12 = ~90.88 WETH (x 1e18)
    assert 90 * 10**18 < out < 91 * 10**18, f"out={out}"


def test_get_amount_out_zero_amount_in_returns_zero() -> None:
    """A 0 input produces 0 output (no fee)."""
    out = get_amount_out(
        amount_in=0,
        reserve_in=10**18,
        reserve_out=10**18,
        fee_bip=3000,
    )
    assert out == 0


def test_get_amount_out_rejects_zero_reserves() -> None:
    """Empty pool ⇒ invalid input."""
    with pytest.raises(ValueError, match="reserve_in"):
        get_amount_out(
            amount_in=10**18,
            reserve_in=0,
            reserve_out=10**18,
            fee_bip=3000,
        )
    with pytest.raises(ValueError, match="reserve_out"):
        get_amount_out(
            amount_in=10**18,
            reserve_in=10**18,
            reserve_out=0,
            fee_bip=3000,
        )


def test_get_amount_out_rejects_negative_fee() -> None:
    """Fee must be in [0, 1_000_000)."""
    with pytest.raises(ValueError, match="fee_bip"):
        get_amount_out(
            amount_in=10**18,
            reserve_in=10**18,
            reserve_out=10**18,
            fee_bip=-1,
        )
    with pytest.raises(ValueError, match="fee_bip"):
        get_amount_out(
            amount_in=10**18,
            reserve_in=10**18,
            reserve_out=10**18,
            fee_bip=1_000_000,
        )


def test_get_amount_in_v2_round_trip() -> None:
    """`get_amount_in` is the inverse of `get_amount_out` (within rounding).

    For an X·Y=k AMM with fee f, the exact round-trip formula is:
        in = ceil( (out · r_in · 1e6) / ((r_out - out) · (1e6 - f)) ) + 1
    so we add 1 wei of slack to handle integer rounding.
    """
    amount_out = 1_000 * 10**6
    reserve_in = 100 * 10**18
    reserve_out = 200_000 * 10**6
    fee_bip = 3000

    needed = get_amount_in(
        amount_out=amount_out,
        reserve_in=reserve_in,
        reserve_out=reserve_out,
        fee_bip=fee_bip,
    )
    out = get_amount_out(
        amount_in=needed,
        reserve_in=reserve_in,
        reserve_out=reserve_out,
        fee_bip=fee_bip,
    )
    # The output of the round-trip should be ≥ the desired amount_out.
    assert out >= amount_out, f"out={out} < amount_out={amount_out}"
    # And at most 1 wei of slippage above.
    assert out - amount_out <= 1, f"overshoot = {out - amount_out}"


def test_get_amount_in_rejects_impossible_target() -> None:
    """Asking for more than the pool holds must raise."""
    with pytest.raises(ValueError, match="amount_out"):
        get_amount_in(
            amount_out=2_000 * 10**6,
            reserve_in=100 * 10**18,
            reserve_out=1_000 * 10**6,
            fee_bip=3000,
        )
