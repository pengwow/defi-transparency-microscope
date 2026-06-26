"""Offline e2e stub — boots the same `create_app()` on a fixed port.

This binary is what `scripts/e2e-smoke.sh` and the `e2e` CI job
spawn when running the frontend's HttpAPI integration suite
against the backend *without* a public Ethereum RPC.

Behavior
--------
- Uses the same FastAPI app as production.
- Overrides `Config.rpc_url` to a deterministic placeholder so
  no outbound traffic is attempted.  The `/api/v1/health` route
  does not touch the chain, so the stub is still useful as a
  reachability probe even before the chain layer lands.
- Honors `E2E_HOST` (default ``127.0.0.1``) and `E2E_PORT`
  (default ``8765``) so the smoke script can override.
- Honors `E2E_LOG_LEVEL` (default ``info``).
"""
from __future__ import annotations

import os

import structlog
import uvicorn

from dtm_backend.config import Config
from dtm_backend.logger import configure_logging
from dtm_backend.server import create_app

log = structlog.get_logger(__name__)


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
