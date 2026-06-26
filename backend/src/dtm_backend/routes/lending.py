"""`GET /api/v1/lending-positions` route.

Returns a single Aave V3 `LendingPosition` for the current
"watched" user.  In Phase 2e we expose one position (the
default watch address); Phase 5 will add multi-user support.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

router = APIRouter()

# Default user we "watch" in Phase 2e.  Phase 5 introduces
# per-user queries.
_DEFAULT_USER: str = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"  # vitalik.eth


@router.get("/lending-positions")
async def list_lending_positions(request: Request) -> list[Any]:
    """Return the watched user's Aave V3 lending position."""
    fetcher = getattr(request.app.state, "lending_fetcher", None)
    if fetcher is None:
        from dtm_backend.chain.lending import LendingFetcher
        from dtm_backend.chain.provider import ChainProvider

        provider: ChainProvider | None = getattr(
            request.app.state, "chain_provider", None
        )
        if provider is None:
            raise RuntimeError(
                "Neither `lending_fetcher` nor `chain_provider` is set on app.state"
            )
        fetcher = LendingFetcher().bind(provider)
        request.app.state.lending_fetcher = fetcher

    pos = await fetcher.get_position(_DEFAULT_USER)
    return [pos.dump_wire()]


__all__ = ["router"]
