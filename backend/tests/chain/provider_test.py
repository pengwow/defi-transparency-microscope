"""Unit tests for `dtm_backend.chain.provider`."""
from __future__ import annotations

import pytest

from dtm_backend.chain.provider import ChainProvider, build_provider


def test_build_provider_returns_chain_provider() -> None:
    """`build_provider` wraps an `AsyncWeb3` in a `ChainProvider`."""
    p = build_provider("http://127.0.0.1:1/offline")
    assert isinstance(p, ChainProvider)
    assert p.rpc_url == "http://127.0.0.1:1/offline"


def test_build_provider_strips_trailing_slash() -> None:
    """Trailing slashes in the RPC URL are normalised away."""
    p = build_provider("http://example.com/")
    assert p.rpc_url == "http://example.com"


def test_chain_provider_has_web3() -> None:
    """`ChainProvider.web3` is an `AsyncWeb3` instance."""
    p = build_provider("http://127.0.0.1:1/offline")
    assert p.web3 is not None


def test_chain_provider_initial_block_number_is_none() -> None:
    """No cached block until `health()` is called."""
    p = build_provider("http://127.0.0.1:1/offline")
    assert p.cached_block_number is None


def _build_with_block(p, return_value: int) -> list[int]:
    """Replace the block-number fetcher with one that returns `return_value`."""
    calls: list[int] = []

    async def _fake() -> int:
        calls.append(1)
        return return_value

    p._block_number_fn = _fake  # type: ignore[attr-defined]
    return calls


def _build_with_block_raises(p, exc: Exception) -> None:
    """Replace the block-number fetcher with one that raises `exc`."""

    async def _fake() -> int:
        raise exc

    p._block_number_fn = _fake  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_chain_provider_health_returns_block_number() -> None:
    """`health()` returns the current block number on success."""
    p = build_provider("http://127.0.0.1:1/offline")
    _build_with_block(p, 18_000_000)
    block = await p.health()
    assert block == 18_000_000
    assert p.cached_block_number == 18_000_000


@pytest.mark.asyncio
async def test_chain_provider_health_propagates_exception() -> None:
    """`health()` propagates network failures."""
    p = build_provider("http://127.0.0.1:1/offline")
    _build_with_block_raises(p, ConnectionError("rpc unreachable"))
    with pytest.raises(ConnectionError):
        await p.health()


@pytest.mark.asyncio
async def test_chain_provider_health_caches_result() -> None:
    """Subsequent `health()` calls within the TTL return the cached value."""
    p = build_provider("http://127.0.0.1:1/offline")
    calls = _build_with_block(p, 18_000_001)
    await p.health()
    await p.health()
    await p.health()
    assert len(calls) == 1
    assert p.cached_block_number == 18_000_001
