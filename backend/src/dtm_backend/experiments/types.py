"""Pydantic v2 wire models for the experiments endpoints.

These models are byte-level compatible with the frontend's
`ExperimentConfig` / `SandwichScenario` types and the JSON
returned by `HttpAPI.runSandwichExperiment`,
`HttpAPI.runILExperiment`, and
`HttpAPI.runAttributionExperiment`.

The bigint-on-the-wire fields (``reserve0``, ``reserve1``,
``victimAmountIn``, ``attackerAmountIn``, ``amountIn``) are
serialized as decimal strings via :class:`BigIntStr`; the
``fee`` field is an ``int`` in hundredths of a basis point
(1/100 bp).

Note on the V3 range fields:
  * V3 range fields use camelCase (``tickLower`` /
    ``tickUpper``) to match the frontend's
    `ExperimentConfig`.  They are optional and omitted
    from the wire when not provided.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from dtm_backend.chain.types import BigIntStr

# Match the frontend `DexProtocol` literal exactly.
Protocol = Literal["uniswap_v2", "uniswap_v3"]


class _WireModel(BaseModel):
    """Base for all wire models — strict, alias-aware, bigint-friendly."""

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ExperimentConfigWire(_WireModel):
    """Wire model for the `ExperimentConfig` shape.

    Mirrors the frontend's `ExperimentConfig` exactly
    (including the camelCase range fields and the
    bigint-as-decimal-string reserves).
    """

    name: str
    description: str | None = None
    protocol: Protocol
    reserve0: BigIntStr
    reserve1: BigIntStr
    fee: int = Field(ge=0, lt=1_000_000)
    tickLower: int | None = None
    tickUpper: int | None = None
    runs: int = Field(ge=1)


class SandwichRequest(_WireModel):
    """Request body for `POST /api/v1/experiments/sandwich`."""

    reserve0: BigIntStr
    reserve1: BigIntStr
    victimAmountIn: BigIntStr
    attackerAmountIn: BigIntStr
    fee: int = Field(ge=0, lt=1_000_000)


class SandwichResponse(_WireModel):
    """Response body for `POST /api/v1/experiments/sandwich`."""

    durationMs: int = Field(ge=0)
    result: Mapping[str, Any]


class IlRequest(_WireModel):
    """Request body for `POST /api/v1/experiments/il`."""

    priceRatio: float = Field(gt=0)
    reserve0: BigIntStr | None = None
    reserve1: BigIntStr | None = None
    fee: int | None = Field(default=None, ge=0, lt=1_000_000)
    variant: Literal["v2", "v3"] | None = None
    concentration: float | None = Field(default=None, gt=0)


class IlResponse(_WireModel):
    """Response body for `POST /api/v1/experiments/il`."""

    durationMs: int = Field(ge=0)
    result: Mapping[str, Any]


class AttributionRequest(_WireModel):
    """Request body for `POST /api/v1/experiments/attribution`."""

    reserve0: BigIntStr
    reserve1: BigIntStr
    amountIn: BigIntStr
    fee: int = Field(ge=0, lt=1_000_000)
    priceRatio: float = Field(gt=0)
    fees: BigIntStr = 0
    rebates: BigIntStr = 0


class AttributionResponse(_WireModel):
    """Response body for `POST /api/v1/experiments/attribution`."""

    durationMs: int = Field(ge=0)
    result: Mapping[str, Any]


def preset_to_wire_dict(
    preset_id: str,
    name: str,
    description: str | None,
    config: Mapping[str, Any],
) -> dict[str, Any]:
    """Render a single preset as the wire-format dict the
    frontend consumes on `GET /api/v1/experiments`.

    The shape is::

        {
          "id":          "<preset_id>",
          "name":        "<name>",
          "description": "<description>" | null,
          "config":      { ...ExperimentConfigWire fields... }
        }
    """
    cfg_dump = ExperimentConfigWire(
        name=config["name"],
        description=config.get("description"),
        protocol=config["protocol"],
        reserve0=config["reserve0"],
        reserve1=config["reserve1"],
        fee=config["fee"],
        tickLower=config.get("tickLower"),
        tickUpper=config.get("tickUpper"),
        runs=config["runs"],
    ).model_dump(exclude_none=True, by_alias=True)
    return {
        "id": preset_id,
        "name": name,
        "description": description,
        "config": cfg_dump,
    }


__all__ = [
    "AttributionRequest",
    "AttributionResponse",
    "ExperimentConfigWire",
    "IlRequest",
    "IlResponse",
    "Protocol",
    "SandwichRequest",
    "SandwichResponse",
    "preset_to_wire_dict",
]
