"""Unit tests for `dtm_backend.experiments.il`.

The IL (Impermanent Loss) experiment computes the loss (or
relative gain) an LP position suffers vs. simply holding the
underlying tokens 50/50 at the initial price.

The wire format is the one consumed by
`POST /api/v1/experiments/il` and by
`HttpAPI.runILExperiment` on the frontend::

    {
      "durationMs": <int>,
      "result": {
        "il":          <float, range (-1, +∞)>,
        "variant":     "v2" | "v3",
        "priceRatio":  <float, the request priceRatio>,
      }
    }

The math is intentionally simple and **defensible** rather
than numerically exact: the V2 formula is the textbook
``2·√p / (1 + p) - 1``; the V3 formula amplifies the price
ratio by a fixed concentration factor (default ``k=4``, i.e.
a 2x range) to represent a V3 LP whose position is roughly
4x more capital-efficient than a V2 LP.
"""
from __future__ import annotations

import pytest

from dtm_backend.experiments.il import IlInput, calculate_il


def test_v2_il_at_no_price_change_is_zero() -> None:
    """At ``priceRatio == 1`` the LP is flat — zero IL."""
    res = calculate_il(IlInput(price_ratio=1.0, variant="v2"))
    assert res.il == pytest.approx(0.0, abs=1e-12)
    assert res.variant == "v2"
    assert res.price_ratio == pytest.approx(1.0)


def test_v2_il_is_loss_for_price_change() -> None:
    """V2 IL is strictly negative whenever the price moves."""
    for ratio in (0.5, 0.8, 1.25, 1.5, 2.0, 4.0):
        res = calculate_il(IlInput(price_ratio=ratio, variant="v2"))
        assert res.il < 0, f"V2 IL must be negative for p={ratio}, got {res.il}"


def test_v2_il_is_symmetric() -> None:
    """IL(p) == IL(1/p) for the V2 formula."""
    for p in (0.5, 0.8, 1.5, 2.5):
        a = calculate_il(IlInput(price_ratio=p, variant="v2")).il
        b = calculate_il(IlInput(price_ratio=1 / p, variant="v2")).il
        assert a == pytest.approx(b, rel=1e-9), f"p={p} IL={a}, 1/p IL={b}"


def test_v2_il_at_2x_equals_textbook_value() -> None:
    """The classic reference: a 2x price move ⇒ ~5.7% IL."""
    res = calculate_il(IlInput(price_ratio=2.0, variant="v2"))
    assert res.il == pytest.approx(-0.0572, abs=1e-3)


def test_v3_il_at_no_price_change_is_zero() -> None:
    """At ``priceRatio == 1`` the V3 LP is also flat — zero IL."""
    res = calculate_il(IlInput(price_ratio=1.0, variant="v3"))
    assert res.il == pytest.approx(0.0, abs=1e-12)
    assert res.variant == "v3"


def test_v3_il_is_at_least_as_severe_as_v2() -> None:
    """A V3 position is *more concentrated* than V2 — at any
    non-trivial price move, the V3 IL must be at least as
    negative (i.e. more loss)."""
    for ratio in (0.5, 0.7, 1.5, 2.0, 3.0):
        v2 = calculate_il(IlInput(price_ratio=ratio, variant="v2")).il
        v3 = calculate_il(IlInput(price_ratio=ratio, variant="v3")).il
        assert v3 <= v2, (
            f"V3 IL must be at least as severe as V2 IL; "
            f"p={ratio}: v2={v2} v3={v3}"
        )


def test_v3_il_doubles_down_on_concentration() -> None:
    """V3 IL grows (in magnitude) with ``concentration``.

    A higher concentration factor means the LP is more
    capital-efficient — but also more exposed to price moves.
    """
    low = calculate_il(
        IlInput(price_ratio=1.5, variant="v3", concentration=2.0)
    ).il
    high = calculate_il(
        IlInput(price_ratio=1.5, variant="v3", concentration=8.0)
    ).il
    assert abs(high) >= abs(low), (
        f"Higher concentration must yield more IL; "
        f"low={low} high={high}"
    )


def test_il_rejects_non_positive_price_ratio() -> None:
    """``priceRatio`` must be > 0."""
    with pytest.raises(ValueError, match="price_ratio"):
        calculate_il(IlInput(price_ratio=0, variant="v2"))
    with pytest.raises(ValueError, match="price_ratio"):
        calculate_il(IlInput(price_ratio=-1, variant="v2"))


def test_il_rejects_unknown_variant() -> None:
    """Variant must be ``v2`` or ``v3``."""
    with pytest.raises(ValueError, match="variant"):
        # type: ignore[arg-type]  -- intentionally invalid
        calculate_il(IlInput(price_ratio=1.5, variant="uniswap_v4"))


def test_il_result_round_trip_fields() -> None:
    """The returned `IlResult` echoes the input `price_ratio`."""
    res = calculate_il(IlInput(price_ratio=1.234, variant="v2"))
    assert res.price_ratio == pytest.approx(1.234)
    assert res.variant == "v2"
