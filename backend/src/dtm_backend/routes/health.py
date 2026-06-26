"""`GET /api/v1/health` — liveness + chain head + WS hub status.

Wire shape (preserved from the previous TypeScript backend):

  {
    "status": "ok" | "degraded",
    "chain":  "mainnet" | ... ,
    "blockNumber": <int>,
    "wsConnected": <bool>
  }

Phase 1 returns a static response (`blockNumber: 0`,
`wsConnected: false`) because the chain layer and the WS hub
are not yet wired in.  Later phases fill in the real values.
"""
from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    chain: str
    blockNumber: int
    wsConnected: bool


@router.get("/health", response_model=HealthResponse)
async def get_health(request: Request) -> HealthResponse:
    """Return the current health snapshot.

    In Phase 1 this is static.  Once the chain layer and the WS
    hub are wired in (Phases 2 and 4), `blockNumber` and
    `wsConnected` are populated from real state.
    """
    config = request.app.state.config
    return HealthResponse(
        status="ok",
        chain="mainnet" if config.chain_id == 1 else f"chain:{config.chain_id}",
        blockNumber=0,
        wsConnected=False,
    )
