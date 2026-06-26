"""Common watcher base — async lifecycle + broadcast loop."""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Callable
from typing import Generic, TypeVar

from dtm_backend.ws.hub import WSHub
from dtm_backend.ws.topics import WSMessage, WSTopic

log = logging.getLogger(__name__)

T = TypeVar("T")


class WatcherBase(ABC, Generic[T]):
    """Common pattern: pull events from `source()`, broadcast to `hub`.

    Subclasses provide:
      * `topic` — the `WSTopic` to broadcast on.
      * `to_message(event)` — convert the typed event to a `WSMessage`.

    `source` is a callable returning a fresh `AsyncIterator`
    each time it's called.  The watcher loop drives the
    iterator to completion, then exits cleanly.  Production
    code typically passes a generator that never ends (the
    JSON-RPC subscription or polling loop); tests pass a
    finite list-based iterator.
    """

    def __init__(
        self,
        *,
        hub: WSHub,
        source: Callable[[], AsyncIterator[T]],
        name: str = "watcher",
    ) -> None:
        self._hub = hub
        self._source_factory = source
        self._task: asyncio.Task[None] | None = None
        self._stopped = asyncio.Event()
        self._name = name
        # `_started` is the explicit lifecycle flag — `True`
        # from the first `start()` call until the next
        # `stop()`.  The task may complete naturally (empty
        # iterator in tests) while the watcher is still
        # "started".
        self._started: bool = False

    @property
    @abstractmethod
    def topic(self) -> WSTopic:
        """Topic the watcher broadcasts on."""

    @abstractmethod
    def to_message(self, event: T) -> WSMessage:
        """Convert the typed event into the `WSMessage` envelope."""

    async def start(self) -> None:
        """Spawn the broadcast loop as a background task (idempotent)."""
        if self._started:
            return
        self._started = True
        self._stopped.clear()
        self._task = asyncio.create_task(self._run(), name=self._name)

    async def stop(self) -> None:
        """Cancel the loop and wait for the task to exit (idempotent)."""
        if not self._started:
            return
        self._started = False
        self._stopped.set()
        if self._task is not None and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except (asyncio.CancelledError, Exception):
                pass
        self._task = None

    def is_running(self) -> bool:
        return self._started

    async def _run(self) -> None:
        """Pull events from the source and broadcast until cancelled.

        When the source iterator exhausts naturally (no more
        events to observe), the watcher auto-stops so
        `is_running()` reflects the real state — tests that
        pass an empty iterator see the watcher end without a
        manual `stop()` call.
        """
        try:
            iterator = self._source_factory()
            async for event in iterator:
                if self._stopped.is_set():
                    return
                try:
                    msg = self.to_message(event)
                    await self._hub.broadcast(self.topic, msg)
                except Exception as exc:
                    log.warning(
                        "watcher.broadcast_failed watcher=%s error=%s",
                        self._name,
                        exc,
                    )
        except asyncio.CancelledError:
            return
        except Exception as exc:
            log.warning("watcher.source_failed watcher=%s error=%s", self._name, exc)
        finally:
            # Iterator exhausted (or raised) — flip the
            # lifecycle flag so the watcher is no longer
            # "running" without an explicit `stop()`.
            self._started = False
            self._stopped.set()


__all__ = ["WatcherBase"]
