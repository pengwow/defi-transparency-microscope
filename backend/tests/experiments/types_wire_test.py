"""Unit tests for `dtm_backend.experiments.types`.

Pydantic v2 wire models for the experiments endpoints.  These
tests pin the *exact* wire format the frontend consumes —
including the camelCase aliases the route handlers will
forward untouched.
"""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from dtm_backend.experiments.types import (
    AttributionResponse,
    ExperimentConfigWire,
    IlRequest,
    IlResponse,
    SandwichRequest,
    SandwichResponse,
)

# ──────────────────────────────────────────────────────────────────────
# ExperimentConfigWire
# ──────────────────────────────────────────────────────────────────────


def test_experiment_config_wire_required_fields() -> None:
    """Required fields are exactly the ExperimentConfig subset."""
    with pytest.raises(ValidationError):
        ExperimentConfigWire()  # type: ignore[call-arg]


def test_experiment_config_wire_round_trip() -> None:
    """The wire format round-trips: Python → JSON → Python."""
    cfg = ExperimentConfigWire(
        name="Sandwich V2 USDC/WETH",
        description="desc",
        protocol="uniswap_v2",
        reserve0=80_000 * 10**18,
        reserve1=160_000_000 * 10**6,
        fee=3000,
        runs=100,
    )
    payload = cfg.model_dump(exclude_none=True, by_alias=True)
    assert payload["name"] == "Sandwich V2 USDC/WETH"
    assert payload["protocol"] == "uniswap_v2"
    assert payload["fee"] == 3000
    assert payload["runs"] == 100
    # Reserve fields are *strings* on the wire (bigint).
    assert isinstance(payload["reserve0"], str)
    assert isinstance(payload["reserve1"], str)


def test_experiment_config_wire_v3_optional_range_fields() -> None:
    """V3 range fields use camelCase aliases."""
    cfg = ExperimentConfigWire(
        name="Sandwich V3 WBTC/ETH",
        protocol="uniswap_v3",
        reserve0=1_000 * 10**8,
        reserve1=20_000 * 10**18,
        fee=3000,
        tickLower=250_000,
        tickUpper=260_000,
        runs=50,
    )
    payload = cfg.model_dump(exclude_none=True, by_alias=True)
    assert payload["tickLower"] == 250_000
    assert payload["tickUpper"] == 260_000


def test_experiment_config_wire_rejects_unknown_protocol() -> None:
    """Protocol must be `uniswap_v2` or `uniswap_v3`."""
    with pytest.raises(ValidationError):
        ExperimentConfigWire(
            name="x",
            protocol="uniswap_v4",  # type: ignore[arg-type]
            reserve0=10**18,
            reserve1=10**6,
            fee=3000,
            runs=1,
        )


# ──────────────────────────────────────────────────────────────────────
# SandwichRequest / SandwichResponse
# ──────────────────────────────────────────────────────────────────────


def test_sandwich_request_aliases() -> None:
    """The wire-format keys are camelCase (victimAmountIn, attackerAmountIn, …)."""
    req = SandwichRequest(
        reserve0=10**18,
        reserve1=10**6,
        victimAmountIn=10**18,
        attackerAmountIn=10**18,
        fee=3000,
    )
    payload = req.model_dump(exclude_none=True, by_alias=True)
    assert "victimAmountIn" in payload
    assert "attackerAmountIn" in payload
    assert "reserve0" in payload
    assert "fee" in payload


def test_sandwich_response_shape() -> None:
    """Sandwich response carries `attackerProfit` and `victimLoss`
    as decimal strings (bigint-on-the-wire)."""
    res = SandwichResponse(
        durationMs=5,
        result={
            "attackerProfit": "1000",
            "victimLoss": "500",
        },
    )
    payload = res.model_dump(by_alias=True)
    assert payload["durationMs"] == 5
    assert payload["result"]["attackerProfit"] == "1000"
    assert payload["result"]["victimLoss"] == "500"


# ──────────────────────────────────────────────────────────────────────
# IlRequest / IlResponse
# ──────────────────────────────────────────────────────────────────────


def test_il_request_optional_reserves() -> None:
    """``priceRatio`` is the only required field; reserves are
    optional and round-trip as decimal strings."""
    req = IlRequest(priceRatio=1.5)
    payload = req.model_dump(exclude_none=True, by_alias=True)
    assert payload["priceRatio"] == 1.5
    # reserve0 / reserve1 are not required.
    assert "reserve0" not in payload
    assert "reserve1" not in payload


def test_il_response_shape() -> None:
    """IL response: ``il`` is a float, ``variant`` is `v2`/`v3`,
    ``priceRatio`` echoes the input."""
    res = IlResponse(
        durationMs=7,
        result={"il": -0.057, "variant": "v2", "priceRatio": 2.0},
    )
    payload = res.model_dump(by_alias=True)
    assert payload["result"]["il"] == pytest.approx(-0.057, abs=1e-6)
    assert payload["result"]["variant"] == "v2"
    assert payload["result"]["priceRatio"] == 2.0


# ──────────────────────────────────────────────────────────────────────
# AttributionRequest / AttributionResponse
# ──────────────────────────────────────────────────────────────────────


def test_attribution_response_shape() -> None:
    """Attribution response: ``netPnl`` is a decimal string."""
    res = AttributionResponse(
        durationMs=11,
        result={"netPnl": "1000"},
    )
    payload = res.model_dump(by_alias=True)
    assert payload["durationMs"] == 11
    assert payload["result"]["netPnl"] == "1000"
