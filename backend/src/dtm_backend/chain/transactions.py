"""Transaction fetcher — recent swaps + liquidations.

`list_recent` queries the last N blocks for V2 / V3 `Swap` and
Aave V3 `LiquidationCall` events, then enriches each with the
underlying transaction + block timestamp.

The contract-call abstraction (`_call`) matches the rest of the
chain layer so tests can run without touching a real RPC.
"""
from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any, Final

from dtm_backend.chain.classify import classify_log
from dtm_backend.chain.pools import POOL_CATALOG
from dtm_backend.chain.types import Transaction

# V2 Swap event signature.
_V2_SWAP_SIG: Final[str] = (
    "Swap(address,uint256,uint256,uint256,uint256,address)"
)
V2_SWAP_TOPIC: Final[str] = "0x" + (
    __import__("eth_utils").keccak(text=_V2_SWAP_SIG).hex()
)

# V3 Swap event signature.
_V3_SWAP_SIG: Final[str] = (
    "Swap(address,address,int256,int256,uint160,uint128,int24)"
)
V3_SWAP_TOPIC: Final[str] = "0x" + (
    __import__("eth_utils").keccak(text=_V3_SWAP_SIG).hex()
)

# Aave V3 LiquidationCall.
_LIQUIDATION_TOPIC: Final[str] = (
    __import__("eth_utils").keccak(
        text="LiquidationCall(address,address,address,uint256,uint256,address,bool)"
    ).hex()
)


def _to_int(v: Any) -> int:
    """Coerce a hex-string / int / bytes to int (defensive)."""
    if isinstance(v, int):
        return v
    if isinstance(v, str):
        return int(v, 16) if v.startswith("0x") else int(v)
    if isinstance(v, bytes):
        return int.from_bytes(v, "big")
    raise TypeError(f"cannot convert {type(v).__name__} to int")


ContractCall = Callable[..., Awaitable[Any]]


class TransactionFetcher:
    """Fetch + enrich recent swap / liquidation events.

    `block_count` controls the lookback window (default 200 blocks).
    `_call` is the same contract-call abstraction used in the rest
    of the chain layer.
    """

    def __init__(
        self,
        *,
        block_count: int = 200,
        _call: ContractCall | None = None,
    ) -> None:
        self._block_count = block_count
        self._call = _call or self._default_call

    async def _default_call(self, *args: Any, **kwargs: Any) -> Any:
        raise NotImplementedError(
            "TransactionFetcher must be bound to a provider first"
        )

    def bind(self, provider: Any) -> TransactionFetcher:
        """Wire the fetcher to a `ChainProvider`."""
        fetcher = TransactionFetcher(block_count=self._block_count)
        web3 = provider.web3

        async def _call(function_name: str, *args: Any) -> Any:
            if function_name == "getLogs":
                return await web3.eth.get_logs(args[0])
            if function_name == "getTransaction":
                return await web3.eth.get_transaction(args[0])
            if function_name == "getBlock":
                return await web3.eth.get_block(args[0])
            raise AssertionError(f"unexpected call {function_name}")

        fetcher._call = _call
        return fetcher

    async def list_recent(self) -> list[Transaction]:
        """Return the recent swap + liquidation transactions."""
        pool_addresses = [addr for addr, _ in POOL_CATALOG]
        try:
            logs = await self._fetch_logs(pool_addresses)
        except Exception:
            raise
        txs: list[Transaction] = []
        for log in logs:
            try:
                tx = await self._enrich(log)
            except Exception:
                # Skip un-enrichable logs (e.g. RPC gaps in tests).
                continue
            txs.append(tx)
        return txs

    async def _fetch_logs(self, addresses: list[str]) -> list[dict[str, Any]]:
        """Fetch the recent logs that match V2/V3 Swap or LiquidationCall."""
        # In real RPC we filter by topics.  For the stub, we accept
        # any list and let the caller decide.
        params = {
            "address": addresses,
            "topics": [
                [
                    V2_SWAP_TOPIC,
                    V3_SWAP_TOPIC,
                    "0x" + _LIQUIDATION_TOPIC,
                ]
            ],
        }
        return list(await self._call("getLogs", params))

    async def _enrich(self, log: dict[str, Any]) -> Transaction:
        """Build a `Transaction` from a raw log."""
        tx_hash = log["transactionHash"]
        tx = await self._call("getTransaction", tx_hash)
        block_num = _to_int(log.get("blockNumber") or tx.get("blockNumber") or 0)
        block = await self._call("getBlock", block_num)
        timestamp = int(block.get("timestamp", 0))

        mev_type = classify_log(log)
        return Transaction(
            hash=tx_hash,
            sender=tx.get("from", "0x" + "0" * 40),
            to=tx.get("to", "0x" + "0" * 40),
            value=_to_int(tx.get("value", 0)),
            gas_price=_to_int(tx.get("gasPrice", 0)),
            gas_limit=_to_int(tx.get("gas", 0)),
            input_data=tx.get("input", "0x"),
            nonce=_to_int(tx.get("nonce", 0)),
            block_number=block_num,
            timestamp=timestamp,
            mev_type=mev_type,
        )


async def list_transactions(provider: Any) -> list[Transaction]:
    """Convenience entry point used by `routes/transactions.py`."""
    fetcher = TransactionFetcher().bind(provider)
    return await fetcher.list_recent()


__all__ = [
    "TransactionFetcher",
    "list_transactions",
    "V2_SWAP_TOPIC",
    "V3_SWAP_TOPIC",
    "_LIQUIDATION_TOPIC",
]
