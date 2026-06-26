"""Unit tests for `dtm_backend.logger.configure_logging`."""
from __future__ import annotations

import logging

import structlog

from dtm_backend.logger import configure_logging


def test_configure_logging_runs_idempotently() -> None:
    """Calling `configure_logging` twice does not raise."""
    configure_logging("info", service="dtm-backend-test")
    configure_logging("info", service="dtm-backend-test")


def test_configure_logging_sets_root_level() -> None:
    """Root logger level matches the requested threshold (or INFO default)."""
    configure_logging("debug", service="dtm-backend-test")
    assert logging.getLogger().level == logging.DEBUG


def test_configure_logging_binds_service_context() -> None:
    """`service` is bound to structlog's contextvars for every record."""
    configure_logging("info", service="dtm-backend-test-svc")
    # Re-fetch the bound contextvars; structlog's bound value is global,
    # so the most recent call wins.
    bound = structlog.contextvars.get_contextvars()
    assert bound.get("service") == "dtm-backend-test-svc"
