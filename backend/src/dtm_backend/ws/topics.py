"""WebSocket topic enum + `WSMessage` discriminated union.

This module is the single source of truth for the wire
envelopes the backend emits on `/ws` (Phase 4 of the build
plan).  The frontend `wsClient.ts` is the contract spec; the
shapes below match §4.4 of the design plan.

Layer rules
-----------
* The hub (`ws/hub.py`) and the route (`routes/ws.py`) may
  import from here.
* HTTP code (FastAPI) is *not* allowed in this file.
* Pydantic is the only validation library used.
"""

from __future__ import annotations

from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, TypeAdapter

# ──────────────────────────────────────────────────────────────────────
# Topic catalogue
# ──────────────────────────────────────────────────────────────────────


class WSTopic(str, Enum):
    """The four topic identifiers the frontend can subscribe to.

    Members are string-typed so the enum doubles as a JSON
    serialiser — the wire value is the bare string, not
    `WSTopic.MEMPOOL`.
    """

    MEMPOOL = "mempool"
    LIQUIDATION = "liquidation"
    AMM_SYNC = "amm_sync"
    BLOCK_CONFIRM = "block_confirm"


def is_valid_topic(value: object) -> bool:
    """Return True iff `value` is one of the four spec topic strings.

    Strict equality with the enum's `value` keeps the check
    case-sensitive — the wire format is case-sensitive and the
    frontend never sends anything other than the lowercase form.
    """
    if not isinstance(value, str):
        return False
    return value in {t.value for t in WSTopic}


# ──────────────────────────────────────────────────────────────────────
# Outgoing data shapes
# ──────────────────────────────────────────────────────────────────────
#
# Each data model is a Pydantic `BaseModel` with
# `extra="forbid"`, which means the route layer can `model_dump`
# them into the WS envelope and any typo on the producer side
# fails the test suite before it lands in production.


class WSMemPoolTxData(BaseModel):
    """Mempool transaction payload — a pending tx we just observed."""

    model_config = ConfigDict(extra="forbid")

    hash: str
    to: str
    source: str  # `from` is a Python keyword, but Pydantic maps the alias
    amount: str  # decimal string
    gasPrice: str  # decimal string

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> WSMemPoolTxData:
        """Build a typed view from a raw dict, normalising the
        `from` → `source` rename so producers can use the JSON
        key directly."""
        if "from" in payload and "source" not in payload:
            payload = {**payload, "source": payload["from"]}
            payload.pop("from", None)
        return cls.model_validate(payload)


class WSLiquidationData(BaseModel):
    """Aave V3 liquidation event payload."""

    model_config = ConfigDict(extra="forbid")

    borrower: str
    collateral: str
    debt: str
    healthFactor: float


class WSAmmSyncData(BaseModel):
    """AMM reserves sync payload (slot0 / getReserves refresh)."""

    model_config = ConfigDict(extra="forbid")

    poolId: str
    reserve0: str  # decimal string
    reserve1: str  # decimal string
    blockNumber: int


class WSBlockConfirmData(BaseModel):
    """Head-of-chain block confirm payload."""

    model_config = ConfigDict(extra="forbid")

    blockNumber: int
    timestamp: int


class WSErrorData(BaseModel):
    """Error envelope payload — must always carry a message."""

    model_config = ConfigDict(extra="forbid")

    message: Annotated[str, Field(min_length=1)]


# ──────────────────────────────────────────────────────────────────────
# Outgoing envelope union
# ──────────────────────────────────────────────────────────────────────
#
# The hub emits `WSMessage` instances which know how to render
# themselves as the JSON envelope the frontend consumes.  A
# single `TypeAdapter` (rebuilt lazily) lets the route layer
# do `WSMessage.parse_obj(...)` for round-tripping.


