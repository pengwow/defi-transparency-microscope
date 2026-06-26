"""Integration tests for the experiments routes.

These tests exercise the full HTTP layer end-to-end via
`httpx.ASGITransport` — no real RPC, no network.  They
verify the wire format the frontend consumes matches the
HTTP layer's serialization.
"""
from __future__ import annotations

import httpx
import pytest

from dtm_backend.config import Config
from dtm_backend.server import create_app


def _client() -> httpx.AsyncClient:
    app = create_app(Config())
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


# ──────────────────────────────────────────────────────────────────────
# GET /api/v1/experiments
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_experiments_returns_four_presets() -> None:
    async with _client() as ac:
        resp = await ac.get("/api/v1/experiments")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 4
    ids = [p["id"] for p in body]
    assert "sandwich-v2-usdc-weth" in ids
    assert "sandwich-usdc-weth-v3-5bps" in ids
    assert "sandwich-wbtc-eth-v3" in ids
    assert "attribution-v2-usdc-weth" in ids


@pytest.mark.asyncio
async def test_list_experiments_wire_shape() -> None:
    """Each preset has id / name / config; reserves are decimal strings."""
    async with _client() as ac:
        resp = await ac.get("/api/v1/experiments")
    body = resp.json()
    for p in body:
        assert isinstance(p["id"], str) and p["id"]
        assert isinstance(p["name"], str) and p["name"]
        cfg = p["config"]
        assert isinstance(cfg["name"], str)
        assert cfg["protocol"] in ("uniswap_v2", "uniswap_v3")
        assert isinstance(cfg["reserve0"], str) and cfg["reserve0"].isdigit()
        assert isinstance(cfg["reserve1"], str) and cfg["reserve1"].isdigit()
        assert isinstance(cfg["fee"], int)
        assert isinstance(cfg["runs"], int)


# ──────────────────────────────────────────────────────────────────────
# GET /api/v1/experiments/{id}
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_experiment_returns_preset() -> None:
    async with _client() as ac:
        resp = await ac.get("/api/v1/experiments/sandwich-v2-usdc-weth")
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == "sandwich-v2-usdc-weth"
    assert body["config"]["protocol"] == "uniswap_v2"
    assert body["config"]["fee"] == 3000


@pytest.mark.asyncio
async def test_get_experiment_returns_404_for_unknown_id() -> None:
    async with _client() as ac:
        resp = await ac.get("/api/v1/experiments/does-not-exist")
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────────────
# POST /api/v1/experiments/sandwich
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sandwich_endpoint_returns_attacker_profit_and_victim_loss() -> None:
    payload = {
        "reserve0": str(80_000 * 10**18),
        "reserve1": str(160_000_000 * 10**6),
        "victimAmountIn": str(1_000 * 10**18),
        "attackerAmountIn": str(100 * 10**18),
        "fee": 3000,
    }
    async with _client() as ac:
        resp = await ac.post("/api/v1/experiments/sandwich", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "durationMs" in body
    assert isinstance(body["durationMs"], int)
    assert body["durationMs"] >= 0
    assert "result" in body
    assert "attackerProfit" in body["result"]
    assert "victimLoss" in body["result"]
    # BigInts round-trip as decimal strings.
    assert isinstance(body["result"]["attackerProfit"], str)
    assert isinstance(body["result"]["victimLoss"], str)
    assert body["result"]["attackerProfit"].lstrip("-").isdigit()
    assert body["result"]["victimLoss"].lstrip("-").isdigit()


# ──────────────────────────────────────────────────────────────────────
# POST /api/v1/experiments/il
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_il_endpoint_v2_returns_negative_loss() -> None:
    payload = {"priceRatio": 2.0, "variant": "v2"}
    async with _client() as ac:
        resp = await ac.post("/api/v1/experiments/il", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "result" in body
    assert body["result"]["variant"] == "v2"
    assert body["result"]["priceRatio"] == 2.0
    # The classic 2x V2 IL is ~ -5.72%.
    assert body["result"]["il"] == pytest.approx(-0.0572, abs=1e-3)


@pytest.mark.asyncio
async def test_il_endpoint_v3_is_at_least_as_severe_as_v2() -> None:
    base = {"priceRatio": 1.5}
    async with _client() as ac:
        v2 = (await ac.post("/api/v1/experiments/il", json={**base, "variant": "v2"})).json()
        v3 = (await ac.post("/api/v1/experiments/il", json={**base, "variant": "v3"})).json()
    assert v3["result"]["il"] <= v2["result"]["il"]


@pytest.mark.asyncio
async def test_il_endpoint_rejects_invalid_price_ratio() -> None:
    async with _client() as ac:
        resp = await ac.post("/api/v1/experiments/il", json={"priceRatio": 0})
    # 422 is the FastAPI default for request validation errors.
    assert resp.status_code == 422


# ──────────────────────────────────────────────────────────────────────
# POST /api/v1/experiments/attribution
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_attribution_endpoint_returns_net_pnl() -> None:
    payload = {
        "reserve0": str(80_000 * 10**18),
        "reserve1": str(160_000_000 * 10**6),
        "amountIn": str(1_000 * 10**18),
        "fee": 3000,
        "priceRatio": 1.5,
        "fees": str(10**18),
        "rebates": str(5 * 10**17),
    }
    async with _client() as ac:
        resp = await ac.post("/api/v1/experiments/attribution", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert "durationMs" in body
    assert "result" in body
    assert "netPnl" in body["result"]
    # netPnl is a decimal string of the raw integer.
    assert isinstance(body["result"]["netPnl"], str)
    assert body["result"]["netPnl"].lstrip("-").isdigit()
