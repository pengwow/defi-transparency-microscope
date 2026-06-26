"""Smoke tests for `GET /api/v1/health`.

These run against a real ASGI app (no network) and assert the
exact wire shape preserved from the previous TypeScript backend.
"""
from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_health_returns_expected_shape(client: httpx.AsyncClient) -> None:
    """`/api/v1/health` must return the Phase 1 static shape."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "status": "ok",
        "chain": "mainnet",
        "blockNumber": 0,
        "wsConnected": False,
    }


@pytest.mark.asyncio
async def test_health_uses_chain_id_for_label(make_app) -> None:
    """When `chain_id` is non-mainnet, the label is `chain:<id>`."""
    from dtm_backend.config import Config

    cfg = Config(chain_id=11155111)  # Sepolia
    app = make_app(cfg)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["chain"] == "chain:11155111"


@pytest.mark.asyncio
async def test_health_cors_header_present(client: httpx.AsyncClient) -> None:
    """CORS middleware must reply to a cross-origin preflight-style request.

    The `Origin` header triggers a CORS response; we don't issue a
    full OPTIONS preflight because Phase 1 has no other methods to
    protect.  The presence of `access-control-allow-origin` is the
    main thing we care about — it proves the middleware is mounted
    and the registration ordering is correct.
    """
    resp = await client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
