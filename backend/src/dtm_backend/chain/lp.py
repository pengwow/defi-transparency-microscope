"""Uniswap V3 LP position fetcher.

For a given user address, enumerates their V3 LP NFT ids
via the NonfungiblePositionManager and reads `positions()` to
extract the (token0, token1, fee, tickLower, tickUpper,
liquidity) tuple.  We then compute `amount0` / `amount1` from
the liquidity value and current pool state.

In Phase 2f the amount math is approximated (we report the raw
liquidity value scaled to integers).  Phase 3 will swap in the
real Uniswap V3 SDK formulas.
"""
from __future__ import annotations

import time
from collections.abc import Awaitable, Callable
from typing import Any, Final

from dtm_backend.chain.pools import POOL_CATALOG, TOKEN_METADATA
from dtm_backend.chain.types import LpPosition, PoolToken

# Canonical Uniswap V3 NonfungiblePositionManager (mainnet).
# We hard-code it because the contract is part of the public ABI.
_POSITION_MANAGER: Final[str] = "0xC36442b4a4522E871399CD717aBDD847Ab11FE88"


ContractCall = Callable[..., Awaitable[Any]]


class LpFetcher:
    """Uniswap V3 LP position fetcher."""

    def __init__(self, *, _call: ContractCall | None = None) -> None:
        self._call = _call or self._default_call

    async def _default_call(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError("LpFetcher must be bound to a provider first")

    def bind(self, provider: Any) -> LpFetcher:
        """Wire the fetcher to a `ChainProvider`."""
        fetcher = LpFetcher()
        web3 = provider.web3

        async def _call(function_name: str, *args: Any) -> Any:
            contract = web3.eth.contract(
                address=_POSITION_MANAGER,
                abi=[
                    "function balanceOf(address owner) view returns (uint256)",
                    "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
                    "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity)",
                ],
            )
            fn = getattr(contract.functions, function_name)
            if args:
                return await fn(*args).call()
            return await fn().call()

        fetcher._call = _call
        return fetcher

    async def list_positions(self, user_address: str) -> list[LpPosition]:
        """Return all V3 LP positions held by `user_address`."""
        balance = int(await self._call("balanceOf", user_address))
        if balance == 0:
            return []
        out: list[LpPosition] = []
        for i in range(balance):
            token_id = int(await self._call("tokenOfOwnerByIndex", user_address, i))
            raw = await self._call("positions", token_id)
            # raw is a tuple of (nonce, operator, token0, token1, fee,
            #                    tickLower, tickUpper, liquidity)
            _nonce, _operator, t0_addr, t1_addr, fee, tick_lower, tick_upper, liquidity = raw
            t0_meta = _resolve_token(t0_addr)
            t1_meta = _resolve_token(t1_addr)
            fee_tier_bps = int(fee) // 100
            out.append(
                LpPosition(
                    id=f"{user_address.lower()}-{token_id}",
                    owner=user_address.lower(),
                    pool_id=POOL_CATALOG[0][0],  # primary curated V3 pool
                    token0=t0_meta,
                    token1=t1_meta,
                    amount0=int(liquidity),
                    amount1=int(liquidity),
                    tick_lower=int(tick_lower),
                    tick_upper=int(tick_upper),
                    fee_tier=fee_tier_bps,
                    apr=0.0,
                    value_usd=0.0,
                    fee_income_e18=0,
                    impermanent_loss_e18=0,
                    net_pnl_e18=0,
                    timestamp=int(time.time()),
                )
            )
        return out


def _resolve_token(address: str) -> PoolToken:
    """Resolve a token address back to a `PoolToken` from the metadata table."""
    addr_l = address.lower()
    for _sym, tok in TOKEN_METADATA.items():
        if tok.address.lower() == addr_l:
            return tok
    # Fallback for unknown tokens: lowercase address, "UNKNOWN" symbol, 18 decimals.
    return PoolToken(address=address, symbol="UNKNOWN", decimals=18)


__all__ = ["LpFetcher"]
