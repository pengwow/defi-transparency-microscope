"""`GET /api/v1/transactions` route.

Returns the recent swap / liquidation events.  The fetcher is
stored on `app.state.transaction_fetcher` (set by `lifespan`).
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/transactions")
async def list_transactions(request: Request) -> list[Any]:
    """Return the recent swap + liquidation transactions."""
    fetcher = getattr(request.app.state, "transaction_fetcher", None)
    if fetcher is None:
        from dtm_backend.chain.provider import ChainProvider
        from dtm_backend.chain.transactions import TransactionFetcher

        provider: ChainProvider | None = getattr(
            request.app.state, "chain_provider", None
        )
        if provider is None:
            raise RuntimeError(
                "Neither `transaction_fetcher` nor `chain_provider` is set on app.state"
            )
        fetcher = TransactionFetcher().bind(provider)
        request.app.state.transaction_fetcher = fetcher

    txs = await fetcher.list_recent()
    return [t.dump_wire() for t in txs]


__all__ = ["router"]
