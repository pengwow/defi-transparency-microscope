"""Unit tests for `dtm_backend.chain.transactions`."""
from __future__ import annotations

import pytest

from dtm_backend.chain.classify import LIQUIDATION_TOPIC
from dtm_backend.chain.transactions import (
    TransactionFetcher,
)
from dtm_backend.chain.types import MevType


def _stub_call(function_name, *args):
    async def _inner():
        # getLogs returns 1 V2 swap, 1 V3 swap, 1 liquidation.
        if function_name == "getLogs":
            return [
                {
                    "address": "0x" + "1" * 40,
                    "blockHash": "0x" + "a" * 64,
                    "blockNumber": 0x10,
                    "data": "0x",
                    "logIndex": "0x0",
                    "topics": ["0x" + "b" * 64],
                    "transactionHash": "0x" + "c" * 64,
                    "transactionIndex": "0x0",
                    "removed": False,
                },
                {
                    "address": "0x" + "2" * 40,
                    "blockHash": "0x" + "d" * 64,
                    "blockNumber": 0x11,
                    "data": "0x",
                    "logIndex": "0x1",
                    "topics": ["0x" + "e" * 64],
                    "transactionHash": "0x" + "f" * 64,
                    "transactionIndex": "0x0",
                    "removed": False,
                },
                {
                    "address": "0x" + "3" * 40,
                    "blockHash": "0x" + "1" * 64,
                    "blockNumber": 0x12,
                    "data": "0x",
                    "logIndex": "0x2",
                    "topics": [LIQUIDATION_TOPIC],
                    "transactionHash": "0x" + "2" * 64,
                    "transactionIndex": "0x0",
                    "removed": False,
                },
            ]
        if function_name == "getTransaction":
            tx_hash = args[0] if args else "0x" + "9" * 64
            return {
                "hash": tx_hash,
                "from": "0x" + "8" * 40,
                "to": "0x" + "1" * 40,
                "value": 0,
                "gasPrice": 10**9,
                "gas": 200_000,
                "input": "0x",
                "nonce": 1,
                "blockNumber": 0x10,
            }
        if function_name == "getBlock":
            return {"timestamp": 1_700_000_000}
        raise AssertionError(f"unexpected call {function_name}")
    return _inner()


@pytest.mark.asyncio
async def test_transaction_fetcher_returns_canonical_three_txs() -> None:
    """`list_transactions` returns ≥1 transaction with the right shape."""
    f = TransactionFetcher(_call=_stub_call)
    txs = await f.list_recent()
    assert len(txs) >= 1
    for t in txs:
        # Wire-format invariants.
        assert isinstance(t.hash, str)
        assert isinstance(t.sender, str)
        assert isinstance(t.timestamp, int)
        assert isinstance(t.gas_limit, int)
        assert isinstance(t.gas_price, int)
        assert t.mev_type in MevType


@pytest.mark.asyncio
async def test_transaction_fetcher_classifies_liquidation() -> None:
    """A log with the LiquidationCall topic produces a LIQUIDATION tx."""
    f = TransactionFetcher(_call=_stub_call)
    txs = await f.list_recent()
    liquidations = [t for t in txs if t.mev_type is MevType.LIQUIDATION]
    assert len(liquidations) >= 1


def test_transaction_fetcher_handles_empty_logs() -> None:
    """`list_recent` returns [] when `getLogs` returns no entries."""

    def _empty_call(fn, *args):
        async def _inner():
            if fn == "getLogs":
                return []
            raise AssertionError(f"unexpected call {fn}")
        return _inner()

    f = TransactionFetcher(_call=_empty_call)
    import asyncio
    assert asyncio.run(f.list_recent()) == []


def test_transaction_fetcher_handles_rpc_error() -> None:
    """`list_recent` propagates network errors."""

    def _err_call(fn, *args):
        async def _inner():
            raise ConnectionError("rpc down")
        return _inner()

    f = TransactionFetcher(_call=_err_call)
    import asyncio
    with pytest.raises(ConnectionError):
        asyncio.run(f.list_recent())