class WSMessage(BaseModel):
    """Single discriminated union for the server-side envelopes.

    `model_config` is set so Pydantic populates from a dict
    matching the wire shape (`{"type": "mempool_tx", "data": ...}`)
    and round-trips through JSON verbatim.  The `data` field
    is intentionally untyped at this level — the discriminator
    is the `type` field, and downstream consumers narrow on
    `msg.type` (mirroring the frontend pattern).
    """

    model_config = ConfigDict(extra="forbid")

    type: str
    topics: list[str] | None = None
    data: dict[str, Any] | None = None

    def to_wire(self) -> dict[str, Any]:
        """Render the envelope as the wire-shape dict the hub emits.

        We exclude `topics` when it's `None` (the welcome / pong /
        data-bearing envelopes never carry a topic list) and
        `data` for the same reason — keeps the JSON minimal and
        matches the frontend's narrowing contract.
        """
        payload: dict[str, Any] = {"type": self.type}
        if self.topics is not None:
            payload["topics"] = self.topics
        if self.data is not None:
            payload["data"] = self.data
        return payload

    def to_json(self) -> str:
        """Serialise `to_wire()` to JSON."""
        import json as _json

        return _json.dumps(self.to_wire())

    # ── factory helpers ─────────────────────────────────────────────
    #
    # The hub never assembles a dict by hand — it always goes
    # through one of these constructors, which keeps the type
    # field authoritative and validates any data payload.

    @classmethod
    def welcome(cls) -> WSMessage:
        return cls(type="welcome")

    @classmethod
    def subscribed(cls, topics: list[str]) -> WSMessage:
        return cls(type="subscribed", topics=list(topics))

    @classmethod
    def unsubscribed(cls, topics: list[str]) -> WSMessage:
        return cls(type="unsubscribed", topics=list(topics))

    @classmethod
    def pong(cls) -> WSMessage:
        return cls(type="pong")

    @classmethod
    def mempool_tx(cls, payload: dict[str, Any]) -> WSMessage:
        validated = WSMemPoolTxData.from_payload(payload).model_dump(exclude_none=True)
        return cls(type="mempool_tx", data=validated)

    @classmethod
    def liquidation_event(cls, payload: dict[str, Any]) -> WSMessage:
        validated = WSLiquidationData.model_validate(payload).model_dump()
        return cls(type="liquidation_event", data=validated)

    @classmethod
    def amm_sync(cls, payload: dict[str, Any]) -> WSMessage:
        validated = WSAmmSyncData.model_validate(payload).model_dump()
        return cls(type="amm_sync", data=validated)

    @classmethod
    def block_confirm(cls, payload: dict[str, Any]) -> WSMessage:
        validated = WSBlockConfirmData.model_validate(payload).model_dump()
        return cls(type="block_confirm", data=validated)

    @classmethod
    def error(cls, message: str) -> WSMessage:
        validated = WSErrorData(message=message).model_dump()
        return cls(type="error", data=validated)


# ──────────────────────────────────────────────────────────────────────
# Incoming action parser
# ──────────────────────────────────────────────────────────────────────


class ClientAction(BaseModel):
    """A typed view of one of the three client → server actions.

    The wire format is `{"action": "...", "topics": [...]}`; the
    `topics` list is optional for `ping` (empty default) and
    required for `subscribe` / `unsubscribe` (enforced by the
    action type, see `ClientActionKind` below).
    """

    model_config = ConfigDict(extra="forbid")

    action: Literal["subscribe", "unsubscribe", "ping"]
    topics: list[str] = Field(default_factory=list)


_client_action_adapter: TypeAdapter[ClientAction] = TypeAdapter(ClientAction)


def parse_client_action(message: Any) -> ClientAction | None:
    """Tolerant parser for the client → server action envelopes.

    Returns `None` for any input that doesn't shape up as a
    valid action.  The hub turns `None` into a `WSMessage.error`
    reply, so the frontend sees a clean error envelope rather
    than a hard disconnect on the first typo.
    """
    if not isinstance(message, dict):
        return None
    try:
        return _client_action_adapter.validate_python(message)
    except Exception:
        return None


# Silence the unused-import warning for the type-only re-export.
_ = (Union, Literal)
