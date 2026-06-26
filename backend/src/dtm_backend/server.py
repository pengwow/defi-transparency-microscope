"""Server module — FastAPI app factory + lifespan.

This is the entry point used by both `uvicorn` and the offline
e2e stub.  The application surface grows as the project moves
through phases 1-5; this file owns only the wire-up.
"""
from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from typing import TypedDict

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dtm_backend.config import Config, load_config
from dtm_backend.errors import register_exception_handlers
from dtm_backend.routes import experiments as experiments_route
from dtm_backend.routes import health as health_route
from dtm_backend.routes import lending as lending_route
from dtm_backend.routes import lp as lp_route
from dtm_backend.routes import pools as pools_route
from dtm_backend.routes import transactions as transactions_route
from dtm_backend.routes import ws as ws_route
from dtm_backend.ws.hub import WSHub

log = structlog.get_logger(__name__)


class CorsOptions(TypedDict):
    """Strict shape of the kwargs we pass to `CORSMiddleware`."""

    allow_origins: Sequence[str]
    allow_credentials: bool
    allow_methods: Sequence[str]
    allow_headers: Sequence[str]


def _build_cors_options(config: Config) -> CorsOptions:
    """Translate `Config.cors_*` into a `CORSMiddleware` kwargs dict.

    Resolution rules (preserved from the prior TypeScript backend):
      - `cors_allow_all=True`                  → `allow_origins=["*"]`
      - `cors_origins` contains `*`            → `allow_origins=["*"]`
      - otherwise                              → exact-match allow-list

    `*` is incompatible with `allow_credentials=True` per the CORS
    spec, so credentials are always disabled.
    """
    methods: list[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    headers: list[str] = ["*"]
    if config.cors_allow_all or "*" in config.cors_origins:
        return CorsOptions(
            allow_origins=["*"],
            allow_credentials=False,
            allow_methods=methods,
            allow_headers=headers,
        )
    return CorsOptions(
        allow_origins=list(config.cors_origins),
        allow_credentials=False,
        allow_methods=methods,
        allow_headers=headers,
    )


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Boot/shutdown hook — wired by `create_app`.

    Phase 4 installs a default `WSHub` (if the caller didn't
    provide one via `app.state.ws_hub`) and starts its
    heartbeat.  Later phases will add the chain provider,
    mempool source, and watchers.
    """
    log.info("server.startup", port=app.state.config.port)
    hub: WSHub | None = getattr(app.state, "ws_hub", None)
    if hub is None:
        hub = WSHub(heartbeat_interval_s=30.0)
        app.state.ws_hub = hub
    hub.start_heartbeat()
    try:
        yield
    finally:
        log.info("server.shutdown")
        await hub.stop_heartbeat()


def create_app(config: Config | None = None) -> FastAPI:
    """Build a FastAPI app from a Config (or env defaults).

    Tests pass a `Config` directly to override individual fields;
    the production entrypoint uses `load_config()`.
    """
    cfg = config or load_config()
    app = FastAPI(
        title="DTM Backend API",
        version="0.1.0",
        description=(
            "DeFi Transparency Microscope — Python backend.  "
            "Wire-compatible with the frontend `HttpAPI` / `WsClient`."
        ),
        lifespan=lifespan,
    )
    app.state.config = cfg

    # CORS — register before routes so the preflight hooks fire
    # first.  We register it BEFORE the WS route is added in
    # later phases, mirroring the previous TS ordering.
    cors = _build_cors_options(cfg)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors["allow_origins"],
        allow_credentials=cors["allow_credentials"],
        allow_methods=cors["allow_methods"],
        allow_headers=cors["allow_headers"],
    )

    # Global exception handlers — installed BEFORE routes so they
    # wrap the route stack and emit the unified error envelope.
    register_exception_handlers(app)

    # Routes — currently `/api/v1/health`, `/pools`, `/transactions`,
    # `/lending-positions`, `/lp-positions`, plus the experiments
    # surface (`/experiments`, `/experiments/{id}`,
    # `/experiments/sandwich`, `/experiments/il`,
    # `/experiments/attribution`).  Phase 4 appends the `/ws`
    # WebSocket route (no prefix; the hub is global).
    app.include_router(health_route.router, prefix="/api/v1")
    app.include_router(pools_route.router, prefix="/api/v1")
    app.include_router(transactions_route.router, prefix="/api/v1")
    app.include_router(lending_route.router, prefix="/api/v1")
    app.include_router(lp_route.router, prefix="/api/v1")
    app.include_router(experiments_route.router, prefix="/api/v1")
    app.include_router(ws_route.router)

    return app


__all__ = ["create_app", "lifespan"]
