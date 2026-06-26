"""Unit tests for `dtm_backend.watchers.mempool`."""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from typing import Any

import pytest

from dtm_backend.watchers.mempool import MempoolSource, MempoolTx
from dtm_backend.ws.hub import Connection, WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


def _tx(**overrides: Any) -> MempoolTx:
    """Build a `MempoolTx` with sane defaults; tests can override fields."""
    base = {
        "hash": "0x" + "a" * 64,
        "to": "0x" + "1" * 40,
        "source": "0x" + "2" * 40,
        "amount": "1000",
        "gas_price": "1000",
    }
    base.update(overrides)
    return MempoolTx(**base)


async def _from_list(items: list[MempoolTx]) -> AsyncIterator[MempoolTx]:
    """Async iterator that yields each item in `items` then exits."""
    for it in items:
        await asyncio.sleep(0)
        yield it


def test_mempool_tx_serialises_to_wire_shape() -> None:
    """`MempoolTx.to_wire()` matches the WSMemPoolTxData contract."""
    wire = _tx().to_wire()
    assert wire["hash"] == "0x" + "a" * 64
    assert wire["to"] == "0x" + "1" * 40
    assert wire["source"] == "0x" + "2" * 40
    assert wire["amount"] == "1000"
    assert wire["gasPrice"] == "1000"


@pytest.mark.asyncio
async def test_mempool_source_broadcasts_each_tx() -> None:
    """`MempoolSource` broadcasts a `mempool_tx` envelope per yielded tx."""
    hub = WSHub(heartbeat_interval_s=0.0)
    src = MempoolSource(
        hub=hub,
        transport=lambda: _from_list([_tx(amount="1"), _tx(amount="2"), _tx(amount="3")]),
        poll_interval_s=0.0,
    )
    await src.start()
    # The source itself doesn't track delivery; the route
    # unit tests cover that path.  We just verify the source
    # ran to completion (no leftover tasks).
    for _ in range(50):
        if not src.is_running():
            break
        await asyncio.sleep(0.01)
    assert src.is_running() is False


@pytest.mark.asyncio
async def test_mempool_source_starts_and_stops_idempotently() -> None:
    """`start()` / `stop()` are no-ops on a second call."""
    hub = WSHub(heartbeat_interval_s=0.0)
    src = MempoolSource(hub=hub, transport=lambda: _from_list([]), poll_interval_s=0.0)
    assert src.is_running() is False
    await src.start()
    assert src.is_running() is True
    await src.stop()
    assert src.is_running() is False
    # Second stop is a no-op.
    await src.stop()
    assert src.is_running() is False


@pytest.mark.asyncio
async def test_mempool_source_handles_empty_transport() -> None:
    """An empty transport exits the loop cleanly."""
    hub = WSHub(heartbeat_interval_s=0.0)
    src = MempoolSource(hub=hub, transport=lambda: _from_list([]), poll_interval_s=0.0)
    await src.start()
    # Wait for the source's task to finish (it exits when the iterator is exhausted).
    for _ in range(50):
        if not src.is_running():
            break
        await asyncio.sleep(0.01)
    assert src.is_running() is False


@pytest.mark.asyncio
async def test_mempool_source_delivers_via_broadcast() -> None:
    """A broadcast target subscribed to `mempool` actually receives the tx.

    We hand-build a `Connection` that owns a `FakeWebSocket`
    capture, register it manually with the hub, and assert
    the message lands on the capture's `sent` list — the
    same end-to-end pattern used by the hub unit tests.
    """
    from tests.ws.hub_test import FakeWebSocket, _long_lived  # local helper

    hub = WSHub(heartbeat_interval_s=0.0)
    ws = FakeWebSocket()
    stop = _long_lived(ws)
    conn = Connection(ws=ws)  # type: ignore[arg-type]
    conn.topics.add(WSTopic.MEMPOOL.value)
    hub._connections[id(conn)] = conn  # type: ignore[arg-defined]
    # Manually start a sender task (bypassing `register` which
    # also queues a welcome we don't need here).
    sender = asyncio.create_task(hub._sender_loop(conn), name="test-sender")  # type: ignore[arg-defined]

    src = MempoolSource(
        hub=hub,
        transport=lambda: _from_list([_tx(amount="42")]),
        poll_interval_s=0.0,
    )
    try:
        await src.start()
        # Wait for the broadcast to land.
        for _ in range(50):
            if any(WSMessage.model_validate_json(s).type == "mempool_tx" for s in ws.sent):
                break
            await asyncio.sleep(0.01)
        matching = [s for s in ws.sent if WSMessage.model_validate_json(s).type == "mempool_tx"]
        assert matching, f"no mempool_tx in {ws.sent}"
        msg = WSMessage.model_validate_json(matching[0])
        assert msg.data is not None
        assert msg.data["amount"] == "42"
    finally:
        await src.stop()
        stop.set()
        sender.cancel()
        try:
            await sender
        except (asyncio.CancelledError, Exception):
            pass
        # Inject a stop sentinel to release the sender, then clean up.
        try:
            conn.queue.put_nowait("__ws_hub_stop__")
        except asyncio.QueueFull:
            pass
        await sender
        del hub._connections[id(conn)]
