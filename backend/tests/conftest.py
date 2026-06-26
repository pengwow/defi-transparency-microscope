"""Shared pytest fixtures.

We intentionally avoid `pytest-asyncio`'s event_loop fixtures and
rely on `asyncio_mode = "auto"` + `httpx.AsyncClient(transport=ASGITransport(app=...))`
to exercise the FastAPI app in-process.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

import httpx
import pytest
from httpx import ASGITransport

from dtm_backend.config import Config
from dtm_backend.server import create_app


@pytest.fixture
def make_config() -> type[Config]:
    """Return the `Config` class so tests can instantiate overrides."""

    def _factory(**overrides: object) -> Config:
        return Config(**overrides)

    return _factory  # type: ignore[return-value]


@pytest.fixture
def make_app():
    """Return a factory that builds a FastAPI app with the given config."""

    def _factory(config: Config | None = None):
        return create_app(config)

    return _factory


@pytest.fixture
async def client(make_app) -> AsyncIterator[httpx.AsyncClient]:
    """An `httpx.AsyncClient` wired to a fresh app instance."""
    app = make_app()
    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        yield ac
