"""Smoke tests for the Phase 1 + Phase 2 REST API.

Phase 1 verifies the static `/api/v1/health` shape and CORS.
Phase 2 adds end-to-end coverage for the four new data
endpoints (`/pools`, `/transactions`, `/lending-positions`,
`/lp-positions`) by wiring canned fetchers on `app.state` and
hitting the routes via `httpx.ASGITransport`.
"""
from __future__ import annotations

import httpx
import pytest

from dtm_backend.chain.lending import LendingFetcher
from dtm_backend.chain.lp import LpFetcher
from dtm_backend.chain.pools import PoolFetcher
from dtm_backend.chain.transactions import TransactionFetcher
from dtm_backend.config import Config
from dtm_backend.server import create_app

# ──────────────────────────────────────────────────────────────────────
# Phase 1 — health + CORS
# ──────────────────────────────────────────────────────────────────────


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
    """CORS middleware must reply to a cross-origin preflight-style request."""
    resp = await client.get(
        "/api/v1/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


# ──────────────────────────────────────────────────────────────────────
# Phase 2 — chain data endpoints (canned fetchers)
# ──────────────────────────────────────────────────────────────────────


def _stub_pool_call(_addr, function_name, *_args):
    async def _inner():
        if function_name == "getReserves":
            return (10**6, 10**18, 1_700_000_000)
        if function_name == "slot0":
            return (2**96, 200_000, 0, 1, 1, 0, True)
        if function_name in {"liquidity", "totalSupply"}:
            return 10**15
        if function_name == "fee":
            return 500
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


def _stub_tx_call(function_name, *_args):
    from dtm_backend.chain.classify import LIQUIDATION_TOPIC

    async def _inner():
        if function_name == "getLogs":
            return [
                {
                    "address": "0x" + "1" * 40,
                    "blockHash": "0x" + "a" * 64,
                    "blockNumber": 0x10,
                    "data": "0x",
                    "logIndex": "0x0",
                    "topics": ["0x" + "b" * 64],
                    "transactionHash": "0x" + "c" * 64,
                    "transactionIndex": "0x0",
                    "removed": False,
                },
                {
                    "address": "0x" + "3" * 40,
                    "blockHash": "0x" + "1" * 64,
                    "blockNumber": 0x12,
                    "data": "0x",
                    "logIndex": "0x2",
                    "topics": [LIQUIDATION_TOPIC],
                    "transactionHash": "0x" + "2" * 64,
                    "transactionIndex": "0x0",
                    "removed": False,
                },
            ]
        if function_name == "getTransaction":
            tx_hash = _args[0] if _args else "0x" + "9" * 64
            return {
                "hash": tx_hash,
                "from": "0x" + "8" * 40,
                "to": "0x" + "1" * 40,
                "value": 0,
                "gasPrice": 10**9,
                "gas": 200_000,
                "input": "0x",
                "nonce": 1,
                "blockNumber": 0x10,
            }
        if function_name == "getBlock":
            return {"timestamp": 1_700_000_000}
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


def _stub_lending_call(function_name, *args):
    async def _inner():
        if function_name == "getUserReservesData":
            return [
                {
                    "underlyingAsset": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
                    "scaledATokenBalance": 10**18,
                    "usageAsCollateralEnabledOnUser": 1,
                    "scaledVariableDebt": 0,
                    "stableBorrowRate": 0,
                    "oldAverageStableBorrowRate": 0,
                    "stableRateSlope1": 0,
                    "stableRateSlope2": 0,
                    "averageStableBorrowRate": 0,
                    "stableDebtLastUpdateTimestamp": 0,
                    "variableDebtIndex": 0,
                },
                {
                    "underlyingAsset": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                    "scaledATokenBalance": 0,
                    "usageAsCollateralEnabledOnUser": 0,
                    "scaledVariableDebt": 10**6,
                    "stableBorrowRate": 0,
                    "oldAverageStableBorrowRate": 0,
                    "stableRateSlope1": 0,
                    "stableRateSlope2": 0,
                    "averageStableBorrowRate": 0,
                    "stableDebtLastUpdateTimestamp": 0,
                    "variableDebtIndex": 0,
                },
            ]
        if function_name == "decimals":
            return 18
        if function_name == "symbol":
            return "WETH"
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


def _stub_lp_call(function_name, *args):
    async def _inner():
        if function_name == "balanceOf":
            return 1
        if function_name == "tokenOfOwnerByIndex":
            return 12345
        if function_name == "positions":
            return (
                1,
                "0x" + "9" * 40,
                "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",  # WETH
                "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",  # USDC
                500,  # 5 bps
                -100,
                100,
                10**15,
            )
        raise AssertionError(f"unexpected {function_name}")
    return _inner()


@pytest.mark.asyncio
async def test_pools_endpoint_returns_three_pools() -> None:
    """`GET /api/v1/pools` returns 3 pools (1 V2 + 2 V3)."""
    app = create_app(Config())
    app.state.pool_fetcher = PoolFetcher(_call=_stub_pool_call)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/pools")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 3
    assert sum(1 for p in body if p["protocol"] == "uniswap_v2") == 1
    assert sum(1 for p in body if p["protocol"] == "uniswap_v3") == 2
    # All pools are JSON objects with id / token0 / token1.
    for p in body:
        assert isinstance(p["id"], str)
        assert isinstance(p["token0"], dict)
        assert isinstance(p["token1"], dict)
    # V3 entries carry camelCase sqrtPriceX96 (a decimal string).
    v3 = [p for p in body if p["protocol"] == "uniswap_v3"]
    for p in v3:
        assert isinstance(p["sqrtPriceX96"], str)
        assert p["sqrtPriceX96"].isdigit()
        assert isinstance(p["feeTier"], int)


@pytest.mark.asyncio
async def test_transactions_endpoint_returns_list() -> None:
    """`GET /api/v1/transactions` returns a non-empty list of `BackendTx`s."""
    app = create_app(Config())
    app.state.transaction_fetcher = TransactionFetcher(_call=_stub_tx_call)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/transactions")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1
    for tx in body:
        # BackendTx wire format.
        assert "hash" in tx
        assert "from" in tx
        assert "to" in tx
        assert "value" in tx
        assert "gasPrice" in tx
        assert "gasLimit" in tx
        assert "input" in tx
        assert "nonce" in tx
        assert "timestamp" in tx
        assert "type" in tx
        # BigInts round-trip as decimal strings.
        assert isinstance(tx["value"], str) and tx["value"].isdigit()
        assert isinstance(tx["gasPrice"], str) and tx["gasPrice"].isdigit()
        assert isinstance(tx["gasLimit"], str) and tx["gasLimit"].isdigit()


@pytest.mark.asyncio
async def test_lending_endpoint_returns_position() -> None:
    """`GET /api/v1/lending-positions` returns a single Aave V3 position."""
    app = create_app(Config())
    app.state.lending_fetcher = LendingFetcher(_call=_stub_lending_call)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/lending-positions")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1
    pos = body[0]
    # BackendLending wire format.
    assert pos["protocol"] == "aave_v3"
    assert isinstance(pos["collateral"], dict)
    assert isinstance(pos["debt"], dict)
    assert isinstance(pos["healthFactor"], int | float)
    assert isinstance(pos["liquidationThresholdE18"], str)
    assert pos["liquidationThresholdE18"].isdigit()
    assert isinstance(pos["timestamp"], int)
    assert isinstance(pos["id"], str)
    assert isinstance(pos["owner"], str)


@pytest.mark.asyncio
async def test_lp_endpoint_returns_positions() -> None:
    """`GET /api/v1/lp-positions` returns the user's V3 LP positions."""
    app = create_app(Config())
    app.state.lp_fetcher = LpFetcher(_call=_stub_lp_call)
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/api/v1/lp-positions")
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) == 1
    pos = body[0]
    # BackendLp wire format.
    assert pos["protocol"] == "uniswap_v3"
    assert pos["status"] == "active"
    assert isinstance(pos["poolId"], str)
    assert isinstance(pos["token0"], dict)
    assert isinstance(pos["token1"], dict)
    assert isinstance(pos["tickLower"], int)
    assert isinstance(pos["tickUpper"], int)
    assert isinstance(pos["feeTier"], int)
    assert isinstance(pos["amount0"], str) and pos["amount0"].isdigit()
    assert isinstance(pos["amount1"], str) and pos["amount1"].isdigit()
    assert isinstance(pos["feeIncomeE18"], str) and pos["feeIncomeE18"].isdigit()
    assert isinstance(pos["impermanentLossE18"], str) and pos["impermanentLossE18"].isdigit()
    assert isinstance(pos["netPnlE18"], str) and pos["netPnlE18"].isdigit()
    assert isinstance(pos["apr"], int | float)
    assert isinstance(pos["valueUsd"], int | float)
