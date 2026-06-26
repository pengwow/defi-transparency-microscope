"""AMM sync watcher — pushes reserve refreshes to the hub as `amm_sync` events.

The wire shape mirrors the TS `AmmSync` payload the
frontend `WsClient` already consumes (see `WSAmmSyncData` in
`ws/topics.py`).  In production the `source` factory would
subscribe to `Sync(uint112,uint112)` events on each AMM
pool's ABI; in tests it's a list-based iterator.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any

from dtm_backend.watchers.base import WatcherBase
from dtm_backend.ws.hub import WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


@dataclass(slots=True, frozen=True)
class AmmSyncEvent:
    """An AMM `Sync` log decoded into typed fields."""

    pool_id: str
    reserve0: str
    reserve1: str
    block_number: int

    def to_wire(self) -> dict[str, Any]:
        """Render the dict shape the WS envelope expects."""
        return {
            "poolId": self.pool_id,
            "reserve0": self.reserve0,
            "reserve1": self.reserve1,
            "blockNumber": self.block_number,
        }


class AmmSyncWatcher(WatcherBase[AmmSyncEvent]):
    """Async iterator that broadcasts each `Sync` event as an `amm_sync` envelope."""

    def __init__(
        self,
        *,
        hub: WSHub,
        source: Callable[[], AsyncIterator[AmmSyncEvent]],
        name: str = "amm-sync-watcher",
    ) -> None:
        super().__init__(hub=hub, source=source, name=name)

    @property
    def topic(self) -> WSTopic:
        return WSTopic.AMM_SYNC

    def to_message(self, event: AmmSyncEvent) -> WSMessage:
        return WSMessage.amm_sync(event.to_wire())


__all__ = ["AmmSyncEvent", "AmmSyncWatcher"]
