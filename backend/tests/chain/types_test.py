"""Unit tests for `dtm_backend.chain.types` (wire-format models)."""
from __future__ import annotations

import json

import pytest

from dtm_backend.chain.types import (
    LendingPosition,
    LpPosition,
    MevType,
    Pool,
    PoolProtocol,
    PoolToken,
    Transaction,
)

# ──────────────────────────────────────────────────────────────────────
# Pool
# ──────────────────────────────────────────────────────────────────────


def _v2_pool() -> Pool:
    return Pool(
        id="0x" + "1" * 40,
        protocol="uniswap_v2",
        token0=PoolToken(address="0x" + "a" * 40, symbol="USDC", decimals=6),
        token1=PoolToken(address="0x" + "b" * 40, symbol="WETH", decimals=18),
        reserve0=10**6,
        reserve1=10**18,
        feeTier=3000,
    )


def _v3_pool() -> Pool:
    return Pool(
        id="0x" + "2" * 40,
        protocol="uniswap_v3",
        token0=PoolToken(address="0x" + "a" * 40, symbol="USDC", decimals=6),
        token1=PoolToken(address="0x" + "b" * 40, symbol="WETH", decimals=18),
        reserve0=10**6,
        reserve1=10**18,
        sqrtPriceX96=2**96,
        tick=200000,
        feeTier=5,
        liquidity=10**15,
    )


def test_pool_v2_serializes_with_camel_case_aliases() -> None:
    """A V2 pool round-trips with `feeTier` (camelCase) and bigint strings."""
    body = _v2_pool().dump_wire()
    parsed = json.loads(json.dumps(body))
    assert parsed["id"] == "0x" + "1" * 40
    assert parsed["protocol"] == "uniswap_v2"
    assert parsed["token0"]["symbol"] == "USDC"
    assert parsed["token1"]["symbol"] == "WETH"
    assert parsed["reserve0"] == "1000000"
    assert parsed["reserve1"] == "1000000000000000000"
    assert parsed["feeTier"] == 3000


def test_pool_v3_includes_sqrt_price_x96_and_tick() -> None:
    """A V3 pool round-trips with `sqrtPriceX96` (camelCase) as a string."""
    body = _v3_pool().dump_wire()
    parsed = json.loads(json.dumps(body))
    assert parsed["protocol"] == "uniswap_v3"
    assert parsed["sqrtPriceX96"] == str(2**96)
    assert parsed["tick"] == 200000
    assert parsed["liquidity"] == str(10**15)
    assert parsed["feeTier"] == 5


def test_pool_v2_omits_sqrt_price_x96_when_none() -> None:
    """`sqrtPriceX96` is omitted from the JSON when None (e.g. V2 pool)."""
    body = _v2_pool().dump_wire()
    parsed = json.loads(json.dumps(body))
    assert "sqrtPriceX96" not in parsed
    assert "tick" not in parsed
    assert "liquidity" not in parsed


def test_pool_accepts_string_reserves() -> None:
    """`reserve0`/`reserve1` accept decimal strings and coerce to int."""
    p = Pool(
        id="0x" + "4" * 40,
        protocol="uniswap_v2",
        token0=PoolToken(address="0x" + "a" * 40, symbol="USDC", decimals=6),
        token1=PoolToken(address="0x" + "b" * 40, symbol="WETH", decimals=18),
        reserve0="1000000",
        reserve1="1000000000000000000",
    )
    assert p.reserve0 == 10**6
    assert p.reserve1 == 10**18


def test_pool_extra_fields_are_rejected() -> None:
    """Unknown fields raise (catches typos in the producer)."""
    with pytest.raises(Exception):
        Pool.model_validate(
            {
                "id": "0x" + "5" * 40,
                "protocol": "uniswap_v2",
                "token0": {"address": "0x", "symbol": "X", "decimals": 18},
                "token1": {"address": "0x", "symbol": "Y", "decimals": 18},
                "reserve0": "0",
                "reserve1": "0",
                "madeUpField": 42,
            }
        )


# ──────────────────────────────────────────────────────────────────────
# Transaction
# ──────────────────────────────────────────────────────────────────────


def _tx() -> Transaction:
    return Transaction(
        hash="0x" + "a" * 64,
        **{
            "from": "0x" + "b" * 40,
        },
        to="0x" + "c" * 40,
        value=10**18,
        gasPrice=10**9,
        gasLimit=200_000,
        input="0x",
        nonce=1,
        blockNumber=18_000_000,
        timestamp=1_700_000_000,
        type="sandwich",
    )


