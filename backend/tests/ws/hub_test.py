"""Unit tests for `dtm_backend.ws.hub`.

The hub owns the per-connection `asyncio.Queue` and the
broadcast machinery.  We drive it with a fake WebSocket
implementation so the tests don't need a live server; the
integration suite (`tests/integration/ws_test.py`) is the
end-to-end check against FastAPI's real WebSocket transport.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import Callable
from dataclasses import dataclass, field

import pytest

from dtm_backend.ws.hub import Connection, WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic

# ──────────────────────────────────────────────────────────────────────
# Fake WebSocket
# ──────────────────────────────────────────────────────────────────────


@dataclass(slots=True)
class FakeWebSocket:
    """Minimal stand-in for `fastapi.WebSocket` used by the hub."""

    sent: list[str] = field(default_factory=list)
    received: list[str] = field(default_factory=list)
    accept_called: bool = False
    closed: bool = False
    send_event: asyncio.Event = field(default_factory=asyncio.Event)
    # Optional hook to intercept send_text (used by the slow-consumer test).
    send_block: Callable[[str], asyncio.Future[None]] | None = None
    # Optional hook called by receive_text — let tests simulate disconnects.
    receive_block: Callable[[], asyncio.Future[str]] | None = None

    async def accept(self) -> None:
        self.accept_called = True

    async def send_text(self, data: str) -> None:
        if self.send_block is not None:
            await self.send_block(data)
        self.sent.append(data)
        self.send_event.set()

    async def receive_text(self) -> str:
        if self.receive_block is not None:
            return await self.receive_block()
        if not self.received:
            # Simulate a long-lived connection: wait for more input.
            try:
                await asyncio.wait_for(self.send_event.wait(), timeout=2.0)
            except TimeoutError:
                pass
        if not self.received:
            # Still nothing → emulate a client disconnect.
            from starlette.websockets import WebSocketDisconnect  # type: ignore[import-not-found]

            raise WebSocketDisconnect(code=1000)
        return self.received.pop(0)

    async def close(self) -> None:
        self.closed = True


def _parse_envelopes(ws: FakeWebSocket) -> list[WSMessage]:
    """Parse every JSON string on `ws.sent` into a `WSMessage`."""
    return [WSMessage.model_validate(json.loads(s)) for s in ws.sent]


def _envelope_types(ws: FakeWebSocket) -> list[str]:
    """Return the `type` field of every envelope on `ws.sent`."""
    return [e.type for e in _parse_envelopes(ws)]


def _hub() -> WSHub:
    """Fresh hub for each test."""
    return WSHub(heartbeat_interval_s=0.0)


async def _wait_for(predicate: Callable[[], bool], *, timeout: float = 1.0) -> None:
    """Poll `predicate` until it returns True or `timeout` elapses."""
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        if predicate():
            return
        await asyncio.sleep(0.01)
    raise AssertionError(f"predicate did not become true within {timeout}s")


def _enqueue_then_disconnect(ws: FakeWebSocket, payloads: list[str]) -> None:
    """Queue a sequence of action messages, then disconnect.

    Each queued action is delivered one-at-a-time; once the
    queue is empty, the next `receive_text()` raises
    `WebSocketDisconnect`, simulating the client going away.
    """
    for p in payloads:
        ws.received.append(p)

    async def _block() -> str:
        if ws.received:
            return ws.received.pop(0)
        from starlette.websockets import WebSocketDisconnect  # type: ignore[import-not-found]

        raise WebSocketDisconnect(code=1000)

    ws.receive_block = _block


def _long_lived(ws: FakeWebSocket) -> asyncio.Event:
    """Configure a `FakeWebSocket` that stays open until cancelled.

    `receive_text()` blocks on an internal `asyncio.Event` —
    tests can set the returned event to release the receive
    loop (which then raises `WebSocketDisconnect`, letting the
    hub's receiver/sender exit cleanly).
    """
    stop = asyncio.Event()

    async def _block() -> str:
        await stop.wait()
        from starlette.websockets import WebSocketDisconnect  # type: ignore[import-not-found]

        raise WebSocketDisconnect(code=1000)

    ws.receive_block = _block
    return stop


# ──────────────────────────────────────────────────────────────────────
# Tests
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_register_emits_welcome() -> None:
    """`register()` sends `{ "type": "welcome" }` asynchronously via the sender."""
    hub = _hub()
    ws = FakeWebSocket()
    conn = await hub.register(ws)  # type: ignore[arg-type]
    try:
        assert ws.accept_called is True
        await _wait_for(lambda: bool(_envelope_types(ws)))
        assert _envelope_types(ws) == ["welcome"]
    finally:
        await hub.unregister(conn)


@pytest.mark.asyncio
async def test_is_connected_tracks_active_registrations() -> None:
    """`is_connected()` reflects the live registration count."""
    hub = _hub()
    assert hub.is_connected() is False
    a = FakeWebSocket()
    b = FakeWebSocket()
    conn_a = await hub.register(a)  # type: ignore[arg-type]
    conn_b = await hub.register(b)  # type: ignore[arg-type]
    try:
        assert hub.is_connected() is True
        assert hub.connection_count() == 2
    finally:
        await hub.unregister(conn_a)
        await hub.unregister(conn_b)


@pytest.mark.asyncio
async def test_unregister_drops_connection() -> None:
    """`unregister()` removes the connection from the registry."""
    hub = _hub()
    ws = FakeWebSocket()
    conn = await hub.register(ws)  # type: ignore[arg-type]
    assert hub.connection_count() == 1
    await hub.unregister(conn)
    assert hub.connection_count() == 0
    assert hub.is_connected() is False


@pytest.mark.asyncio
async def test_subscribe_action_emits_subscribed_envelope() -> None:
    """Sending `subscribe` over the receive loop triggers a `subscribed` reply."""
    hub = _hub()
    ws = FakeWebSocket()
    _enqueue_then_disconnect(ws, ['{"action": "subscribe", "topics": ["mempool"]}'])
    await hub.register(ws)  # type: ignore[arg-type]
    await _wait_for(lambda: "subscribed" in _envelope_types(ws))
    subbed = [e for e in _parse_envelopes(ws) if e.type == "subscribed"]
    assert subbed[0].topics == ["mempool"]


@pytest.mark.asyncio
async def test_subscribe_unknown_topic_is_filtered() -> None:
    """Unknown topics in a subscribe are filtered out; known topics ack."""
    hub = _hub()
    ws = FakeWebSocket()
    _enqueue_then_disconnect(ws, ['{"action": "subscribe", "topics": ["mempool", "not-real"]}'])
    await hub.register(ws)  # type: ignore[arg-type]
    await _wait_for(lambda: "subscribed" in _envelope_types(ws))
    subbed = [e for e in _parse_envelopes(ws) if e.type == "subscribed"]
    assert subbed[0].topics == ["mempool"]


@pytest.mark.asyncio
async def test_unsubscribe_action_emits_unsubscribed_envelope() -> None:
    """`unsubscribe` produces an `unsubscribed` envelope with the topics."""
    hub = _hub()
    ws = FakeWebSocket()
    _enqueue_then_disconnect(
        ws,
        [
            '{"action": "subscribe", "topics": ["mempool", "amm_sync"]}',
            '{"action": "unsubscribe", "topics": ["mempool"]}',
        ],
    )
    await hub.register(ws)  # type: ignore[arg-type]
    await _wait_for(lambda: "unsubscribed" in _envelope_types(ws))
    unsubbed = [e for e in _parse_envelopes(ws) if e.type == "unsubscribed"]
    assert unsubbed[0].topics == ["mempool"]


@pytest.mark.asyncio
async def test_ping_action_emits_pong_envelope() -> None:
    """`ping` → `pong` round-trip."""
    hub = _hub()
    ws = FakeWebSocket()
    _enqueue_then_disconnect(ws, ['{"action": "ping"}'])
    await hub.register(ws)  # type: ignore[arg-type]
    await _wait_for(lambda: "pong" in _envelope_types(ws))
    assert "pong" in _envelope_types(ws)


@pytest.mark.asyncio
async def test_broadcast_delivers_to_subscribed_only() -> None:
    """`broadcast(topic, msg)` delivers to connections subscribed to that topic."""
    hub = _hub()
    a = FakeWebSocket()
    b = FakeWebSocket()
    c = FakeWebSocket()
    stop_a = _long_lived(a)
    stop_b = _long_lived(b)
    stop_c = _long_lived(c)
    conn_a = await hub.register(a)  # type: ignore[arg-type]
    conn_b = await hub.register(b)  # type: ignore[arg-type]
    conn_c = await hub.register(c)  # type: ignore[arg-type]
    try:
        await hub.subscribe(conn_a, [WSTopic.MEMPOOL.value])
        await hub.subscribe(conn_b, [WSTopic.AMM_SYNC.value])
        await hub.subscribe(conn_c, [WSTopic.MEMPOOL.value, WSTopic.AMM_SYNC.value])
        # Drain the initial welcomes + acks.
        await asyncio.sleep(0.05)
        a.sent.clear()
        b.sent.clear()
        c.sent.clear()

        await hub.broadcast(
            WSTopic.MEMPOOL,
            WSMessage.mempool_tx(
                {
                    "hash": "0x" + "a" * 64,
                    "to": "0x" + "1" * 40,
                    "source": "0x" + "2" * 40,
                    "amount": "1",
                    "gasPrice": "1",
                }
            ),
        )

        await _wait_for(lambda: "mempool_tx" in _envelope_types(a))
        assert "mempool_tx" in _envelope_types(a)
        assert "mempool_tx" not in _envelope_types(b)
        assert "mempool_tx" in _envelope_types(c)
    finally:
        # Release the receive blocks so the sender/receiver tasks exit.
        stop_a.set()
        stop_b.set()
        stop_c.set()
        await hub.unregister(conn_a)
        await hub.unregister(conn_b)
        await hub.unregister(conn_c)


@pytest.mark.asyncio
async def test_broadcast_drops_slow_consumer() -> None:
    """A subscriber with a full queue is skipped (no head-of-line blocking)."""
    hub = _hub()
    ws = FakeWebSocket()
    stop = _long_lived(ws)

    future: asyncio.Future[None] = asyncio.get_event_loop().create_future()

    async def _block(_: str) -> None:
        await future  # never resolves during the test

    ws.send_block = _block
    conn = await hub.register(ws)  # type: ignore[arg-type]
    try:
        await hub.subscribe(conn, [WSTopic.MEMPOOL.value])
        # Wait for the welcome + subscribed to be picked up by the blocked sender.
        await asyncio.sleep(0.05)

        # First broadcast fills the queue (the blocked sender hasn't drained).
        # We expect this to complete (the put_nowait should not block, but the
        # sender is blocked, so the message sits in the queue).
        # Subsequent broadcasts with a full queue should be silently dropped
        # — the hub returns immediately.
        payloads = [
            WSMessage.mempool_tx(
                {"hash": "0x" + h * 64, "to": "0x01", "source": "0x02", "amount": "1", "gasPrice": "1"}
            )
            for h in "abcdefghijkl"
        ]
        start = asyncio.get_event_loop().time()
        for msg in payloads:
            await asyncio.wait_for(hub.broadcast(WSTopic.MEMPOOL, msg), timeout=0.5)
        elapsed = asyncio.get_event_loop().time() - start
        # All 12 broadcasts should have completed in well under a second.
        assert elapsed < 0.5, f"broadcast blocked for {elapsed:.2f}s"
    finally:
        # Release the slow consumer + the receive block so the hub shuts down.
        future.set_result(None)
        stop.set()
        await hub.unregister(conn)


@pytest.mark.asyncio
async def test_unsubscribe_unknown_topic_does_not_error() -> None:
    """`unsubscribe` for a topic the connection never had is a no-op ack."""
    hub = _hub()
    ws = FakeWebSocket()
    _enqueue_then_disconnect(ws, ['{"action": "unsubscribe", "topics": ["mempool"]}'])
    await hub.register(ws)  # type: ignore[arg-type]
    await _wait_for(lambda: "unsubscribed" in _envelope_types(ws))
    unsubbed = [e for e in _parse_envelopes(ws) if e.type == "unsubscribed"]
    assert unsubbed[0].topics == ["mempool"]


@pytest.mark.asyncio
async def test_malformed_json_emits_error_envelope() -> None:
    """A malformed action envelope yields a `WSMessage.error` (not a disconnect)."""
    hub = _hub()
    ws = FakeWebSocket()
    _enqueue_then_disconnect(ws, ["not json at all"])
    await hub.register(ws)  # type: ignore[arg-type]
    await _wait_for(lambda: "error" in _envelope_types(ws))
    errs = [e for e in _parse_envelopes(ws) if e.type == "error"]
    assert errs[0].data is not None
    assert "message" in errs[0].data


@pytest.mark.asyncio
async def test_heartbeat_emits_ping_envelopes() -> None:
    """When the heartbeat is enabled, the hub emits `ping` envelopes periodically."""
    hub = WSHub(heartbeat_interval_s=0.05)
    ws = FakeWebSocket()
    stop = _long_lived(ws)
    conn = await hub.register(ws)  # type: ignore[arg-type]
    hub.start_heartbeat()
    try:
        # Heartbeat format: the hub emits a `{ "type": "ping" }` envelope
        # (so the frontend distinguishes it from the data-bearing `pong`
        # reply to a client `ping`).
        await _wait_for(
            lambda: "ping" in _envelope_types(ws),
            timeout=0.5,
        )
    finally:
        await hub.stop_heartbeat()
        stop.set()
        await hub.unregister(conn)


@pytest.mark.asyncio
async def test_connection_dataclass_exposes_topics() -> None:
    """`Connection.topics` is mutable, used by the hub and the route layer."""
    conn = Connection(ws=FakeWebSocket())  # type: ignore[arg-type]
    assert conn.topics == set()
    conn.topics.add("mempool")
    assert "mempool" in conn.topics
