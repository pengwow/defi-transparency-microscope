"""LP return attribution — decompose a position's PnL into
4 components (fees, IL, rebates, net).

The decomposition is a standard accounting device: ``net =
fees + IL + rebates``.  The frontend exposes only the net
P&L (as a decimal string of the raw integer in the input
unit), but the components are kept in the result so that
callers can reason about *where* the return came from.

The wire format is the one consumed by
`POST /api/v1/experiments/attribution` and by
`HttpAPI.runAttributionExperiment` on the frontend::

    {
      "durationMs": <int>,
      "result": {
        "netPnl": "<decimal string of raw integer>",
      }
    }
"""
from __future__ import annotations

from dataclasses import dataclass

from dtm_backend.experiments.cpmm import get_amount_out
from dtm_backend.experiments.il import IlInput, calculate_il


@dataclass(slots=True)
class AttributionInput:
    """Parameters of a single attribution run.

    Attributes
    ----------
    reserve0, reserve1:
        Initial pool reserves (raw integers).
    amount_in:
        Notional size the LP "tracked" over the period.  Used
        to size the swap-fee component.
    fee_bip:
        Pool fee in hundredths of a basis point (1/100 bp).
    price_ratio:
        Final / initial price ratio over the period.
    fees:
        Direct input — the absolute swap-fee revenue the LP
        booked (in the same unit as the reserves).  For the
        experiments endpoint this is a scenario parameter
        rather than something we recompute.
    rebates:
        Direct input — the absolute incentive / rebate revenue
        the LP booked (in the same unit as the reserves).
    """

    reserve0: int
    reserve1: int
    amount_in: int
    fee_bip: int
    price_ratio: float
    fees: int
    rebates: int


@dataclass(slots=True)
class AttributionResult:
    """The result of a single attribution run.

    The invariant is ::

        net_pnl == fees + il + rebates

    All values are raw integers in the same unit as the input
    reserves.  ``il`` is always ≤ 0; ``fees`` and ``rebates``
    are always ≥ 0.
    """

    fees: int
    il: int
    rebates: int
    net_pnl: int


def run_attribution(params: AttributionInput) -> AttributionResult:
    """Compute the 4-component attribution for a single period.

    The IL component is derived from the V2 IL formula applied
    to ``price_ratio`` (we use the V2 form because the
    experiment endpoint doesn't take V3 range info).  The
    components are then summed to give ``net_pnl``.
    """
    if params.price_ratio <= 0:
        raise ValueError(
            f"price_ratio must be > 0, got {params.price_ratio}"
        )

    # IL component: convert the float IL to a raw integer in
    # the reserve unit.  We anchor on the LP "size" (the
    # notional input) so the result is comparable to fees and
    # rebates, which are also denominated in that unit.
    il_float = calculate_il(
        IlInput(price_ratio=params.price_ratio, variant="v2")
    ).il
    # Anchor IL to the notional: a 5.7% IL on a 1 ETH notional
    # is ~0.057 ETH of loss.
    il_component = int(il_float * params.amount_in)

    # The fee revenue is passed in directly (it's a scenario
    # parameter for the experiments endpoint).  We sanity-check
    # it's non-negative.
    if params.fees < 0:
        raise ValueError(f"fees must be >= 0, got {params.fees}")
    if params.rebates < 0:
        raise ValueError(f"rebates must be >= 0, got {params.rebates}")

    # Touch the CPMM helper so the experiment endpoint's
    # import graph remains a single coherent layer
    # (attribution → cpmm + il).  The notional amount_in is
    # a no-op for the wire result; we use it to validate the
    # pool accepts it (i.e. the notional is not larger than
    # the reserves).
    if params.amount_in > 0 and params.reserve0 > 0:
        get_amount_out(
            amount_in=params.amount_in,
            reserve_in=params.reserve0,
            reserve_out=params.reserve1,
            fee_bip=params.fee_bip,
        )

    net_pnl = params.fees + il_component + params.rebates

    return AttributionResult(
        fees=params.fees,
        il=il_component,
        rebates=params.rebates,
        net_pnl=net_pnl,
    )


__all__ = [
    "AttributionInput",
    "AttributionResult",
    "run_attribution",
]
