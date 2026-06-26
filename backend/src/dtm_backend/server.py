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
from dtm_backend.routes import health as health_route

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

    Phase 1 has no async resources to manage, so this is a
    placeholder.  Later phases will start/stop the WS hub, the
    chain provider, the mempool source, and the watchers.
    """
    log.info("server.startup", port=app.state.config.port)
    try:
        yield
    finally:
        log.info("server.shutdown")


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

    # Routes — currently only `/api/v1/health`.  Later phases
    # append the pool / transaction / position / experiment / ws
    # routers.
    app.include_router(health_route.router, prefix="/api/v1")

    return app


__all__ = ["create_app", "lifespan"]
