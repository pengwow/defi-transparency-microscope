"""WebSocket route — thin wrapper around the hub.

Mounts `GET /ws` (no prefix; the hub is global) and delegates
all the heavy lifting to `dtm_backend.ws.hub.WSHub`.  The
route's only job is to:
  * locate (or create) the hub on `app.state`,
  * accept the WebSocket,
  * hand it to the hub on `register()`,
  * unregister it on disconnect.

The watchers (`chain/amm_sync_watcher.py`,
`chain/liquidation_watcher.py`, `chain/mempool.py`) push data
into the hub via `broadcast()` — they do not interact with
this route directly.
"""

from __future__ import annotations

from fastapi import APIRouter, WebSocket

from dtm_backend.ws.hub import WSHub

router: APIRouter = APIRouter()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    """`GET /ws` — WebSocket entry point.

    Behaviour:
      1. Look up the hub on `app.state.ws_hub` (the lifespan
         hook installs one at startup).  If none is installed,
         create a default one and stash it.
      2. Hand the WebSocket to the hub — it does the
         accept/welcome/register dance AND owns the receive
         loop that dispatches subscribe/unsubscribe/ping.
      3. The route itself just blocks until the WebSocket
         closes (the hub unregisters the connection on
         disconnect via the `finally` block in the receiver).
    """
    hub: WSHub | None = getattr(websocket.app.state, "ws_hub", None)
    if hub is None:
        hub = WSHub(heartbeat_interval_s=30.0)
        websocket.app.state.ws_hub = hub
    conn = await hub.register(websocket)
    # The hub's internal receiver loop is the sole owner of
    # `receive_text` — racing it with our own loop would lose
    # action envelopes.  We just wait for the connection to
    # close by parking on `conn.closed_event` (which the
    # receiver's `finally` clause sets on disconnect).
    try:
        await conn.closed_event.wait()
    finally:
        await hub.unregister(conn)


__all__ = ["router", "websocket_endpoint"]
