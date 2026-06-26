"""Watchers — async event sources that feed the WS hub.

Phase 4 of the build plan — three watchers, one common
pattern: each one pulls events from a `transport` (or
`source`) async iterator, builds the wire envelope via
`WSMessage`, and broadcasts it to the hub.  The transport is
injected so tests can drive deterministic event streams; in
production the transport is the chain provider or a JSON-RPC
client.

The shared `start()` / `stop()` lifecycle and the broadcast
loop live in `_WatcherBase`.  Each concrete watcher owns its
event type and its `to_wire()` mapping.
"""

from __future__ import annotations

from dtm_backend.watchers.amm_sync import AmmSyncEvent, AmmSyncWatcher
from dtm_backend.watchers.base import WatcherBase
from dtm_backend.watchers.liquidation import LiquidationEvent, LiquidationWatcher
from dtm_backend.watchers.mempool import MempoolSource, MempoolTx

__all__ = [
    "AmmSyncEvent",
    "AmmSyncWatcher",
    "LiquidationEvent",
    "LiquidationWatcher",
    "MempoolSource",
    "MempoolTx",
    "WatcherBase",
]
