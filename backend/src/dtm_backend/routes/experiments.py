"""Routes for the experiments layer.

Endpoints (all under ``/api/v1``):

* ``GET  /experiments``             — list 4 in-memory presets
* ``GET  /experiments/{id}``        — single preset; 404 if unknown
* ``POST /experiments/sandwich``    — run a sandwich simulation
* ``POST /experiments/il``          — compute V2 / V3 IL
* ``POST /experiments/attribution`` — 4-component PnL decomposition

All five routes are pure math — they do not touch the chain
or `app.state`.  The route is responsible for:

1. Validating the request body via the Pydantic models in
   `dtm_backend.experiments.types`.
2. Calling the underlying pure-math helper.
3. Timing the run (``duration_ms``) and serializing the
   result to the wire format.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Path, status

from dtm_backend.experiments.attribution import (
    AttributionInput,
    run_attribution,
)
from dtm_backend.experiments.il import IlInput, calculate_il
from dtm_backend.experiments.presets import get_preset, list_presets
from dtm_backend.experiments.sandwich import SandwichInput, run_sandwich
from dtm_backend.experiments.types import (
    AttributionRequest,
    IlRequest,
    SandwichRequest,
    preset_to_wire_dict,
)

router = APIRouter(prefix="/experiments", tags=["experiments"])


# ──────────────────────────────────────────────────────────────────────
# GET /experiments
# ──────────────────────────────────────────────────────────────────────


@router.get("", response_model=None)
async def list_experiments() -> list[dict[str, Any]]:
    """Return the 4 in-memory presets in canonical order."""
    out: list[dict[str, Any]] = []
    for preset in list_presets():
        out.append(
            preset_to_wire_dict(
                preset_id=preset.id,
                name=preset.name,
                description=preset.description,
                config={
                    "name": preset.config.name,
                    "description": preset.config.description,
                    "protocol": preset.config.protocol,
                    "reserve0": preset.config.reserve0,
                    "reserve1": preset.config.reserve1,
                    "fee": preset.config.fee,
                    "tickLower": preset.config.tick_lower,
                    "tickUpper": preset.config.tick_upper,
                    "runs": preset.config.runs,
                },
            )
        )
    return out


# ──────────────────────────────────────────────────────────────────────
# GET /experiments/{id}
# ──────────────────────────────────────────────────────────────────────


@router.get("/{preset_id}", response_model=None)
async def get_experiment(
    preset_id: str = Path(..., min_length=1, max_length=64),
) -> dict[str, Any]:
    """Return a single preset; 404 if the id is unknown."""
    try:
        preset = get_preset(preset_id)
    except KeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"unknown experiment preset: {preset_id!r}",
        ) from exc
    return preset_to_wire_dict(
        preset_id=preset.id,
        name=preset.name,
        description=preset.description,
        config={
            "name": preset.config.name,
            "description": preset.config.description,
            "protocol": preset.config.protocol,
            "reserve0": preset.config.reserve0,
            "reserve1": preset.config.reserve1,
            "fee": preset.config.fee,
            "tickLower": preset.config.tick_lower,
            "tickUpper": preset.config.tick_upper,
            "runs": preset.config.runs,
        },
    )


# ──────────────────────────────────────────────────────────────────────
# POST /experiments/sandwich
# ──────────────────────────────────────────────────────────────────────


@router.post("/sandwich", response_model=None)
async def run_sandwich_route(body: SandwichRequest) -> dict[str, Any]:
    """Run a 3-swap sandwich attack simulation."""
    t0 = time.perf_counter()
    res = run_sandwich(
        SandwichInput(
            reserve0=int(body.reserve0),
            reserve1=int(body.reserve1),
            victim_amount_in=int(body.victimAmountIn),
            attacker_amount_in=int(body.attackerAmountIn),
            fee_bip=int(body.fee),
        )
    )
    duration_ms = int((time.perf_counter() - t0) * 1000)
    return {
        "durationMs": duration_ms,
        "result": {
            "attackerProfit": str(res.attacker_profit),
            "victimLoss": str(res.victim_loss),
        },
    }


# ──────────────────────────────────────────────────────────────────────
# POST /experiments/il
# ──────────────────────────────────────────────────────────────────────


@router.post("/il", response_model=None)
async def run_il_route(body: IlRequest) -> dict[str, Any]:
    """Compute the V2 or V3 IL for the given price ratio."""
    t0 = time.perf_counter()
    res = calculate_il(
        IlInput(
            price_ratio=body.priceRatio,
            variant=body.variant or "v2",
            concentration=body.concentration or 4.0,
        )
    )
    duration_ms = int((time.perf_counter() - t0) * 1000)
    return {
        "durationMs": duration_ms,
        "result": {
            "il": res.il,
            "variant": res.variant,
            "priceRatio": res.price_ratio,
        },
    }


# ──────────────────────────────────────────────────────────────────────
# POST /experiments/attribution
# ──────────────────────────────────────────────────────────────────────


@router.post("/attribution", response_model=None)
async def run_attribution_route(body: AttributionRequest) -> dict[str, Any]:
    """Decompose a single-period LP return into 4 components."""
    t0 = time.perf_counter()
    res = run_attribution(
        AttributionInput(
            reserve0=int(body.reserve0),
            reserve1=int(body.reserve1),
            amount_in=int(body.amountIn),
            fee_bip=int(body.fee),
            price_ratio=body.priceRatio,
            fees=int(body.fees),
            rebates=int(body.rebates),
        )
    )
    duration_ms = int((time.perf_counter() - t0) * 1000)
    return {
        "durationMs": duration_ms,
        "result": {
            "netPnl": str(res.net_pnl),
        },
    }


__all__ = ["router"]
