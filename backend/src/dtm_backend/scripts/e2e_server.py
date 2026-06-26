"""Offline e2e stub — boots the same `create_app()` on a fixed port.

This binary is what `scripts/e2e-smoke.sh` and the `e2e` CI job
spawn when running the frontend's HttpAPI integration suite
against the backend *without* a public Ethereum RPC.

Behavior
--------
- Uses the same FastAPI app as production.
- Overrides `Config.rpc_url` to a deterministic placeholder so
  no outbound traffic is attempted.  The route handlers fall
  back to the canned fetchers installed on `app.state` below.
- Wires four canned fetchers (`PoolFetcher`, `TransactionFetcher`,
  `LendingFetcher`, `LpFetcher`) onto `app.state` so the four
  new chain-data endpoints return deterministic data with no
  network.
- Honors `E2E_HOST` (default ``127.0.0.1``) and `E2E_PORT`
  (default ``8765``) so the smoke script can override.
- Honors `E2E_LOG_LEVEL` (default ``info``).
"""
from __future__ import annotations

import os
from typing import Any

import structlog
import uvicorn

from dtm_backend.chain.lending import LendingFetcher
from dtm_backend.chain.lp import LpFetcher
from dtm_backend.chain.pools import PoolFetcher
from dtm_backend.chain.transactions import TransactionFetcher
from dtm_backend.config import Config
from dtm_backend.logger import configure_logging
from dtm_backend.server import create_app

log = structlog.get_logger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Canned contract-call stubs
# ──────────────────────────────────────────────────────────────────────
#
# These are the same shape the integration tests use; they let
# the offline stub serve the four chain-data endpoints without
# touching a real RPC.  Centralising them here keeps the wire
# format identical to the in-process test suite.


def _stub_pool_call(_addr: str, function_name: str, *_args: Any) -> Any:
    async def _inner() -> Any:
        if function_name == "getReserves":
            return (10**6, 10**18, 1_700_000_000)
        if function_name == "slot0":
            return (2**96, 200_000, 0, 1, 1, 0, True)
        if function_name in {"liquidity", "totalSupply"}:
            return 10**15
        if function_name == "fee":
            return 500  # 5 bps
        raise AssertionError(f"unexpected pool call {function_name}")
    return _inner()


def _stub_tx_call(function_name: str, *_args: Any) -> Any:
    from dtm_backend.chain.classify import LIQUIDATION_TOPIC

    async def _inner() -> Any:
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
        raise AssertionError(f"unexpected tx call {function_name}")
    return _inner()


def _stub_lending_call(function_name: str, *_args: Any) -> Any:
    async def _inner() -> Any:
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
        raise AssertionError(f"unexpected lending call {function_name}")
    return _inner()


def _stub_lp_call(function_name: str, *_args: Any) -> Any:
    async def _inner() -> Any:
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
        raise AssertionError(f"unexpected lp call {function_name}")
    return _inner()


def _stub_config() -> Config:
    """Build a deterministic Config for the offline e2e stub."""
    return Config(
        host=os.environ.get("E2E_HOST", "127.0.0.1"),
        port=int(os.environ.get("E2E_PORT", "8765")),
        log_level=os.environ.get("E2E_LOG_LEVEL", "info"),
        # Deterministic placeholder RPC — the stub never actually
        # makes outbound calls in Phase 1, but we set this so the
        # config is internally consistent for the e2e tests.
        rpc_url=os.environ.get("E2E_RPC_URL", "http://127.0.0.1:1/offline"),
        rpc_ws_url=None,
        chain_id=int(os.environ.get("E2E_CHAIN_ID", "1")),
        env="test",
    )


def _wire_stub_fetchers(app: Any) -> None:
    """Install canned fetchers on `app.state` so the chain-data
    endpoints return deterministic data without a real RPC."""
    app.state.pool_fetcher = PoolFetcher(_call=_stub_pool_call)
    app.state.transaction_fetcher = TransactionFetcher(_call=_stub_tx_call)
    app.state.lending_fetcher = LendingFetcher(_call=_stub_lending_call)
    app.state.lp_fetcher = LpFetcher(_call=_stub_lp_call)


def main() -> None:
    """Boot the offline e2e stub."""
    cfg = _stub_config()
    # uvicorn accepts only a specific set of log-level names
    # (`critical` / `error` / `warning` / `info` / `debug` / `trace`).
    # Coerce a bare `warn` (the structlog-idiomatic short form) to
    # `warning` so the e2e script can use either.
    uvicorn_level = "warning" if cfg.log_level == "warn" else cfg.log_level
    configure_logging(cfg.log_level, service="dtm-e2e-stub")
    app = create_app(cfg)
    _wire_stub_fetchers(app)
    log.info("e2e_stub.starting", host=cfg.host, port=cfg.port)
    uvicorn.run(
        app,
        host=cfg.host,
        port=cfg.port,
        log_level=uvicorn_level,
        access_log=False,
    )


if __name__ == "__main__":
    main()
