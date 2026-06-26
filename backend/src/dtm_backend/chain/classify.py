"""Pure-function log classification for MEV detection.

The wire layer hands us raw `eth_getLogs` entries.  Before they
turn into a `Transaction` we want a `MevType` so the frontend can
filter / colour-code the feed.

This module is intentionally dependency-free — no web3, no IO,
no Pydantic.  It only inspects the `topics[0]` (the event
signature hash) and decides which bucket the log belongs to.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final

from eth_utils import keccak  # type: ignore[attr-defined]

from dtm_backend.chain.types import MevType

# Aave V3 Pool `LiquidationCall` event signature.
#   LiquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)
_LIQUIDATION_SIG: Final[str] = (
    "LiquidationCall(address,address,address,uint256,uint256,address,bool)"
)
LIQUIDATION_TOPIC: Final[str] = "0x" + keccak(text=_LIQUIDATION_SIG).hex()


@dataclass(slots=True)
class ClassifiedLog:
    """A log that has been tagged with its MEV bucket."""

    address: str
    mev_type: MevType
    block_number: int | None = None
    tx_hash: str | None = None
    log_index: int | None = None


def classify_log(log: dict[str, Any]) -> MevType:
    """Classify a single raw `eth_getLogs` entry.

    Rules (in order):
      1. `topics[0] == LIQUIDATION_TOPIC`     → LIQUIDATION
      2. otherwise                            → NORMAL

    Sandwich / arbitrage / JIT detection is layered on top of this
    classifier in a later pass (Phase 2g wires it up against the
    full `transactions` window).
    """
    topics = log.get("topics") or []
    if not topics:
        return MevType.NORMAL
    topic0 = topics[0]
    if topic0 == LIQUIDATION_TOPIC:
        return MevType.LIQUIDATION
    return MevType.NORMAL


def summarize_window(
    logs: list[dict[str, Any]],
) -> dict[MevType, int]:
    """Return a `{MevType: count}` map for a window of raw logs.

    Used by the experiments layer to compute sandwich / arb rates
    and by the `/health` debug endpoint to show recent activity.
    """
    counts: dict[MevType, int] = {}
    for log in logs:
        kind = classify_log(log)
        counts[kind] = counts.get(kind, 0) + 1
    return counts


__all__ = ["ClassifiedLog", "classify_log", "summarize_window", "LIQUIDATION_TOPIC"]
