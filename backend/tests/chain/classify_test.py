"""Unit tests for `dtm_backend.chain.classify`."""
from __future__ import annotations

from dtm_backend.chain.classify import (
    LIQUIDATION_TOPIC,
    ClassifiedLog,
    classify_log,
    summarize_window,
)
from dtm_backend.chain.types import MevType


def test_normal_swap_classified_as_normal() -> None:
    """A non-liquidation log is classified as NORMAL."""
    log = {
        "address": "0x" + "a" * 40,
        "topics": ["0x" + "b" * 64],  # arbitrary non-liquidation topic
        "data": "0x",
    }
    assert classify_log(log) is MevType.NORMAL


def test_liquidation_event_classified_as_liquidation() -> None:
    """An Aave V3 LiquidationCall event is classified as LIQUIDATION."""
    log = {
        "address": "0x" + "a" * 40,
        "topics": [LIQUIDATION_TOPIC],
        "data": "0x",
    }
    result = classify_log(log)
    assert result is MevType.LIQUIDATION


def test_classify_handles_missing_topics() -> None:
    """A log without topics is classified as NORMAL (defensive)."""
    assert classify_log({"address": "0x" + "a" * 40, "data": "0x"}) is MevType.NORMAL


def test_classify_handles_empty_topics() -> None:
    """A log with empty topics is classified as NORMAL."""
    assert classify_log({"address": "0x" + "a" * 40, "topics": [], "data": "0x"}) is MevType.NORMAL


def test_summarize_window_groups_by_classification() -> None:
    """`summarize_window` returns a count per MEV type."""
    logs = [
        {"address": "0x" + "1" * 40, "topics": ["0x" + "a" * 64], "data": "0x"},
        {"address": "0x" + "2" * 40, "topics": ["0x" + "a" * 64], "data": "0x"},
        {"address": "0x" + "3" * 40, "topics": [LIQUIDATION_TOPIC], "data": "0x"},
    ]
    counts = summarize_window(logs)
    assert counts[MevType.NORMAL] == 2
    assert counts[MevType.LIQUIDATION] == 1
    # No swaps counted as sandwich/arb/jit here.
    assert counts.get(MevType.SANDWICH, 0) == 0
    assert counts.get(MevType.ARBITRAGE, 0) == 0


def test_summarize_window_empty_input() -> None:
    """`summarize_window` returns zero counts for empty input."""
    counts = summarize_window([])
    assert counts == {}


def test_classified_log_dataclass_basic() -> None:
    """`ClassifiedLog` round-trips its fields."""
    cl = ClassifiedLog(
        address="0x" + "a" * 40,
        mev_type=MevType.SANDWICH,
        block_number=18_000_000,
        tx_hash="0x" + "b" * 64,
    )
    assert cl.address == "0x" + "a" * 40
    assert cl.mev_type is MevType.SANDWICH
    assert cl.block_number == 18_000_000
