"""End-to-end WebSocket integration tests.

These tests boot the full FastAPI app (via ASGITransport)
and connect to `/ws` using the `websockets` client library,
exercising the wire protocol the frontend's `WsClient`
implements.  All five scenarios live in a single test file
because they share the same server fixture.
"""
from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator

import httpx
import pytest
import websockets

from dtm_backend.config import Config
from dtm_backend.server import create_app
from dtm_backend.ws.hub import WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic


@pytest.fixture
async def ws_server() -> AsyncIterator[tuple[str, WSHub]]:
    """Boot the FastAPI app on a uvicorn server for the duration of one test.

    Uses a free local port so multiple tests can run in series without
    colliding.  We talk to the app via the `websockets` client so this
    fixture exercises the full real-WebSocket transport, not the
    TestClient shim used by the route unit tests.
    """
    import socket

    from uvicorn import Config as UConfig
    from uvicorn import Server

    # Pick a free port (close, then use it; the small TOCTOU window
    # is acceptable for a test fixture).
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        port: int = s.getsockname()[1]

    app = create_app(Config(cors_allow_all=True))
    hub = WSHub(heartbeat_interval_s=0.0)
    app.state.ws_hub = hub
    config = UConfig(app, host="127.0.0.1", port=port, log_level="info", lifespan="off")
    server = Server(config)
    server_task = asyncio.create_task(server.serve())
    # Wait for the server to be ready (server.started is set in `serve()`).
    for _ in range(200):
        if server.started:
            break
        await asyncio.sleep(0.01)
    assert server.started, "uvicorn server failed to start within 2s"
    try:
        yield f"ws://127.0.0.1:{port}/ws", hub
    finally:
        server.should_exit = True
        await asyncio.wait_for(server_task, timeout=2.0)


async def test_e2e_welcome(ws_server: tuple[str, WSHub]) -> None:
    """Connecting to `/ws` yields a `{ "type": "welcome" }` envelope."""
    url, _ = ws_server
    async with websockets.connect(url, origin="http://localhost:5173") as ws:
        msg = json.loads(await ws.recv())
        assert msg == {"type": "welcome"}


async def test_e2e_subscribe_then_unsubscribe(ws_server: tuple[str, WSHub]) -> None:
    """A round-trip subscribe → subscribed → unsubscribe → unsubscribed."""
    url, _ = ws_server
    async with websockets.connect(url, origin="http://localhost:5173") as ws:
        await ws.recv()  # welcome
        await ws.send(json.dumps({"action": "subscribe", "topics": ["mempool"]}))
        reply = json.loads(await ws.recv())
        assert reply == {"type": "subscribed", "topics": ["mempool"]}
        await ws.send(json.dumps({"action": "unsubscribe", "topics": ["mempool"]}))
        reply = json.loads(await ws.recv())
        assert reply == {"type": "unsubscribed", "topics": ["mempool"]}


async def test_e2e_ping_pong(ws_server: tuple[str, WSHub]) -> None:
    """`ping` over the wire produces a `pong` reply."""
    url, _ = ws_server
    async with websockets.connect(url, origin="http://localhost:5173") as ws:
        await ws.recv()  # welcome
        await ws.send(json.dumps({"action": "ping"}))
        reply = json.loads(await ws.recv())
        assert reply == {"type": "pong"}


async def test_e2e_hub_broadcast_delivered(ws_server: tuple[str, WSHub]) -> None:
    """`hub.broadcast(MEMPOOL, msg)` lands on a subscribed client."""
    url, hub = ws_server
    async with websockets.connect(url, origin="http://localhost:5173") as ws:
        await ws.recv()  # welcome
        await ws.send(json.dumps({"action": "subscribe", "topics": ["mempool"]}))
        await ws.recv()  # subscribed ack
        # Trigger a broadcast from outside the WS.
        await hub.broadcast(
            WSTopic.MEMPOOL,
            WSMessage.mempool_tx(
                {
                    "hash": "0x" + "a" * 64,
                    "to": "0x" + "1" * 40,
                    "source": "0x" + "2" * 40,
                    "amount": "1000",
                    "gasPrice": "1000",
                }
            ),
        )
        delivered = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
        assert delivered["type"] == "mempool_tx"
        assert delivered["data"]["amount"] == "1000"


async def test_e2e_malformed_action_returns_error_envelope(
    ws_server: tuple[str, WSHub],
) -> None:
    """A bad-JSON action yields a `WSMessage.error` (connection stays open)."""
    url, _ = ws_server
    async with websockets.connect(url, origin="http://localhost:5173") as ws:
        await ws.recv()  # welcome
        await ws.send("not json at all")
        reply = json.loads(await asyncio.wait_for(ws.recv(), timeout=2.0))
        assert reply["type"] == "error"
        assert "message" in reply["data"]
