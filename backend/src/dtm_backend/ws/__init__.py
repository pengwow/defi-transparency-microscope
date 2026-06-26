"""WS package — Phase 4 wire-protocol surface.

The frontend `WsClient` is the contract spec; this module owns
the outgoing envelopes (server → client) and a tolerant parser
for incoming actions (client → server).  The hub in
`ws/hub.py` consumes these types but does not depend on
FastAPI — keeping the boundary clean lets the integration
tests drive the hub with a fake `WebSocket`.
"""

from __future__ import annotations

from dtm_backend.ws.topics import (
    ClientAction,
    WSAmmSyncData,
    WSBlockConfirmData,
    WSErrorData,
    WSLiquidationData,
    WSMemPoolTxData,
    WSMessage,
    WSTopic,
    is_valid_topic,
    parse_client_action,
)

__all__ = [
    "ClientAction",
    "WSAmmSyncData",
    "WSBlockConfirmData",
    "WSErrorData",
    "WSLiquidationData",
    "WSMemPoolTxData",
    "WSMessage",
    "WSTopic",
    "is_valid_topic",
    "parse_client_action",
]
