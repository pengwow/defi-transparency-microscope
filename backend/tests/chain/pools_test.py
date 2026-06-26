"""Unit tests for `dtm_backend.chain.pools`."""
from __future__ import annotations

import pytest

from dtm_backend.chain.pools import (
    POOL_CATALOG,
    TOKEN_METADATA,
    PoolFetcher,
)
from dtm_backend.chain.types import PoolProtocol, PoolToken


def test_token_metadata_has_five_tokens() -> None:
    """The token metadata table holds the 5 ERC20s we expose."""
    assert set(TOKEN_METADATA) == {"WETH", "USDC", "USDT", "DAI", "WBTC"}
    for symbol, token in TOKEN_METADATA.items():
        assert isinstance(token, PoolToken)
        assert token.symbol == symbol
        assert token.address.startswith("0x")
        assert 0 <= token.decimals <= 36


def test_pool_catalog_has_three_entries() -> None:
    """The pool catalog is 1 V2 pair + 2 V3 pools = 3 total.

    Preserved from the previous TypeScript backend (3 pools
    total — that is what the frontend `listPools` integration
    test expects).
    """
    assert len(POOL_CATALOG) == 3
    v2_count = sum(1 for _, proto in POOL_CATALOG if proto is PoolProtocol.UNISWAP_V2)
    v3_count = sum(1 for _, proto in POOL_CATALOG if proto is PoolProtocol.UNISWAP_V3)
    assert v2_count == 1
    assert v3_count == 2


def test_pool_catalog_addresses_are_checksummed() -> None:
    """All pool addresses in the catalog are EIP-55 checksummed."""
    from dtm_backend.chain.addresses import is_checksum_address

    for addr, _ in POOL_CATALOG:
        assert is_checksum_address(addr), f"{addr} is not EIP-55"


def _v2_call(contract_address, function_name, *args):
    async def _inner():
        if function_name == "getReserves":
            return (10**6, 10**18, 1_700_000_000)
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


def _v3_call(contract_address, function_name, *args):
    async def _inner():
        if function_name == "slot0":
            return (2**96, 200_000, 0, 1, 1, 0, True)
        if function_name == "liquidity":
            return 10**15
        if function_name == "fee":
            return 500  # V3 encodes 5 bps as 500 (in hundredths of bp)
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


def _multi_call(contract_address, function_name, *args):
    async def _inner():
        if function_name == "getReserves":
            return (10**6, 10**18, 1_700_000_000)
        if function_name == "slot0":
            return (2**96, 200_000, 0, 1, 1, 0, True)
        if function_name in {"liquidity", "totalSupply"}:
            return 10**15
        if function_name == "fee":
            return 500
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


@pytest.mark.asyncio
async def test_fetcher_with_canned_v2_data_produces_pool() -> None:
    """A V2 fetcher with canned `_call` produces a valid `Pool`."""
    f = PoolFetcher(_call=_v2_call)
    pool = await f.get_v2_pool(
        address="0x" + "1" * 40,
        token0=TOKEN_METADATA["USDC"],
        token1=TOKEN_METADATA["WETH"],
    )
    assert pool.protocol is PoolProtocol.UNISWAP_V2
    assert pool.reserve0 == 10**6
    assert pool.reserve1 == 10**18
    assert pool.token0.symbol == "USDC"
    assert pool.token1.symbol == "WETH"
    assert pool.sqrt_price_x96 is None  # V2 pools don't have slot0


@pytest.mark.asyncio
async def test_fetcher_with_canned_v3_data_produces_pool() -> None:
    """A V3 fetcher with canned `_call` produces a valid `Pool`."""
    f = PoolFetcher(_call=_v3_call)
    pool = await f.get_v3_pool(
        address="0x" + "2" * 40,
        token0=TOKEN_METADATA["USDC"],
        token1=TOKEN_METADATA["WETH"],
    )
    assert pool.protocol is PoolProtocol.UNISWAP_V3
    assert pool.sqrt_price_x96 == 2**96
    assert pool.tick == 200_000
    assert pool.fee_tier == 5
    assert pool.liquidity == 10**15


@pytest.mark.asyncio
async def test_list_all_returns_three_pools() -> None:
    """`list_all` returns 3 Pool objects when given a canned fetcher."""
    f = PoolFetcher(_call=_multi_call)
    pools = await f.list_all(POOL_CATALOG, TOKEN_METADATA)
    assert len(pools) == 3
    v2 = [p for p in pools if p.protocol is PoolProtocol.UNISWAP_V2]
    v3 = [p for p in pools if p.protocol is PoolProtocol.UNISWAP_V3]
    assert len(v2) == 1
    assert len(v3) == 2
    # V2 sanity.
    assert v2[0].reserve0 > 0
    assert v2[0].reserve1 > 0
    # V3 sanity.
    for p in v3:
        assert p.sqrt_price_x96 == 2**96
        assert p.tick == 200_000
