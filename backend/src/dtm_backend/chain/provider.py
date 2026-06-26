"""AsyncWeb3 provider factory + thin `ChainProvider` wrapper.

We deliberately keep this layer thin.  All routing / fallback
logic lives here, and every other chain module takes a
`ChainProvider` (not an `AsyncWeb3` directly) so the rest of the
app stays testable.
"""
from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any

from web3 import AsyncWeb3

BlockNumberFetcher = Callable[[], Awaitable[int]]


class ChainProvider:
    """Holds an `AsyncWeb3` + a small block-number cache.

    The block-number cache is intentionally in-process (no Redis).
    It exists to keep `/api/v1/health` from hammering the RPC and
    to give the WS hub a cheap "latest block" probe.

    `block_number_fn` is injectable for tests.  In production it
    defaults to `self._web3.eth.block_number`.
    """

    def __init__(
        self,
        web3: Any,
        rpc_url: str,
        *,
        block_number_fn: BlockNumberFetcher | None = None,
    ) -> None:
        self._web3 = web3
        self._rpc_url = rpc_url
        self._cached_block: int | None = None
        self._cached_at: float = 0.0
        self._block_number_fn = block_number_fn or self._default_block_number

    async def _default_block_number(self) -> int:
        return int(await self._web3.eth.block_number)

    @property
    def web3(self) -> Any:
        return self._web3

    @property
    def rpc_url(self) -> str:
        return self._rpc_url

    @property
    def cached_block_number(self) -> int | None:
        return self._cached_block

    async def health(self, *, ttl_ms: int = 5_000) -> int:
        """Return the current block number, caching the result for `ttl_ms`.

        Raises whatever the underlying fetcher raises.
        """
        now = time.monotonic()
        ttl_s = ttl_ms / 1000.0
        if self._cached_block is not None and (now - self._cached_at) < ttl_s:
            return self._cached_block
        block = int(await self._block_number_fn())
        self._cached_block = block
        self._cached_at = now
        return block


def build_provider(rpc_url: str) -> ChainProvider:
    """Build a `ChainProvider` for `rpc_url` (no network IO)."""
    cleaned = rpc_url.rstrip("/")
    web3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(cleaned))
    return ChainProvider(web3, cleaned)


__all__ = ["BlockNumberFetcher", "ChainProvider", "build_provider"]
