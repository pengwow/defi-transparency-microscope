"""Wire-format models for the chain layer.

Pydantic v2 is used for two reasons:
  1. FastAPI auto-validates with the same models.
  2. The bigint-as-decimal-string wire format is encoded once
     in a custom annotated type (`BigIntStr`) and reused on every
     field that needs it.

The shape of these models mirrors the `Backend*` interfaces in
`frontend/src/services/httpApi.ts` byte-for-byte.  Any drift here
is a contract break — the frontend's `bigintOr` helper will silently
return `0n` for fields that disappeared, and integration tests will
catch the rest.
"""
from __future__ import annotations

from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, PlainSerializer


def _coerce_big_int(value: Any) -> int:
    """Coerce a `int | str` (decimal) to `int`.  Raises on bad input."""
    if isinstance(value, bool):
        raise TypeError("bool is not a valid bigint")
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        return int(value, 10)
    raise TypeError(f"expected int or decimal string, got {type(value).__name__}")


def _serialize_big_int(value: int) -> str:
    """Serialize an int as a decimal string."""
    return str(value)


# An `int` field that round-trips as a decimal string in JSON.
BigIntStr = Annotated[
    int,
    BeforeValidator(_coerce_big_int),
    PlainSerializer(_serialize_big_int, return_type=str),
]


# ──────────────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────────────


class MevType(str, Enum):
    """MEV classification of a transaction.

    NOTE: the wire-format value for arbitrage is `arbitrage` (not
    `arb`) — the frontend's `MEV_TYPE_MAP` collapses it to `arb`
    after the round trip.
    """

    NORMAL = "normal"
    SANDWICH = "sandwich"
    ARBITRAGE = "arbitrage"
    JIT = "jit"
    LIQUIDATION = "liquidation"


class PoolProtocol(str, Enum):
    """DEX protocol a pool belongs to."""

    UNISWAP_V2 = "uniswap_v2"
    UNISWAP_V3 = "uniswap_v3"


class PositionStatus(str, Enum):
    """Aave V3 risk band for a borrow position."""

    SAFE = "safe"
    WARNING = "warning"
    DANGER = "danger"
    LIQUIDATED = "liquidated"


# ──────────────────────────────────────────────────────────────────────
# Pool
# ──────────────────────────────────────────────────────────────────────


class PoolToken(BaseModel):
    """Token metadata embedded in pool / LP responses."""

    model_config = ConfigDict(extra="forbid")

    address: str
    symbol: str
    decimals: int


class Pool(BaseModel):
    """A V2 or V3 pool snapshot (frontend `BackendPool`)."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
    )

    id: str
    protocol: PoolProtocol
    token0: PoolToken
    token1: PoolToken
    reserve0: BigIntStr | None = None
    reserve1: BigIntStr | None = None
    sqrt_price_x96: BigIntStr | None = Field(default=None, alias="sqrtPriceX96")
    fee_tier: int | None = Field(default=None, alias="feeTier")
    liquidity: BigIntStr | None = None
    tick: int | None = None

    def dump_wire(self) -> dict[str, Any]:
        """Serialize to the wire format (camelCase aliases, drop None)."""
        return self.model_dump(exclude_none=True, by_alias=True)


# ──────────────────────────────────────────────────────────────────────
# Transaction
# ──────────────────────────────────────────────────────────────────────


class Transaction(BaseModel):
    """A normalized on-chain transaction (frontend `BackendTx`)."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
    )

    hash: str
    sender: str = Field(alias="from")
    to: str
    value: BigIntStr
    gas_price: BigIntStr = Field(alias="gasPrice")
    gas_limit: BigIntStr = Field(alias="gasLimit")
    input_data: str = Field(alias="input")
    nonce: int
    block_number: int | None = Field(default=None, alias="blockNumber")
    timestamp: int
    mev_type: MevType = Field(alias="type")
    mev_profit: BigIntStr | None = Field(default=None, alias="mevProfit")
    victim_loss: BigIntStr | None = Field(default=None, alias="victimLoss")

    def dump_wire(self) -> dict[str, Any]:
        """Serialize to the wire format (camelCase aliases, drop None)."""
        return self.model_dump(exclude_none=True, by_alias=True)


# ──────────────────────────────────────────────────────────────────────
# Lending position (Aave V3)
# ──────────────────────────────────────────────────────────────────────


class LendingPosition(BaseModel):
    """One Aave V3 borrow position (frontend `BackendLending`)."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
    )

    id: str
    owner: str
    protocol: str = "aave_v3"
    collateral: dict[str, BigIntStr]
    debt: dict[str, BigIntStr]
    liquidation_threshold_e18: BigIntStr = Field(alias="liquidationThresholdE18")
    health_factor: float = Field(alias="healthFactor")
    timestamp: int

    def dump_wire(self) -> dict[str, Any]:
        """Serialize to the wire format."""
        return self.model_dump(exclude_none=True, by_alias=True)


# ──────────────────────────────────────────────────────────────────────
# LP position (Uniswap V3)
# ──────────────────────────────────────────────────────────────────────


class LpPosition(BaseModel):
    """One Uniswap V3 LP position (frontend `BackendLp`)."""

    model_config = ConfigDict(
        populate_by_name=True,
        extra="forbid",
    )

    id: str
    owner: str
    protocol: str = "uniswap_v3"
    pool_id: str = Field(alias="poolId")
    token0: PoolToken
    token1: PoolToken
    amount0: BigIntStr
    amount1: BigIntStr
    tick_lower: int = Field(alias="tickLower")
    tick_upper: int = Field(alias="tickUpper")
    fee_tier: int = Field(alias="feeTier")
    apr: float
    value_usd: float = Field(alias="valueUsd")
    fee_income_e18: BigIntStr = Field(alias="feeIncomeE18")
    impermanent_loss_e18: BigIntStr = Field(alias="impermanentLossE18")
    net_pnl_e18: BigIntStr = Field(alias="netPnlE18")
    timestamp: int
    status: str = "active"

    def dump_wire(self) -> dict[str, Any]:
        """Serialize to the wire format."""
        return self.model_dump(exclude_none=True, by_alias=True)


__all__ = [
    "BigIntStr",
    "LendingPosition",
    "LpPosition",
    "MevType",
    "Pool",
    "PoolProtocol",
    "PoolToken",
    "Transaction",
]
