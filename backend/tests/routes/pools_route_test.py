"""Unit tests for `dtm_backend.routes.pools`."""
from __future__ import annotations

import httpx
import pytest

from dtm_backend.chain.pools import PoolFetcher
from dtm_backend.config import Config
from dtm_backend.server import create_app


def _stub_call(_addr, function_name, *_args):
    async def _inner():
        if function_name == "getReserves":
            return (10**6, 10**18, 1_700_000_000)
        if function_name == "slot0":
            return (2**96, 200_000, 0, 1, 1, 0, True)
        if function_name in {"liquidity", "totalSupply"}:
            return 10**15
        if function_name == "fee":
            return 500  # 5 bps
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


def _app_with_stub_fetcher() -> object:  # type: ignore[type-arg]
    """Build a FastAPI app with a stub pool fetcher wired in."""
    cfg = Config()
    app = create_app(cfg)
    app.state.pool_fetcher = PoolFetcher(_call=_stub_call)
    return app


@pytest.mark.asyncio
async def test_pools_route_returns_three_pools() -> None:
    """`GET /api/v1/pools` returns the 3 canonical pools."""
    app = _app_with_stub_fetcher()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/pools")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    v2 = [p for p in body if p["protocol"] == "uniswap_v2"]
    v3 = [p for p in body if p["protocol"] == "uniswap_v3"]
    assert len(v2) == 1
    assert len(v3) == 2


@pytest.mark.asyncio
async def test_pools_route_camel_case_wire() -> None:
    """Pool fields use camelCase (`sqrtPriceX96`, `feeTier`, etc)."""
    app = _app_with_stub_fetcher()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/pools")
    assert resp.status_code == 200
    for pool in resp.json():
        assert "id" in pool
        assert "protocol" in pool
        assert "token0" in pool
        assert "token1" in pool
        if "reserve0" in pool:
            assert isinstance(pool["reserve0"], str)
        if "sqrtPriceX96" in pool:
            assert isinstance(pool["sqrtPriceX96"], str)


@pytest.mark.asyncio
async def test_pools_route_cors_header() -> None:
    """`/pools` honors the default CORS allow-origin (localhost:5173)."""
    app = _app_with_stub_fetcher()
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get(
            "/api/v1/pools",
            headers={"Origin": "http://localhost:5173"},
        )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
