"""`GET /api/v1/pools` route.

Returns the curated 3 mainnet pools (1 V2 + 2 V3) using the
`PoolFetcher` stored on `app.state.pool_fetcher`.

The fetcher is wired by `lifespan` on startup.  Tests can
override it by setting `app.state.pool_fetcher` to a custom
object that implements `list_all()`.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from dtm_backend.chain.pools import PoolFetcher

router = APIRouter()


@router.get("/pools")
async def list_pools(request: Request) -> list[Any]:
    """Return the curated 3 mainnet pools.

    The fetcher comes from `request.app.state.pool_fetcher`.
    The e2e stub sets this to a stub fetcher in `lifespan`.
    """
    fetcher: PoolFetcher | None = getattr(
        request.app.state, "pool_fetcher", None
    )
    if fetcher is None:
        # Build a default fetcher bound to the live chain provider.
        from dtm_backend.chain.provider import ChainProvider

        provider: ChainProvider | None = getattr(
            request.app.state, "chain_provider", None
        )
        if provider is None:
            raise RuntimeError(
                "Neither `pool_fetcher` nor `chain_provider` is set on app.state"
            )
        fetcher = PoolFetcher().bind(provider)
        request.app.state.pool_fetcher = fetcher

    pools = await fetcher.list_all_catalog()
    return [p.dump_wire() for p in pools]


__all__ = ["router"]