def test_transaction_serializes_with_camel_case_aliases() -> None:
    """A transaction emits `from`/`gasPrice`/`gasLimit`/`input`/`type`."""
    body = _tx().dump_wire()
    parsed = json.loads(json.dumps(body))
    assert parsed["hash"] == "0x" + "a" * 64
    assert parsed["from"] == "0x" + "b" * 40
    assert parsed["gasPrice"] == "1000000000"
    assert parsed["gasLimit"] == "200000"
    assert parsed["input"] == "0x"
    assert parsed["nonce"] == 1
    assert parsed["blockNumber"] == 18_000_000
    assert parsed["timestamp"] == 1_700_000_000
    assert parsed["type"] == "sandwich"


def test_transaction_optional_fields_omitted() -> None:
    """`mevProfit` / `victimLoss` are omitted when None."""
    body = _tx().dump_wire()
    parsed = json.loads(json.dumps(body))
    assert "mevProfit" not in parsed
    assert "victimLoss" not in parsed


def test_mev_type_arbitrage_value_is_full_word() -> None:
    """The wire-format value for the arb kind is `arbitrage` (not `arb`)."""
    assert MevType.ARBITRAGE.value == "arbitrage"


def test_mev_type_is_closed_enum() -> None:
    """`MevType` is the canonical 5-value enum."""
    assert set(MevType) == {
        MevType.NORMAL,
        MevType.SANDWICH,
        MevType.ARBITRAGE,
        MevType.JIT,
        MevType.LIQUIDATION,
    }


# ──────────────────────────────────────────────────────────────────────
# Lending
# ──────────────────────────────────────────────────────────────────────


def test_lending_position_uses_camel_case_aliases() -> None:
    """`liquidationThresholdE18` serializes as a string bigint."""
    pos = LendingPosition(
        id="0xabc",
        owner="0xdef",
        protocol="aave_v3",
        collateral={"WETH": 10**18},
        debt={"USDC": 1000 * 10**6},
        liquidationThresholdE18=8 * 10**17,
        healthFactor=2.5,
        timestamp=1_700_000_000,
    )
    body = pos.dump_wire()
    parsed = json.loads(json.dumps(body))
    assert parsed["protocol"] == "aave_v3"
    assert parsed["collateral"] == {"WETH": "1000000000000000000"}
    assert parsed["debt"] == {"USDC": "1000000000"}
    assert parsed["liquidationThresholdE18"] == "800000000000000000"
    assert parsed["healthFactor"] == 2.5
    assert parsed["timestamp"] == 1_700_000_000


# ──────────────────────────────────────────────────────────────────────
# LP
# ──────────────────────────────────────────────────────────────────────


def test_lp_position_v3_uses_camel_case_aliases() -> None:
    """An LP position serializes with camelCase `poolId` / `amount0` etc."""
    pos = LpPosition(
        id="lp-1",
        owner="0x" + "d" * 40,
        poolId="0x" + "e" * 40,
        token0=PoolToken(address="0x" + "a" * 40, symbol="USDC", decimals=6),
        token1=PoolToken(address="0x" + "b" * 40, symbol="WETH", decimals=18),
        amount0=10**6,
        amount1=10**18,
        tickLower=-100,
        tickUpper=100,
        feeTier=5,
        apr=0.15,
        valueUsd=12_345.67,
        feeIncomeE18=10**16,
        impermanentLossE18=10**15,
        netPnlE18=9 * 10**15,
        timestamp=1_700_000_000,
    )
    body = pos.dump_wire()
    parsed = json.loads(json.dumps(body))
    assert parsed["poolId"] == "0x" + "e" * 40
    assert parsed["amount0"] == "1000000"
    assert parsed["amount1"] == "1000000000000000000"
    assert parsed["tickLower"] == -100
    assert parsed["tickUpper"] == 100
    assert parsed["feeTier"] == 5
    assert parsed["apr"] == 0.15
    assert parsed["valueUsd"] == 12_345.67
    assert parsed["feeIncomeE18"] == str(10**16)
    assert parsed["impermanentLossE18"] == str(10**15)
    assert parsed["netPnlE18"] == str(9 * 10**15)


def test_pool_protocol_enum_values() -> None:
    """`PoolProtocol` covers the 2 protocols we expose."""
    assert PoolProtocol.UNISWAP_V2.value == "uniswap_v2"
    assert PoolProtocol.UNISWAP_V3.value == "uniswap_v3"
