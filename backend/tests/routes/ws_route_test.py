"""Unit tests for `dtm_backend.routes.ws`.

The route is a thin wrapper around the hub.  We drive it
with `fastapi.testclient.TestClient` (synchronous WebSocket
support) so we can exercise the real FastAPI WebSocket stack
end-to-end without needing an actual server.

The async broadcast path (a `hub.broadcast()` triggered from
outside the WebSocket) is exercised by the integration suite
(`tests/integration/ws_test.py`); this file covers the
synchronous request/response surface.
"""

from __future__ import annotations

import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from dtm_backend.routes import ws as ws_route
from dtm_backend.ws.hub import WSHub


def _build_app() -> FastAPI:
    """Build a minimal FastAPI app with a fresh hub and the WS route."""
    app = FastAPI()
    hub = WSHub(heartbeat_interval_s=0.0)
    app.state.ws_hub = hub
    app.include_router(ws_route.router)
    return app


def test_route_accepts_websocket_and_emits_welcome() -> None:
    """Connecting to `/ws` yields a `{ "type": "welcome" }` envelope."""
    app = _build_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            msg = json.loads(ws.receive_text())
            assert msg == {"type": "welcome"}


def test_route_handles_subscribe_action() -> None:
    """`subscribe` over the route produces a `subscribed` reply."""
    app = _build_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()  # welcome
            ws.send_text(json.dumps({"action": "subscribe", "topics": ["mempool"]}))
            reply = json.loads(ws.receive_text())
            assert reply == {"type": "subscribed", "topics": ["mempool"]}


def test_route_handles_ping_action() -> None:
    """`ping` over the route produces a `pong` reply."""
    app = _build_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()  # welcome
            ws.send_text(json.dumps({"action": "ping"}))
            reply = json.loads(ws.receive_text())
            assert reply == {"type": "pong"}


def test_route_rejects_malformed_action_with_error_envelope() -> None:
    """Bad JSON yields a `WSMessage.error` reply (the connection stays open)."""
    app = _build_app()
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()  # welcome
            ws.send_text("not json")
            reply = json.loads(ws.receive_text())
            assert reply["type"] == "error"
            assert "message" in reply["data"]


def test_route_uses_existing_hub_from_app_state() -> None:
    """If the caller pre-installs a `ws_hub` on `app.state`, the route uses it."""
    app = _build_app()
    provided_hub = WSHub(heartbeat_interval_s=0.0)
    app.state.ws_hub = provided_hub
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            ws.receive_text()  # welcome
            # The provided hub tracks the connection.
            assert provided_hub.connection_count() == 1


def test_route_creates_default_hub_when_app_state_omits_one() -> None:
    """If `app.state.ws_hub` isn't set, the route creates a default hub."""
    app = FastAPI()
    app.include_router(ws_route.router)
    with TestClient(app) as client:
        with client.websocket_connect("/ws") as ws:
            assert json.loads(ws.receive_text()) == {"type": "welcome"}
    # The default hub was created and populated.
    assert isinstance(app.state.ws_hub, WSHub)
