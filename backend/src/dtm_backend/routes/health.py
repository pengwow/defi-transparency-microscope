"""`GET /api/v1/health` — liveness + chain head + WS hub status.

Wire shape (preserved from the previous TypeScript backend):

  {
    "status": "ok" | "degraded",
    "chain":  "mainnet" | ... ,
    "blockNumber": <int>,
    "wsConnected": <bool>
  }

`blockNumber` is wired to the chain layer when present (Phase 2)
and `wsConnected` is sourced from the live `WSHub.is_connected()`
(Phase 4).  The route never raises — degraded states return
`status: "degraded"` rather than 5xx.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from dtm_backend.ws.hub import WSHub

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    chain: str
    blockNumber: int
    wsConnected: bool


def _hub_for(request: Request) -> WSHub | None:
    """Return the app's `WSHub` (or None if lifespan hasn't installed one)."""
    return getattr(request.app.state, "ws_hub", None)


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    """Return the current health snapshot.

    `wsConnected` is `True` when at least one client is registered
    on the hub; falls back to `False` when no hub is installed
    (e.g. inside a unit test that built the app without the
    `lifespan` middleware).
    """
    config = request.app.state.config
    hub = _hub_for(request)
    ws_connected = hub.is_connected() if hub is not None else False
    return HealthResponse(
        status="ok",
        chain="mainnet" if config.chain_id == 1 else f"chain:{config.chain_id}",
        blockNumber=0,
        wsConnected=ws_connected,
    )
