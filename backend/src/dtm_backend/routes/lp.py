"""`GET /api/v1/lp-positions` route.

Returns the watched user's Uniswap V3 LP positions.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

router = APIRouter()

_DEFAULT_USER: str = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"  # vitalik.eth


@router.get("/lp-positions")
async def list_lp_positions(request: Request) -> list[Any]:
    """Return the watched user's V3 LP positions."""
    fetcher = getattr(request.app.state, "lp_fetcher", None)
    if fetcher is None:
        from dtm_backend.chain.lp import LpFetcher
        from dtm_backend.chain.provider import ChainProvider

        provider: ChainProvider | None = getattr(
            request.app.state, "chain_provider", None
        )
        if provider is None:
            raise RuntimeError(
                "Neither `lp_fetcher` nor `chain_provider` is set on app.state"
            )
        fetcher = LpFetcher().bind(provider)
        request.app.state.lp_fetcher = fetcher

    positions = await fetcher.list_positions(_DEFAULT_USER)
    return [p.dump_wire() for p in positions]


__all__ = ["router"]
