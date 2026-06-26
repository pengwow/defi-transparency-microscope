"""Mempool watcher — pushes pending txs to the hub as `mempool_tx` events.

The wire shape is the same as the TS `MempoolTx` payload the
frontend `WsClient` already consumes (see `WSMemPoolTxData`
in `ws/topics.py`).
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from dataclasses import dataclass
from typing import Any

from dtm_backend.watchers.base import WatcherBase
from dtm_backend.ws.hub import WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


@dataclass(slots=True, frozen=True)
class MempoolTx:
    """A pending transaction observed in the mempool.

    `source` mirrors the wire `from` key — we use the Python
    keyword alias internally so the dataclass reads naturally
    and the wire layer is the only place that does the rename.
    """

    hash: str
    to: str
    source: str
    amount: str
    gas_price: str

    def to_wire(self) -> dict[str, Any]:
        """Render the dict shape the WS envelope expects."""
        return {
            "hash": self.hash,
            "to": self.to,
            "source": self.source,
            "amount": self.amount,
            "gasPrice": self.gas_price,
        }


class MempoolSource(WatcherBase[MempoolTx]):
    """Async iterator that turns each `MempoolTx` into a `mempool_tx` envelope.

    The `transport` callable returns a fresh `AsyncIterator`
    each time it's invoked.  In production this is the
    JSON-RPC `eth_subscribe("pendingTransactions")` stream; in
    tests it's a finite list-based iterator.
    """

    def __init__(
        self,
        *,
        hub: WSHub,
        transport: Callable[[], AsyncIterator[MempoolTx]],
        poll_interval_s: float = 1.5,
        name: str = "mempool-watcher",
    ) -> None:
        super().__init__(hub=hub, source=transport, name=name)
        # `poll_interval_s` is the fallback HTTP poll cadence
        # used when the JSON-RPC WS endpoint isn't available.
        # It's not consumed directly by the loop — the
        # transport factory can read it via closure if it
        # wants to.
        self._poll_interval_s = poll_interval_s

    @property
    def poll_interval_s(self) -> float:
        return self._poll_interval_s

    @property
    def topic(self) -> WSTopic:
        return WSTopic.MEMPOOL

    def to_message(self, event: MempoolTx) -> WSMessage:
        return WSMessage.mempool_tx(event.to_wire())


__all__ = ["MempoolSource", "MempoolTx"]
