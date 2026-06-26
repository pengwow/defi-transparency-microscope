"""Unit tests for `GET /api/v1/health`.

The route must:
* report `status: "ok"` for a healthy config
* report `chain` matching `Config.chain_id`
* report `wsConnected: true` when at least one client is on the
  WS hub, and `false` otherwise
* always serialise the four keys `status`, `chain`,
  `blockNumber`, `wsConnected` in the canonical order
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport

from dtm_backend.config import Config
from dtm_backend.server import create_app
from dtm_backend.ws.hub import WSHub


def _client_for(app):
    transport = ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


@pytest.mark.asyncio
async def test_health_reports_ok_and_chain_mainnet() -> None:
    """Default config: status=ok, chain=mainnet."""
    app = create_app(Config())
    # Stub hub so the route doesn't depend on lifespan ordering.
    app.state.ws_hub = WSHub(heartbeat_interval_s=0.0)
    async with _client_for(app) as ac:
        resp = await ac.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["chain"] == "mainnet"
    assert body["blockNumber"] == 0
    assert body["wsConnected"] is False


@pytest.mark.asyncio
async def test_health_labels_non_mainnet_chain() -> None:
    """A non-mainnet chain_id is rendered as `chain:<id>`."""
    app = create_app(Config(chain_id=11155111))
    app.state.ws_hub = WSHub(heartbeat_interval_s=0.0)
    async with _client_for(app) as ac:
        resp = await ac.get("/api/v1/health")
    body = resp.json()
    assert body["chain"] == "chain:11155111"


@pytest.mark.asyncio
async def test_health_reflects_hub_connection_state() -> None:
    """`wsConnected` mirrors the hub's `is_connected()` in real time."""
    app = create_app(Config())
    hub = WSHub(heartbeat_interval_s=0.0)
    app.state.ws_hub = hub

    # No clients yet → false.
    async with _client_for(app) as ac:
        resp = await ac.get("/api/v1/health")
        assert resp.json()["wsConnected"] is False

    # Open a WS client; `wsConnected` flips to true.
    with TestClient(app) as tc:
        with tc.websocket_connect("/ws"):
            async with _client_for(app) as ac:
                resp = await ac.get("/api/v1/health")
                assert resp.json()["wsConnected"] is True
