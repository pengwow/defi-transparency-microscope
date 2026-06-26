"""Pool fetchers (V2 pair reserves / V3 pool slot0).

The contract calls are abstracted behind a `_call` callable that
takes `(address, function_name, *args) -> Any` and returns the
raw result.  In production this is wired to a small wrapper
around `web3.eth.contract(...).functions.X().call()`; in tests
it is replaced with a canned function.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from typing import Any, Final

from dtm_backend.chain.abis import abi_for
from dtm_backend.chain.addresses import ADDRESSES
from dtm_backend.chain.provider import ChainProvider
from dtm_backend.chain.types import Pool, PoolProtocol, PoolToken

# ──────────────────────────────────────────────────────────────────────
# Token metadata
# ──────────────────────────────────────────────────────────────────────


def _token(symbol: str, address: str, decimals: int) -> PoolToken:
    return PoolToken(address=address, symbol=symbol, decimals=decimals)


TOKEN_METADATA: Final[dict[str, PoolToken]] = {
    "WETH": _token("WETH", ADDRESSES["WETH"], 18),
    "USDC": _token("USDC", ADDRESSES["USDC"], 6),
    "USDT": _token("USDT", ADDRESSES["USDT"], 6),
    "DAI": _token("DAI", ADDRESSES["DAI"], 18),
    "WBTC": _token("WBTC", ADDRESSES["WBTC"], 8),
}


# ──────────────────────────────────────────────────────────────────────
# Pool catalog (1 V2 pair + 2 V3 pools)
# ──────────────────────────────────────────────────────────────────────


# Each entry is (address, protocol, token0_symbol, token1_symbol).
# The wire format requires exactly 3 pools, mirroring the
# previous TypeScript backend.
_POOL_CATALOG: Final[tuple[tuple[str, PoolProtocol, str, str], ...]] = (
    (ADDRESSES["UNI_V2_USDC_WETH"], PoolProtocol.UNISWAP_V2, "USDC", "WETH"),
    (ADDRESSES["UNI_V3_USDC_WETH_5BPS"], PoolProtocol.UNISWAP_V3, "USDC", "WETH"),
    (ADDRESSES["UNI_V3_USDC_USDT_1BPS"], PoolProtocol.UNISWAP_V3, "USDC", "USDT"),
)


# (address, protocol) public list for tests.
POOL_CATALOG: Final[tuple[tuple[str, PoolProtocol], ...]] = tuple(
    (addr, proto) for addr, proto, _, _ in _POOL_CATALOG
)


# ──────────────────────────────────────────────────────────────────────
# Fetcher
# ──────────────────────────────────────────────────────────────────────


ContractCall = Callable[..., Awaitable[Any]]


async def _default_call(
    web3: Any,
    contract_address: str,
    abi_key: str,
    function_name: str,
    *args: Any,
) -> Any:
    """Default contract caller wired to web3.py."""
    abi = abi_for(abi_key)
    contract = web3.eth.contract(address=contract_address, abi=abi)
    fn = getattr(contract.functions, function_name)
    if args:
        return await fn(*args).call()
    return await fn().call()


class PoolFetcher:
    """Build V2 / V3 `Pool` objects from on-chain contract calls.

    The `_call` dependency is overridden in tests; production
    code uses the default web3.py-backed caller.
    """

    def __init__(
        self,
        *,
        _call: ContractCall | None = None,
    ) -> None:
        self._call: ContractCall = _call or self._default_call

    async def _default_call(
        self,
        contract_address: str,
        function_name: str,
        *args: Any,
    ) -> Any:
        # This default is replaced by `bind()` before any real call.
        raise NotImplementedError("PoolFetcher must be bound to a provider first")

    def bind(self, provider: ChainProvider) -> PoolFetcher:
        """Return a copy of this fetcher whose `_call` is wired to `provider`."""
        fetcher = PoolFetcher()
        web3 = provider.web3

        async def _call(contract_address: str, function_name: str, *args: Any) -> Any:
            # Map pool address → ABI key.
            if contract_address.lower() in (
                ADDRESSES["UNI_V2_USDC_WETH"].lower(),
            ):
                abi_key = "UNI_V2_PAIR"
            else:
                abi_key = "UNI_V3_POOL"
            return await _default_call(
                web3, contract_address, abi_key, function_name, *args
            )

        fetcher._call = _call
        return fetcher

    async def get_v2_pool(
        self,
        address: str,
        token0: PoolToken,
        token1: PoolToken,
    ) -> Pool:
        return await self._build_v2(address, token0, token1)

    async def get_v3_pool(
        self,
        address: str,
        token0: PoolToken,
        token1: PoolToken,
    ) -> Pool:
        return await self._build_v3(address, token0, token1)

    async def _build_v2(
        self,
        address: str,
        token0: PoolToken,
        token1: PoolToken,
    ) -> Pool:
        reserves = await self._call(address, "getReserves")
        reserve0, reserve1, _ = reserves
        return Pool(
            id=address,
            protocol=PoolProtocol.UNISWAP_V2,
            token0=token0,
            token1=token1,
            reserve0=reserve0,
            reserve1=reserve1,
            fee_tier=3000,  # canonical V2 = 0.3% (kept for compat with TS)
        )

    async def _build_v3(
        self,
        address: str,
        token0: PoolToken,
        token1: PoolToken,
    ) -> Pool:
        slot0 = await self._call(address, "slot0")
        # slot0 returns (sqrtPriceX96, tick, observationIndex,
        #               observationCardinality, observationCardinalityNext,
        #               feeProtocol, unlocked)
        sqrt_price_x96, tick, *_rest = slot0
        liquidity = await self._call(address, "liquidity")
        fee = await self._call(address, "fee")
        # Uniswap V3 fee is in hundredths of a basis point.
        # 5 bps = 500, 30 bps = 3000, 100 bps = 10000.
        fee_tier_bps = int(fee) // 100
        return Pool(
            id=address,
            protocol=PoolProtocol.UNISWAP_V3,
            token0=token0,
            token1=token1,
            reserve0=int(sqrt_price_x96),  # for V3 we still emit a "reserve"
            reserve1=int(sqrt_price_x96),
            sqrt_price_x96=sqrt_price_x96,
            tick=int(tick),
            fee_tier=fee_tier_bps,
            liquidity=int(liquidity),
        )

    async def list_all(
        self,
        catalog: Sequence[tuple[str, PoolProtocol]],
        token_meta: dict[str, PoolToken],
    ) -> list[Pool]:
        """Walk `catalog` and return a Pool for each entry."""
        out: list[Pool] = []
        for entry in _POOL_CATALOG:
            address, proto, sym0, sym1 = entry
            t0 = token_meta[sym0]
            t1 = token_meta[sym1]
            if proto is PoolProtocol.UNISWAP_V2:
                out.append(await self._build_v2(address, t0, t1))
            else:
                out.append(await self._build_v3(address, t0, t1))
        return out

    async def list_all_catalog(self) -> list[Pool]:
        """Shortcut: walk the module-level `POOL_CATALOG` + `TOKEN_METADATA`."""
        return await self.list_all(POOL_CATALOG, TOKEN_METADATA)


async def list_pools(provider: ChainProvider) -> list[Pool]:
    """Return the curated 3 pools for the chain `provider` connects to."""
    fetcher = PoolFetcher().bind(provider)
    return await fetcher.list_all(POOL_CATALOG, TOKEN_METADATA)


__all__ = [
    "POOL_CATALOG",
    "TOKEN_METADATA",
    "PoolFetcher",
    "list_pools",
]
