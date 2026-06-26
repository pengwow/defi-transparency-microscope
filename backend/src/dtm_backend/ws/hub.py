"""WebSocket connection hub.

Phase 4 of the build plan — owns the per-connection
`asyncio.Queue` and the broadcast machinery the watchers feed
into.  The hub knows nothing about FastAPI or HTTP; it takes
a minimal `WSLike` (anything with `accept`, `send_text`,
`receive_text`, `close`) and works equally well with
`fastapi.WebSocket` in production or a fake in tests.

The hub is **connection-scoped** — each call to `register()`
spawns a sender and a receiver task bound to that one
connection.  `broadcast()` fans a message out to every
connection subscribed to the topic, dropping the message on a
full per-connection queue (so a stuck client can't head-of-line
block the rest).
"""
from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Protocol

from dtm_backend.ws.topics import WSMessage, WSTopic, is_valid_topic, parse_client_action

log = logging.getLogger(__name__)


# Sentinel that the sender loop recognises as a stop signal.
# We push it (and only it) into the queue when the receive
# loop exits or the connection is unregistered, so the sender
# can drain the queue and terminate deterministically.
_STOP_SENTINEL: str = "__ws_hub_stop__"


# ──────────────────────────────────────────────────────────────────────
# Minimal WebSocket surface
# ──────────────────────────────────────────────────────────────────────


class WSLike(Protocol):
    """The narrow slice of the `fastapi.WebSocket` API we need.

    The route layer passes in a real `fastapi.WebSocket`; the
    test suite passes a `FakeWebSocket` dataclass.  Both satisfy
    this protocol.
    """

    async def accept(self) -> None: ...
    async def send_text(self, data: str) -> None: ...
    async def receive_text(self) -> str: ...
    async def close(self) -> None: ...


# ──────────────────────────────────────────────────────────────────────
# Connection
# ──────────────────────────────────────────────────────────────────────


# Queue size is intentionally small: the consumer is expected to
# drain it promptly; a stuck client is dropped, not buffered.
_DEFAULT_QUEUE_SIZE: int = 64


@dataclass(slots=True)
class Connection:
    """Per-connection state owned by the hub.

    `topics` is a mutable set the route layer and tests can poke
    at directly.  `queue` is the bounded buffer the sender task
    drains.  `tasks` holds the sender + receiver background
    tasks; we keep them so `unregister()` can cancel cleanly.
    `closed_event` is set when the connection transitions to
    `closed` (via the receiver's `finally` block or via an
    explicit `unregister`) — the route layer awaits it instead
    of polling.
    """

    ws: WSLike
    queue: asyncio.Queue[str] = field(default_factory=lambda: asyncio.Queue(maxsize=_DEFAULT_QUEUE_SIZE))
    topics: set[str] = field(default_factory=set)
    tasks: list[asyncio.Task[None]] = field(default_factory=list)
    closed: bool = False
    closed_event: asyncio.Event = field(default_factory=asyncio.Event)


# ──────────────────────────────────────────────────────────────────────
# Hub
# ──────────────────────────────────────────────────────────────────────


