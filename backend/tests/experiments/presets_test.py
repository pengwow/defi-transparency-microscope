"""Unit tests for `dtm_backend.experiments.presets`.

The backend ships with 4 in-memory experiment presets the
frontend can fetch via `GET /api/v1/experiments`.  These
tests pin the *shape* of that payload — id, name, config
fields — and the look-up semantics of `get_preset`.

The four ids are:

  1. ``sandwich-v2-usdc-weth``       — V2 USDC/WETH 0.3% fee
  2. ``sandwich-usdc-weth-v3-5bps``  — V3 USDC/WETH 5 bps
  3. ``sandwich-wbtc-eth-v3``        — V3 WBTC/ETH 30 bps
  4. ``attribution-v2-usdc-weth``    — V2 USDC/WETH 0.3% fee
"""
from __future__ import annotations

import pytest

from dtm_backend.experiments.presets import (
    PRESET_IDS,
    get_preset,
    list_presets,
)


def test_list_presets_returns_four_presets() -> None:
    """There are exactly 4 presets."""
    presets = list_presets()
    assert len(presets) == 4


def test_presets_have_unique_ids() -> None:
    """No two presets share the same id."""
    presets = list_presets()
    ids = [p.id for p in presets]
    assert len(ids) == len(set(ids))


def test_preset_ids_match_public_constant() -> None:
    """The exported `PRESET_IDS` matches the live list."""
    assert set(PRESET_IDS) == {p.id for p in list_presets()}
    assert len(PRESET_IDS) == 4


def test_preset_wire_shape() -> None:
    """Each preset is a dict with id / name / config — wire-format
    compatible with the frontend's `ExperimentConfig`."""
    presets = list_presets()
    for p in presets:
        assert isinstance(p.id, str) and p.id
        assert isinstance(p.name, str) and p.name
        assert p.config is not None
        assert isinstance(p.config.name, str) and p.config.name
        assert p.config.protocol in ("uniswap_v2", "uniswap_v3")
        assert isinstance(p.config.reserve0, int)
        assert isinstance(p.config.reserve1, int)
        assert isinstance(p.config.fee, int)
        assert isinstance(p.config.runs, int)
        # reserve0 / reserve1 must be positive (the pools are
        # well-defined; the experiments module raises on
        # non-positive reserves).
        assert p.config.reserve0 > 0
        assert p.config.reserve1 > 0
        assert 0 <= p.config.fee < 1_000_000  # 0% < fee < 100%


def test_sandwich_v2_preset_has_no_v3_range() -> None:
    """V2 presets must not carry V3 range info."""
    p = get_preset("sandwich-v2-usdc-weth")
    assert p.config.protocol == "uniswap_v2"
    assert p.config.tick_lower is None
    assert p.config.tick_upper is None


def test_v3_presets_carry_optional_range() -> None:
    """V3 presets carry an optional tick range."""
    p = get_preset("sandwich-wbtc-eth-v3")
    assert p.config.protocol == "uniswap_v3"
    # The WBTC/ETH V3 preset defines a range.
    assert p.config.tick_lower is not None
    assert p.config.tick_upper is not None
    assert p.config.tick_lower < p.config.tick_upper


def test_get_preset_raises_for_unknown_id() -> None:
    """Unknown ids raise `KeyError` (routes convert to 404)."""
    with pytest.raises(KeyError):
        get_preset("does-not-exist")


def test_get_preset_returns_the_same_object_as_list_presets() -> None:
    """`get_preset(id)` looks up by id; result is in `list_presets()`."""
    presets = {p.id: p for p in list_presets()}
    for pid in PRESET_IDS:
        assert get_preset(pid) is presets[pid]
