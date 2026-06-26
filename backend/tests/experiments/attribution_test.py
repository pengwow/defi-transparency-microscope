"""Unit tests for `dtm_backend.experiments.attribution`.

Attribution decomposes a single LP position's return over a
period into 4 components:

  1. **Fees** earned from swap fees (always ≥ 0)
  2. **IL** (impermanent loss; always ≤ 0)
  3. **Rebates** / incentives (always ≥ 0)
  4. **Net PnL** = fees + IL + rebates

The wire format is the one consumed by
`POST /api/v1/experiments/attribution` and by
`HttpAPI.runAttributionExperiment` on the frontend::

    {
      "durationMs": <int>,
      "result": {
        "netPnl": "<decimal string of raw integer>",
      }
    }

The "raw integer" is the net PnL in the same unit as the
input reserves (e.g. wei for ETH, 1e6 for USDC).  The
*components* themselves are not exposed on the wire —
they are an internal accounting device that sums to netPnl.
"""
from __future__ import annotations

from dtm_backend.experiments.attribution import (
    AttributionInput,
    run_attribution,
)


def test_attribution_net_pnl_is_sum_of_components() -> None:
    """Net PnL = fees + IL + rebates (algebraic sum)."""
    res = run_attribution(
        AttributionInput(
            reserve0=80_000 * 10**18,
            reserve1=160_000_000 * 10**6,
            amount_in=1_000 * 10**18,
            fee_bip=3000,
            # Fictional but bounded scenario.
            price_ratio=1.5,
            fees=10**18,        # 1 ETH of fees
            rebates=5 * 10**17, # 0.5 ETH of incentives
        )
    )
    # The implementation must round-trip its own internal sum.
    assert res.net_pnl == res.fees + res.il + res.rebates


def test_attribution_negative_il_reduces_net_pnl() -> None:
    """A more severe IL ⇒ strictly lower net PnL (with fees/rebates held constant)."""
    base = dict(
        reserve0=80_000 * 10**18,
        reserve1=160_000_000 * 10**6,
        amount_in=1_000 * 10**18,
        fee_bip=3000,
        fees=10**18,
        rebates=0,
    )
    a = run_attribution(AttributionInput(**base, price_ratio=1.1)).net_pnl
    b = run_attribution(AttributionInput(**base, price_ratio=1.5)).net_pnl
    c = run_attribution(AttributionInput(**base, price_ratio=2.0)).net_pnl
    # A bigger price move ⇒ more negative IL ⇒ smaller net PnL.
    assert a > b > c


def test_attribution_higher_fees_increase_net_pnl() -> None:
    """More fees ⇒ strictly higher net PnL (other things equal)."""
    base = dict(
        reserve0=80_000 * 10**18,
        reserve1=160_000_000 * 10**6,
        amount_in=1_000 * 10**18,
        fee_bip=3000,
        price_ratio=1.5,
        rebates=0,
    )
    a = run_attribution(AttributionInput(**base, fees=10**18)).net_pnl
    b = run_attribution(AttributionInput(**base, fees=2 * 10**18)).net_pnl
    c = run_attribution(AttributionInput(**base, fees=10**19)).net_pnl
    assert a < b < c


def test_attribution_rebates_increase_net_pnl() -> None:
    """Rebates are a positive contribution (subject to the IL cost)."""
    base = dict(
        reserve0=80_000 * 10**18,
        reserve1=160_000_000 * 10**6,
        amount_in=1_000 * 10**18,
        fee_bip=3000,
        price_ratio=1.5,
        fees=10**18,
    )
    a = run_attribution(AttributionInput(**base, rebates=0)).net_pnl
    b = run_attribution(AttributionInput(**base, rebates=10**18)).net_pnl
    assert b > a
    assert b - a == 10**18


def test_attribution_zero_fees_and_rebates_yields_negative_net_pnl() -> None:
    """Without any fees or rebates, net PnL must be negative (IL-only)."""
    res = run_attribution(
        AttributionInput(
            reserve0=80_000 * 10**18,
            reserve1=160_000_000 * 10**6,
            amount_in=1_000 * 10**18,
            fee_bip=3000,
            price_ratio=1.5,
            fees=0,
            rebates=0,
        )
    )
    assert res.net_pnl < 0
    # Net PnL is exactly the (negative) IL component.
    assert res.net_pnl == res.il
    assert res.fees == 0
    assert res.rebates == 0


def test_attribution_rejects_non_positive_price_ratio() -> None:
    """``price_ratio`` must be > 0 (we take a log of it)."""
    import pytest

    with pytest.raises(ValueError, match="price_ratio"):
        run_attribution(
            AttributionInput(
                reserve0=10**18,
                reserve1=10**6,
                amount_in=10**18,
                fee_bip=3000,
                price_ratio=0,
                fees=0,
                rebates=0,
            )
        )
