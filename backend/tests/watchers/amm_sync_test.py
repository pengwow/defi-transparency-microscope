"""Unit tests for `dtm_backend.watchers.amm_sync`."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import pytest

from dtm_backend.watchers.amm_sync import AmmSyncEvent, AmmSyncWatcher
from dtm_backend.ws.hub import Connection, WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


def _ev(**overrides: Any) -> AmmSyncEvent:
    base = {
        "pool_id": "0x" + "1" * 40,
        "reserve0": "1000",
        "reserve1": "2000",
        "block_number": 18_000_000,
    }
    base.update(overrides)
    return AmmSyncEvent(**base)


async def _from_list(items: list[AmmSyncEvent]) -> AsyncIterator[AmmSyncEvent]:
    for it in items:
        await asyncio.sleep(0)
        yield it


def test_amm_sync_event_serialises_to_wire_shape() -> None:
    """`AmmSyncEvent.to_wire()` matches the WSAmmSyncData contract."""
    wire = _ev().to_wire()
    assert wire == {
        "poolId": "0x" + "1" * 40,
        "reserve0": "1000",
        "reserve1": "2000",
        "blockNumber": 18_000_000,
    }


@pytest.mark.asyncio
async def test_amm_sync_watcher_broadcasts_each_event() -> None:
    """The watcher pushes each yielded event to the hub as `amm_sync`."""
    from tests.ws.hub_test import FakeWebSocket, _long_lived

    hub = WSHub(heartbeat_interval_s=0.0)
    ws = FakeWebSocket()
    stop = _long_lived(ws)
    conn = Connection(ws=ws)  # type: ignore[arg-type]
    conn.topics.add(WSTopic.AMM_SYNC.value)
    hub._connections[id(conn)] = conn  # type: ignore[arg-defined]
    sender = asyncio.create_task(hub._sender_loop(conn), name="test-sender")  # type: ignore[arg-defined]

    watcher = AmmSyncWatcher(
        hub=hub,
        source=lambda: _from_list([_ev(reserve0="1"), _ev(reserve0="2")]),
    )
    try:
        await watcher.start()
        for _ in range(50):
            if sum(1 for s in ws.sent if WSMessage.model_validate_json(s).type == "amm_sync") >= 2:
                break
            await asyncio.sleep(0.01)
        matching = [s for s in ws.sent if WSMessage.model_validate_json(s).type == "amm_sync"]
        assert len(matching) == 2
        first = WSMessage.model_validate_json(matching[0])
        second = WSMessage.model_validate_json(matching[1])
        assert first.data is not None
        assert second.data is not None
        assert first.data["reserve0"] == "1"
        assert second.data["reserve0"] == "2"
    finally:
        await watcher.stop()
        stop.set()
        sender.cancel()
        try:
            await sender
        except (asyncio.CancelledError, Exception):
            pass
        try:
            conn.queue.put_nowait("__ws_hub_stop__")
        except asyncio.QueueFull:
            pass
        await sender
        del hub._connections[id(conn)]


@pytest.mark.asyncio
async def test_amm_sync_watcher_start_stop_lifecycle() -> None:
    """`start()` / `stop()` flip `is_running()` and are idempotent."""
    hub = WSHub(heartbeat_interval_s=0.0)
    watcher = AmmSyncWatcher(hub=hub, source=lambda: _from_list([]))
    assert watcher.is_running() is False
    await watcher.start()
    assert watcher.is_running() is True
    await watcher.stop()
    assert watcher.is_running() is False
    await watcher.stop()  # idempotent
