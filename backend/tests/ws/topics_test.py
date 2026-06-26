"""Unit tests for `dtm_backend.ws.topics`.

Phase 4 wire-protocol surface — the WSTopic enum + the
discriminated WSMessage union.  These tests pin the *outgoing*
shape (server → client) the frontend `WsClient` consumes.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from dtm_backend.ws.topics import (
    WSMessage,
    WSTopic,
    is_valid_topic,
    parse_client_action,
)


def test_wstopic_enum_has_four_members() -> None:
    """`WSTopic` must expose exactly the four topics the spec defines."""
    members = {m.value for m in WSTopic}
    assert members == {"mempool", "liquidation", "amm_sync", "block_confirm"}


def test_is_valid_topic_accepts_known_topics() -> None:
    """`is_valid_topic` returns True for the four spec topics."""
    assert is_valid_topic("mempool") is True
    assert is_valid_topic("liquidation") is True
    assert is_valid_topic("amm_sync") is True
    assert is_valid_topic("block_confirm") is True


def test_is_valid_topic_rejects_unknown() -> None:
    """Unknown strings (and non-strings) return False."""
    assert is_valid_topic("not-a-topic") is False
    assert is_valid_topic("") is False
    assert is_valid_topic("MEMPOOL") is False  # case-sensitive
    assert is_valid_topic(None) is False  # type: ignore[arg-type]


def test_welcome_message_serialises_to_canonical_shape() -> None:
    """`WSMessage.welcome()` round-trips as `{ "type": "welcome" }`."""
    msg = WSMessage.welcome()
    payload = msg.to_wire()
    assert payload == {"type": "welcome"}


def test_subscribed_message_carries_topic_list() -> None:
    """`WSMessage.subscribed(topics)` round-trips the list verbatim."""
    msg = WSMessage.subscribed(["mempool", "amm_sync"])
    payload = msg.to_wire()
    assert payload == {"type": "subscribed", "topics": ["mempool", "amm_sync"]}


def test_unsubscribed_message_carries_topic_list() -> None:
    """`WSMessage.unsubscribed(topics)` mirrors the subscribed shape."""
    msg = WSMessage.unsubscribed(["mempool"])
    payload = msg.to_wire()
    assert payload == {"type": "unsubscribed", "topics": ["mempool"]}


def test_pong_message_is_a_single_field() -> None:
    """`WSMessage.pong()` round-trips as `{ "type": "pong" }`."""
    payload = WSMessage.pong().to_wire()
    assert payload == {"type": "pong"}


def test_mempool_tx_message_carries_decimal_string_amount() -> None:
    """The `mempool_tx` payload serialises `amount` as a decimal string."""
    msg = WSMessage.mempool_tx(
        {
            "hash": "0x" + "a" * 64,
            "to": "0x" + "1" * 40,
            "source": "0x" + "2" * 40,
            "amount": "1000000",
            "gasPrice": "1000000000",
        }
    )
    payload = msg.to_wire()
    assert payload["type"] == "mempool_tx"
    assert payload["data"]["amount"] == "1000000"
    assert payload["data"]["gasPrice"] == "1000000000"


def test_liquidation_event_message_shape() -> None:
    """`liquidation_event` payload carries collateral/debt/healthFactor."""
    msg = WSMessage.liquidation_event(
        {
            "borrower": "0x" + "1" * 40,
            "collateral": "0x" + "2" * 40,
            "debt": "0x" + "3" * 40,
            "healthFactor": 1.1,
        }
    )
    payload = msg.to_wire()
    assert payload["type"] == "liquidation_event"
    assert payload["data"]["borrower"].startswith("0x")
    assert payload["data"]["healthFactor"] == 1.1


def test_amm_sync_message_shape() -> None:
    """`amm_sync` payload carries poolId + reserve0/1 (decimal strings)."""
    msg = WSMessage.amm_sync(
        {
            "poolId": "0x" + "4" * 40,
            "reserve0": "1000000",
            "reserve1": "2000000",
            "blockNumber": 18_000_000,
        }
    )
    payload = msg.to_wire()
    assert payload["type"] == "amm_sync"
    assert payload["data"]["reserve0"] == "1000000"
    assert payload["data"]["reserve1"] == "2000000"
    assert payload["data"]["blockNumber"] == 18_000_000


def test_block_confirm_message_shape() -> None:
    """`block_confirm` payload carries the block number + timestamp."""
    msg = WSMessage.block_confirm({"blockNumber": 18_000_000, "timestamp": 1_700_000_000})
    payload = msg.to_wire()
    assert payload == {
        "type": "block_confirm",
        "data": {"blockNumber": 18_000_000, "timestamp": 1_700_000_000},
    }


def test_error_message_carries_string_message() -> None:
    """`error` payload must always carry a non-empty `message` string."""
    msg = WSMessage.error("subscribe failed")
    payload = msg.to_wire()
    assert payload == {"type": "error", "data": {"message": "subscribe failed"}}


def test_to_json_matches_to_wire() -> None:
    """`to_json()` mirrors `to_wire()` (smoke check on the JSON path)."""
    import json as _json

    msg = WSMessage.subscribed(["mempool"])
    assert _json.loads(msg.to_json()) == msg.to_wire()


def test_error_message_rejects_empty_message() -> None:
    """An `error` envelope with an empty message is rejected."""
    with pytest.raises(ValidationError):
        WSMessage.error("")


def test_parse_client_action_handles_subscribe() -> None:
    """`parse_client_action` recognises a `subscribe` envelope."""
    action = parse_client_action({"action": "subscribe", "topics": ["mempool"]})
    assert action is not None
    assert action.action == "subscribe"
    assert action.topics == ["mempool"]


def test_parse_client_action_handles_unsubscribe() -> None:
    """`parse_client_action` recognises an `unsubscribe` envelope."""
    action = parse_client_action({"action": "unsubscribe", "topics": ["amm_sync"]})
    assert action is not None
    assert action.action == "unsubscribe"
    assert action.topics == ["amm_sync"]


def test_parse_client_action_handles_ping() -> None:
    """`parse_client_action` recognises a `ping` (no topics required)."""
    action = parse_client_action({"action": "ping"})
    assert action is not None
    assert action.action == "ping"
    assert action.topics == []


def test_parse_client_action_rejects_unknown_action() -> None:
    """Unknown actions are dropped (returns None, never raises)."""
    assert parse_client_action({"action": "drop"}) is None


def test_parse_client_action_rejects_non_object_payload() -> None:
    """Non-object inputs (string / list / null) return None."""
    assert parse_client_action("hello") is None
    assert parse_client_action(["subscribe", "mempool"]) is None
    assert parse_client_action(None) is None
