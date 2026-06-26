"""Unit tests for `dtm_backend.watchers.liquidation`."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import pytest

from dtm_backend.watchers.liquidation import LiquidationEvent, LiquidationWatcher
from dtm_backend.ws.hub import Connection, WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


def _ev(**overrides: Any) -> LiquidationEvent:
    base = {
        "borrower": "0x" + "1" * 40,
        "collateral": "0x" + "2" * 40,
        "debt": "0x" + "3" * 40,
        "health_factor": 1.05,
    }
    base.update(overrides)
    return LiquidationEvent(**base)


async def _from_list(items: list[LiquidationEvent]) -> AsyncIterator[LiquidationEvent]:
    for it in items:
        await asyncio.sleep(0)
        yield it


def test_liquidation_event_serialises_to_wire_shape() -> None:
    """`LiquidationEvent.to_wire()` matches the WSLiquidationData contract."""
    wire = _ev().to_wire()
    assert wire == {
        "borrower": "0x" + "1" * 40,
        "collateral": "0x" + "2" * 40,
        "debt": "0x" + "3" * 40,
        "healthFactor": 1.05,
    }


@pytest.mark.asyncio
async def test_liquidation_watcher_broadcasts_each_event() -> None:
    """The watcher pushes each yielded event to the hub as `liquidation_event`."""
    from tests.ws.hub_test import FakeWebSocket, _long_lived

    hub = WSHub(heartbeat_interval_s=0.0)
    ws = FakeWebSocket()
    stop = _long_lived(ws)
    conn = Connection(ws=ws)  # type: ignore[arg-type]
    conn.topics.add(WSTopic.LIQUIDATION.value)
    hub._connections[id(conn)] = conn  # type: ignore[arg-defined]
    sender = asyncio.create_task(hub._sender_loop(conn), name="test-sender")  # type: ignore[arg-defined]

    watcher = LiquidationWatcher(
        hub=hub,
        source=lambda: _from_list([_ev(health_factor=0.9), _ev(health_factor=0.8)]),
    )
    try:
        await watcher.start()
        for _ in range(50):
            if (
                sum(
                    1
                    for s in ws.sent
                    if WSMessage.model_validate_json(s).type == "liquidation_event"
                )
                >= 2
            ):
                break
            await asyncio.sleep(0.01)
        matching = [
            s for s in ws.sent if WSMessage.model_validate_json(s).type == "liquidation_event"
        ]
        assert len(matching) == 2
        first = WSMessage.model_validate_json(matching[0])
        second = WSMessage.model_validate_json(matching[1])
        assert first.data is not None
        assert second.data is not None
        assert first.data["healthFactor"] == 0.9
        assert second.data["healthFactor"] == 0.8
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
async def test_liquidation_watcher_start_stop_lifecycle() -> None:
    """`start()` / `stop()` flip `is_running()` and are idempotent."""
    hub = WSHub(heartbeat_interval_s=0.0)
    watcher = LiquidationWatcher(hub=hub, source=lambda: _from_list([]))
    assert watcher.is_running() is False
    await watcher.start()
    assert watcher.is_running() is True
    await watcher.stop()
    assert watcher.is_running() is False
    await watcher.stop()  # idempotent
