"""Unified error envelope + global exception handlers.

The frontend `HttpApiError` decoder (see
`frontend/src/services/httpApi.ts`) consumes a single shape:

    {
      "error":   "<code>",     # not_found | validation | upstream_unreachable | internal
      "message": "<human msg>",
      "details": <object> | undefined
    }

We register four handlers in `register_exception_handlers` so
that the JSON shape is identical regardless of which exception
fires inside a route:

| Exception                | HTTP | error code           |
|--------------------------|------|----------------------|
| `HTTPException` 4xx      | same | `not_found` / passth |
| `HTTPException` 5xx      | same | `internal`           |
| `RequestValidationError` | 422  | `validation`         |
| `UpstreamUnreachable`    | 502  | `upstream_unreachable`|
| any other `Exception`    | 500  | `internal`           |
"""

from __future__ import annotations

import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

log = structlog.get_logger(__name__)


class ErrorResponse(BaseModel):
    """Canonical wire shape for every error response."""

    error: str
    message: str
    details: dict[str, object] | None = None


class UpstreamUnreachable(Exception):
    """Raised by route handlers / chain layer when an upstream dependency is
    unreachable (e.g. RPC node down, IPFS timeout).

    Mapped to HTTP 502 with `error: "upstream_unreachable"` and
    `details: {"source": <source>}` by the global handler.
    """

    def __init__(
        self,
        source: str,
        message: str,
        *,
        cause: BaseException | None = None,
    ) -> None:
        super().__init__(message)
        self.source = source
        self.message = message
        self.cause = cause


def _envelope(
    code: str, message: str, details: dict[str, object] | None = None
) -> dict[str, object]:
    """Build the JSON body, omitting `details` when None for clean wire shape."""
    body: dict[str, object] = {"error": code, "message": message}
    if details is not None:
        body["details"] = details
    return body


async def _http_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Map `HTTPException` to the envelope, branching on the status code.

    4xx errors are mapped to a stable `error` code when possible
    (currently just `not_found`); 5xx errors always become `internal`.
    """
    assert isinstance(exc, StarletteHTTPException)
    status_code = int(exc.status_code)
    message = str(exc.detail) if exc.detail else f"HTTP {status_code}"
    if status_code == 404:
        code = "not_found"
    elif 500 <= status_code < 600:
        code = "internal"
    else:
        code = f"http_{status_code}"
    return JSONResponse(status_code=status_code, content=_envelope(code, message))


async def _validation_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Map a `RequestValidationError` to a `validation` envelope with
    `details.errors` matching the FastAPI default shape (so existing
    frontend decoders that only read `message` keep working)."""
    assert isinstance(exc, RequestValidationError)
    return JSONResponse(
        status_code=422,
        content=_envelope(
            "validation",
            "request validation failed",
            {"errors": list(exc.errors())},
        ),
    )


async def _upstream_unreachable_handler(request: Request, exc: Exception) -> JSONResponse:
    """Map `UpstreamUnreachable` to a 502 with source details."""
    assert isinstance(exc, UpstreamUnreachable)
    return JSONResponse(
        status_code=502,
        content=_envelope(
            "upstream_unreachable",
            exc.message,
            {"source": exc.source},
        ),
    )


async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Last-resort handler for any unhandled exception.

    We log the full traceback server-side but return a generic
    `internal` message to the client to avoid leaking internals.
    """
    log.error(
        "errors.unhandled path=%s method=%s error=%s",
        request.url.path,
        request.method,
        exc,
    )
    return JSONResponse(
        status_code=500,
        content=_envelope("internal", "internal server error"),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Install the four global exception handlers on `app`.

    Idempotent: re-registering with the same `app` is a no-op because
    each handler is keyed on the exception class.  We always (re)install
    so unit tests that build a fresh `FastAPI()` get a clean stack.
    """
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)
    app.add_exception_handler(UpstreamUnreachable, _upstream_unreachable_handler)
    app.add_exception_handler(Exception, _unhandled_exception_handler)


__all__ = [
    "ErrorResponse",
    "UpstreamUnreachable",
    "register_exception_handlers",
]
