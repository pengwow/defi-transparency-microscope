"""Liquidation watcher — pushes Aave V3 liquidation events to the hub.

The wire shape mirrors the TS `LiquidationEvent` payload the
frontend `WsClient` already consumes (see `WSLiquidationData`
in `ws/topics.py`).  In production the `source` factory
subscribes to the Aave V3 Pool `LiquidationCall` event; in
tests it's a list-based iterator.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any

from dtm_backend.watchers.base import WatcherBase
from dtm_backend.ws.hub import WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


@dataclass(slots=True, frozen=True)
class LiquidationEvent:
    """An Aave V3 `LiquidationCall` log decoded into typed fields."""

    borrower: str
    collateral: str
    debt: str
    health_factor: float

    def to_wire(self) -> dict[str, Any]:
        """Render the dict shape the WS envelope expects."""
        return {
            "borrower": self.borrower,
            "collateral": self.collateral,
            "debt": self.debt,
            "healthFactor": self.health_factor,
        }


class LiquidationWatcher(WatcherBase[LiquidationEvent]):
    """Async iterator that broadcasts each `LiquidationCall` as a `liquidation_event`."""

    def __init__(
        self,
        *,
        hub: WSHub,
        source: Callable[[], AsyncIterator[LiquidationEvent]],
        name: str = "liquidation-watcher",
    ) -> None:
        super().__init__(hub=hub, source=source, name=name)

    @property
    def topic(self) -> WSTopic:
        return WSTopic.LIQUIDATION

    def to_message(self, event: LiquidationEvent) -> WSMessage:
        return WSMessage.liquidation_event(event.to_wire())


__all__ = ["LiquidationEvent", "LiquidationWatcher"]
