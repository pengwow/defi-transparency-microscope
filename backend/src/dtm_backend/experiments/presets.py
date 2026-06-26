"""In-memory experiment presets served by `GET /api/v1/experiments`.

The backend ships with 4 curated presets the frontend can list
and run.  Each preset is fully self-describing — the frontend
treats the result as an `ExperimentConfig` and dispatches it
to the appropriate `POST /api/v1/experiments/{variant}`
endpoint.

The 4 ids are:

  1. ``sandwich-v2-usdc-weth``       — V2 USDC/WETH 0.3% fee
  2. ``sandwich-usdc-weth-v3-5bps``  — V3 USDC/WETH 5 bps
  3. ``sandwich-wbtc-eth-v3``        — V3 WBTC/ETH 30 bps
  4. ``attribution-v2-usdc-weth``    — V2 USDC/WETH 0.3% fee
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final, Literal

# Mirror the frontend's `DexProtocol` literal.
Protocol = Literal["uniswap_v2", "uniswap_v3"]


@dataclass(slots=True)
class PresetConfig:
    """Self-describing preset configuration.

    The fields are the wire-format subset of the frontend's
    `ExperimentConfig` — names match exactly so the route can
    call :func:`dtm_backend.experiments.types.preset_config_to_wire`
    to produce the JSON.
    """

    name: str
    description: str | None
    protocol: Protocol
    reserve0: int
    reserve1: int
    fee: int
    tick_lower: int | None
    tick_upper: int | None
    runs: int


@dataclass(slots=True)
class Preset:
    """A single experiment preset (id + human label + config)."""

    id: str
    name: str
    description: str | None
    config: PresetConfig


# ──────────────────────────────────────────────────────────────────────
# The 4 curated presets.  Reserves are pulled from the rough
# 2024-Q4 mainnet USDC/WETH V2 / V3 / WBTC/ETH V3 order of
# magnitude.  Fees are in hundredths of a basis point (1/100 bp).
# ──────────────────────────────────────────────────────────────────────

_SANDWICH_V2_USDC_WETH = Preset(
    id="sandwich-v2-usdc-weth",
    name="Sandwich: USDC/WETH (V2 0.3%)",
    description=(
        "Classic 3-swap sandwich on a V2 USDC/WETH 0.3% pool. "
        "Use as a baseline for MEV extraction on legacy pairs."
    ),
    config=PresetConfig(
        name="Sandwich V2 USDC/WETH",
        description="V2 0.3% pool, 100 simulation runs.",
        protocol="uniswap_v2",
        reserve0=80_000 * 10**18,       # 80 000 WETH (token0)
        reserve1=160_000_000 * 10**6,   # 160 000 000 USDC (token1)
        fee=3000,                       # 0.3%
        tick_lower=None,
        tick_upper=None,
        runs=100,
    ),
)

_SANDWICH_V3_USDC_WETH_5BPS = Preset(
    id="sandwich-usdc-weth-v3-5bps",
    name="Sandwich: USDC/WETH (V3 5 bps)",
    description=(
        "3-swap sandwich on the deepest V3 USDC/WETH 5 bps pool. "
        "Lower fee tier ⇒ more value to extract from the victim."
    ),
    config=PresetConfig(
        name="Sandwich V3 USDC/WETH 5bps",
        description="V3 5 bps pool, 100 simulation runs.",
        protocol="uniswap_v3",
        reserve0=40_000 * 10**18,
        reserve1=80_000_000 * 10**6,
        fee=500,                        # 5 bps
        tick_lower=None,
        tick_upper=None,
        runs=100,
    ),
)

_SANDWICH_V3_WBTC_ETH = Preset(
    id="sandwich-wbtc-eth-v3",
    name="Sandwich: WBTC/ETH (V3 30 bps)",
    description=(
        "3-swap sandwich on a V3 WBTC/ETH 30 bps pool, "
        "concentrated around the geometric-mean tick."
    ),
    config=PresetConfig(
        name="Sandwich V3 WBTC/ETH",
        description="V3 30 bps pool with explicit tick range.",
        protocol="uniswap_v3",
        reserve0=1_000 * 10**8,         # 1 000 WBTC (8 decimals)
        reserve1=20_000 * 10**18,       # 20 000 WETH
        fee=3000,                       # 30 bps
        tick_lower=250_000,
        tick_upper=260_000,
        runs=50,
    ),
)

_ATTRIBUTION_V2_USDC_WETH = Preset(
    id="attribution-v2-usdc-weth",
    name="Attribution: USDC/WETH (V2 0.3%)",
    description=(
        "4-component PnL attribution (fees / IL / rebates / net) "
        "for a V2 USDC/WETH 0.3% position over a single period."
    ),
    config=PresetConfig(
        name="Attribution V2 USDC/WETH",
        description="V2 0.3% pool, single-period attribution.",
        protocol="uniswap_v2",
        reserve0=80_000 * 10**18,
        reserve1=160_000_000 * 10**6,
        fee=3000,
        tick_lower=None,
        tick_upper=None,
        runs=50,
    ),
)

# The order is significant: it dictates the order of the
# `GET /api/v1/experiments` response, which is what the
# frontend renders in its preset dropdown.
_PRESETS: Final[tuple[Preset, ...]] = (
    _SANDWICH_V2_USDC_WETH,
    _SANDWICH_V3_USDC_WETH_5BPS,
    _SANDWICH_V3_WBTC_ETH,
    _ATTRIBUTION_V2_USDC_WETH,
)

# Frozen public id list (re-exported for tests + routes).
PRESET_IDS: Final[tuple[str, ...]] = tuple(p.id for p in _PRESETS)


def list_presets() -> tuple[Preset, ...]:
    """Return the 4 in-memory presets, in canonical order."""
    return _PRESETS


def get_preset(preset_id: str) -> Preset:
    """Return a single preset by id; ``KeyError`` on miss."""
    for p in _PRESETS:
        if p.id == preset_id:
            return p
    raise KeyError(f"unknown experiment preset: {preset_id!r}")


__all__ = [
    "PRESET_IDS",
    "Preset",
    "PresetConfig",
    "Protocol",
    "get_preset",
    "list_presets",
]
