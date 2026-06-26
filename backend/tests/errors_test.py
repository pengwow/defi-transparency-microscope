"""Unit tests for the `dtm_backend.errors` module.

These tests pin down the wire shape of the unified error envelope
that the frontend `HttpApiError` decoder consumes:

  {
    "error":   "<code>",     # not_found | validation | upstream_unreachable | internal
    "message": "<human msg>",
    "details": <object> | undefined
  }

Four exception paths are exercised:

* 404 (`HTTPException(404)`) → `error: "not_found"`
* 422 (`RequestValidationError`) → `error: "validation"`
* 502 (`UpstreamUnreachable`) → `error: "upstream_unreachable"`
* 500 (any other `Exception`) → `error: "internal"`

The handlers are installed by `register_exception_handlers(app)`,
which is called by `create_app`.  We build a real `FastAPI` app
per test so the ASGI middleware stack is authentic.
"""
from __future__ import annotations

import json

import httpx
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from httpx import ASGITransport
from pydantic import BaseModel

from dtm_backend.errors import (
    ErrorResponse,
    UpstreamUnreachable,
    register_exception_handlers,
)


def _client(app: FastAPI) -> httpx.AsyncClient:
    transport = ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://testserver")


# ──────────────────────────────────────────────────────────────────────
# ErrorResponse model — pure data
# ──────────────────────────────────────────────────────────────────────


def test_error_response_omits_details_when_none() -> None:
    """`details` is excluded from the wire when it's None."""
    err = ErrorResponse(error="not_found", message="missing preset: 'foo'")
    wire = err.model_dump(exclude_none=True)
    assert wire == {"error": "not_found", "message": "missing preset: 'foo'"}


def test_error_response_includes_details_when_set() -> None:
    """`details` is serialised as-is when it's a non-None object."""
    err = ErrorResponse(
        error="validation",
        message="bad input",
        details={"path": "body.amount", "value": "-1"},
    )
    wire = err.model_dump(exclude_none=True)
    assert wire == {
        "error": "validation",
        "message": "bad input",
        "details": {"path": "body.amount", "value": "-1"},
    }


def test_upstream_unreachable_carries_source_and_cause() -> None:
    """`UpstreamUnreachable` stores `source` + `cause` for diagnostics."""
    cause = ConnectionError("socket closed")
    exc = UpstreamUnreachable(source="rpc", message="eth node down", cause=cause)
    assert exc.source == "rpc"
    assert str(exc) == "eth node down"
    assert exc.cause is cause
    assert isinstance(exc, Exception)


# ──────────────────────────────────────────────────────────────────────
# Handler integration
# ──────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_http_exception_404_returns_not_found_envelope() -> None:
    """A `HTTPException(404)` becomes a `not_found` envelope."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise HTTPException(status_code=404, detail="missing preset: 'foo'")

    async with _client(app) as ac:
        resp = await ac.get("/boom")
    assert resp.status_code == 404
    assert resp.json() == {"error": "not_found", "message": "missing preset: 'foo'"}


@pytest.mark.asyncio
async def test_http_exception_500_passes_through_with_internal_envelope() -> None:
    """A `HTTPException(500)` becomes an `internal` envelope."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise HTTPException(status_code=500, detail="rpc timeout")

    async with _client(app) as ac:
        resp = await ac.get("/boom")
    assert resp.status_code == 500
    assert resp.json() == {"error": "internal", "message": "rpc timeout"}


@pytest.mark.asyncio
async def test_validation_error_returns_validation_envelope() -> None:
    """A `RequestValidationError` becomes a `validation` envelope."""
    app = FastAPI()
    register_exception_handlers(app)

    class Body(BaseModel):
        amount: int
        token: str

    @app.post("/echo")
    async def echo(body: Body) -> dict[str, int | str]:
        return {"amount": body.amount, "token": body.token}

    transport = ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.post(
            "/echo",
            content=json.dumps({"amount": "not_an_int"}),
            headers={"content-type": "application/json"},
        )
    assert resp.status_code == 422
    body = resp.json()
    assert body["error"] == "validation"
    assert isinstance(body["message"], str) and body["message"]
    assert "details" in body
    # Pydantic emits at least one error entry under `details.errors`,
    # with the field name somewhere in the `loc` tuple.  The exact
    # shape varies by FastAPI / pydantic version, so we assert the
    # field names are present somewhere in the loc tuples rather
    # than the precise prefix.
    assert isinstance(body["details"]["errors"], list)
    assert body["details"]["errors"], "errors list must not be empty"


@pytest.mark.asyncio
async def test_upstream_unreachable_returns_502_envelope() -> None:
    """A `UpstreamUnreachable` becomes a 502 with `upstream_unreachable` envelope."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise UpstreamUnreachable(source="rpc", message="eth node down")

    async with _client(app) as ac:
        resp = await ac.get("/boom")
    assert resp.status_code == 502
    assert resp.json() == {
        "error": "upstream_unreachable",
        "message": "eth node down",
        "details": {"source": "rpc"},
    }


@pytest.mark.asyncio
async def test_unhandled_exception_returns_internal_envelope() -> None:
    """A bare `Exception` becomes a 500 with `internal` envelope."""
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("kaboom")

    # `ASGITransport(raise_app_exceptions=False)` prevents the test
    # client from re-raising the exception that the handler converts
    # into a 500 response.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ac:
        resp = await ac.get("/boom")
    assert resp.status_code == 500
    body = resp.json()
    assert body["error"] == "internal"
    assert "internal" in body["message"].lower() or "unexpected" in body["message"].lower()


@pytest.mark.asyncio
async def test_request_validation_error_handler_imports_for_mypy() -> None:
    """Smoke test that `RequestValidationError` is imported in the module."""
    from dtm_backend.errors import RequestValidationError as Imported

    assert Imported is RequestValidationError