class WSHub:
    """The WS connection registry + broadcast router.

    Public surface (used by the route layer and the watchers):
      * `register(ws)`           — accept + start tasks, return `Connection`.
      * `unregister(conn)`       — cancel tasks, drop the connection.
      * `subscribe(conn, topics)` / `unsubscribe(conn, topics)`
      * `broadcast(topic, msg)`  — fan out a `WSMessage` to subscribers.
      * `connection_count()` / `is_connected()`
      * `start_heartbeat()` / `stop_heartbeat()` — opt-in 30s pings.
    """

    def __init__(self, *, heartbeat_interval_s: float = 30.0) -> None:
        # `_connections` maps `id(conn)` → `Connection`; using the
        # object identity keeps lookup O(1) without forcing the
        # connection to expose a `conn_id` field.
        self._connections: dict[int, Connection] = {}
        self._heartbeat_interval_s: float = heartbeat_interval_s
        self._heartbeat_task: asyncio.Task[None] | None = None

    # ── registration ────────────────────────────────────────────────

    async def register(self, ws: WSLike) -> Connection:
        """Accept the WebSocket, spawn the send/receive tasks, return the `Connection`.

        The welcome envelope is enqueued (not sent directly) so
        that a slow / stuck client can't head-of-line block
        `register()` itself.  The sender task picks the welcome
        off the queue as the first thing it transmits.
        """
        await ws.accept()
        conn = Connection(ws=ws)
        self._connections[id(conn)] = conn
        # Start the sender BEFORE enqueuing the welcome so the
        # task is already running when the message lands.
        sender = asyncio.create_task(self._sender_loop(conn), name="ws-sender")
        receiver = asyncio.create_task(self._receiver_loop(conn), name="ws-receiver")
        conn.tasks = [sender, receiver]
        # Enqueue the welcome (non-blocking; falls back to
        # `put` only if the queue is unexpectedly full).
        if not self._enqueue_nowait(conn, WSMessage.welcome()):
            await self._enqueue(conn, WSMessage.welcome())
        return conn

    async def unregister(self, conn: Connection) -> None:
        """Cancel the connection's tasks and drop it from the registry."""
        if id(conn) not in self._connections:
            return
        del self._connections[id(conn)]
        conn.closed = True
        conn.closed_event.set()
        # Signal the sender loop to stop after draining the queue.
        try:
            conn.queue.put_nowait(_STOP_SENTINEL)
        except asyncio.QueueFull:
            pass
        for task in conn.tasks:
            if not task.done():
                task.cancel()
        # Let the tasks unwind; ignore the resulting exceptions
        # (they're just `asyncio.CancelledError`).
        for task in conn.tasks:
            try:
                await task
            except (asyncio.CancelledError, Exception):
                pass
        try:
            await conn.ws.close()
        except Exception:
            pass

    # ── topic management ────────────────────────────────────────────

    async def subscribe(self, conn: Connection, topics: list[str]) -> list[str]:
        """Subscribe `conn` to the given topics.  Unknown topics are filtered out."""
        valid = [t for t in topics if is_valid_topic(t)]
        for t in valid:
            conn.topics.add(t)
        if valid:
            await self._enqueue(conn, WSMessage.subscribed(valid))
        return valid

    async def unsubscribe(self, conn: Connection, topics: list[str]) -> list[str]:
        """Drop the listed topics from `conn` (no-op for topics it never had)."""
        valid = [t for t in topics if is_valid_topic(t)]
        for t in valid:
            conn.topics.discard(t)
        if valid:
            await self._enqueue(conn, WSMessage.unsubscribed(valid))
        return valid

    # ── broadcast ───────────────────────────────────────────────────

    async def broadcast(self, topic: WSTopic, msg: WSMessage) -> None:
        """Deliver `msg` to every connection subscribed to `topic`.

        Uses `put_nowait` per connection so a slow client can't
        stall the publisher; messages that don't fit in the
        bounded queue are silently dropped (the `Connection`'s
        `closed` flag flips on a full queue too, so the next
        `unregister()` cycle cleans it up).
        """
        topic_value = topic.value
        delivered = 0
        for conn in list(self._connections.values()):
            if topic_value in conn.topics and not conn.closed:
                if self._enqueue_nowait(conn, msg):
                    delivered += 1
        if delivered == 0:
            log.debug("ws.broadcast.no_subscribers", topic=topic_value)

    # ── introspection ──────────────────────────────────────────────

    def connection_count(self) -> int:
        return len(self._connections)

    def is_connected(self) -> bool:
        return any(not c.closed for c in self._connections.values())

    # ── heartbeat ───────────────────────────────────────────────────

    def start_heartbeat(self) -> None:
        """Begin the periodic server-ping task (idempotent)."""
        if self._heartbeat_task is not None and not self._heartbeat_task.done():
            return
        if self._heartbeat_interval_s <= 0:
            return
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(), name="ws-heartbeat")

    async def stop_heartbeat(self) -> None:
        """Cancel the heartbeat task (no-op if not running)."""
        if self._heartbeat_task is None:
            return
        if not self._heartbeat_task.done():
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except (asyncio.CancelledError, Exception):
                pass
        self._heartbeat_task = None

    # ── internals ───────────────────────────────────────────────────

    def _enqueue_nowait(self, conn: Connection, msg: WSMessage) -> bool:
        try:
            conn.queue.put_nowait(msg.to_json())
            return True
        except asyncio.QueueFull:
            log.warning("ws.queue_full", conn_id=id(conn))
            return False

    async def _enqueue(self, conn: Connection, msg: WSMessage) -> None:
        # Used by the synchronous action paths (`subscribe`,
        # `unsubscribe`, `pong`) where blocking is acceptable
        # because the queue is per-client and the message is
        # tiny.
        await conn.queue.put(msg.to_json())

    async def _sender_loop(self, conn: Connection) -> None:
        """Drain the per-connection queue and call `send_text`.

        Exits when it pops the `_STOP_SENTINEL` or when a send
        raises (transport error).  The sentinel approach lets us
        drain pending messages before closing — the next
        `register()` cycle gets a clean slate.
        """
        while True:
            try:
                data = await conn.queue.get()
            except asyncio.CancelledError:
                return
            if data == _STOP_SENTINEL:
                return
            try:
                await conn.ws.send_text(data)
            except Exception as exc:
                log.warning("ws.send_failed", conn_id=id(conn), error=str(exc))
                conn.closed = True
                return

    async def _receiver_loop(self, conn: Connection) -> None:
        """Read action envelopes and dispatch them through the hub."""
        ws = conn.ws
        try:
            while True:
                try:
                    raw = await ws.receive_text()
                except asyncio.CancelledError:
                    return
                except Exception as exc:
                    log.info("ws.disconnect", conn_id=id(conn), error=str(exc))
                    return
                # Tolerate a malformed frame: send an `error` envelope
                # and keep the connection alive.
                try:
                    payload: Any = json.loads(raw)
                except json.JSONDecodeError:
                    await self._enqueue(conn, WSMessage.error("malformed json"))
                    continue
                action = parse_client_action(payload)
                if action is None:
                    await self._enqueue(conn, WSMessage.error("invalid action"))
                    continue
                if action.action == "subscribe":
                    await self.subscribe(conn, action.topics)
                elif action.action == "unsubscribe":
                    await self.unsubscribe(conn, action.topics)
                elif action.action == "ping":
                    await self._enqueue(conn, WSMessage.pong())
        finally:
            # Whatever the reason we exit (client disconnect,
            # cancellation, transport error), signal the sender
            # loop to terminate.  This keeps event-loop teardown
            # quiet in tests.
            conn.closed = True
            conn.closed_event.set()
            try:
                conn.queue.put_nowait(_STOP_SENTINEL)
            except asyncio.QueueFull:
                pass

    async def _heartbeat_loop(self) -> None:
        """Periodically emit `{ "type": "ping" }` to every connection."""
        while True:
            await asyncio.sleep(self._heartbeat_interval_s)
            for conn in list(self._connections.values()):
                if not conn.closed:
                    self._enqueue_nowait(conn, WSMessage(type="ping"))


__all__ = ["Connection", "WSHub", "WSLike"]
