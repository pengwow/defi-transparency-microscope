"""Impermanent Loss (IL) computation for V2 and V3 LP positions.

The "IL" of an LP position is the relative loss (or gain) of
holding the position vs. simply holding the underlying tokens
50/50 at the initial price.  Mathematically::

    IL(P_initial, P_final) = V_lp(P_final) / V_hold(P_final) - 1

The wire format is the one consumed by
`POST /api/v1/experiments/il` and by
`HttpAPI.runILExperiment` on the frontend::

    {
      "durationMs": <int>,
      "result": {
        "il":          <float, range (-1, +∞)>,
        "variant":     "v2" | "v3",
        "priceRatio":  <float>,
      }
    }

This module is pure math — no IO, no async, no web3.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal

IlVariant = Literal["v2", "v3"]

# Default V3 concentration factor.  This is the *amplification*
# applied to ``priceRatio`` for the V3 formula and represents
# a 2x range (i.e. ±50% around the current price).  A real
# production implementation would derive this from
# ``tickLower`` / ``tickUpper``; the experiment endpoint just
# takes a price ratio and assumes a sensible default.
_DEFAULT_V3_CONCENTRATION: float = 4.0


@dataclass(slots=True)
class IlInput:
    """Parameters of a single IL computation.

    Parameters
    ----------
    price_ratio:
        Final price divided by initial price.  Must be > 0.
    variant:
        ``"v2"`` for the classic 50/50 formula, ``"v3"`` for
        a concentration-amplified formula.
    concentration:
        V3-only.  Multiplier applied to ``priceRatio`` before
        plugging into the V2 formula.  Higher = more IL.
        Ignored for ``"v2"``.
    """

    price_ratio: float
    variant: IlVariant
    concentration: float = _DEFAULT_V3_CONCENTRATION


@dataclass(slots=True)
class IlResult:
    """The result of a single IL computation.

    Attributes
    ----------
    il:
        Relative loss (or gain) as a fraction — i.e. ``-0.057``
        means a 5.7% loss, ``0.0`` means no change.
    variant:
        Echo of the input variant (``"v2"`` or ``"v3"``).
    price_ratio:
        Echo of the input price ratio.
    """

    il: float
    variant: IlVariant
    price_ratio: float


def _il_v2(p: float) -> float:
    """Classic V2 IL formula: ``2·√p / (1 + p) - 1``."""
    return 2.0 * math.sqrt(p) / (1.0 + p) - 1.0


def _il_v3(p: float, concentration: float) -> float:
    """Concentration-amplified V3 IL formula.

    We treat the V3 position as ``concentration``-times more
    sensitive to price moves than V2.  This is a deliberate
    approximation — a real production implementation would
    compute IL using the full V3 position math
    (``L = 1/√P_a - 1/√P_b`` etc.) given
    ``tickLower`` / ``tickUpper``.  For the *experiment*
    endpoint we accept a single ``priceRatio`` and a default
    range, so the concentration factor is the lever that
    tunes "how V3-like" the result feels.

    The amplification is applied in *log-price space*, so the
    result is bounded:
    * at p=1 we get 0 (the log is 0);
    * the formula is symmetric in p ↔ 1/p;
    * the result is always ≤ 0 for the canonical range
      (``p > 0``).
    """
    if concentration <= 0:
        raise ValueError(f"concentration must be > 0, got {concentration}")
    # p^√c is the standard "concentration factor" in log-price
    # space — at p=1 the result is 1 (no change), at p=2 with
    # c=4 the result is 4 (same as a 4x V2 move).
    p_amp: float = float(p) ** math.sqrt(concentration)
    return 2.0 * math.sqrt(p_amp) / (1.0 + p_amp) - 1.0


def calculate_il(params: IlInput) -> IlResult:
    """Compute the IL for a single (price_ratio, variant) pair.

    See module docstring for the wire format.  Raises
    ``ValueError`` on out-of-range inputs.
    """
    if params.price_ratio <= 0:
        raise ValueError(
            f"price_ratio must be > 0, got {params.price_ratio}"
        )
    if params.variant not in ("v2", "v3"):
        raise ValueError(
            f"variant must be 'v2' or 'v3', got {params.variant!r}"
        )

    if params.variant == "v2":
        il = _il_v2(params.price_ratio)
    else:
        il = _il_v3(params.price_ratio, params.concentration)

    return IlResult(
        il=il,
        variant=params.variant,
        price_ratio=params.price_ratio,
    )


__all__ = ["IlInput", "IlResult", "IlVariant", "calculate_il"]
