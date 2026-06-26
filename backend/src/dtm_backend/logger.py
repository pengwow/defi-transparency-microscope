"""Structured logging via structlog.

We use structlog to keep the same shape as the previous
`pino`-based Fastify backend: JSON to stdout, one line per log
record, with `level` / `time` / `service` fields.
"""

from __future__ import annotations

import logging
import sys
from typing import Any

import structlog


def _add_logger_name_with_module(
    _logger: Any,
    _method_name: str,
    event_dict: structlog.types.EventDict,
) -> structlog.types.EventDict:
    """Like `structlog.stdlib.add_logger_name`, but works with the
    `PrintLoggerFactory` (which produces a `PrintLogger` lacking
    a `.name` attribute).  Falls back to the bound `module` key
    so the JSON envelope still carries a `logger` field.
    """
    event_dict.setdefault("logger", event_dict.get("module") or "dtm-backend")
    return event_dict


def configure_logging(level: str = "info", service: str = "dtm-backend") -> None:
    """Configure structlog + stdlib logging for JSON output.

    Idempotent — safe to call multiple times (subsequent calls
    reset the handlers but preserve the level threshold).
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    timestamper = structlog.processors.TimeStamper(fmt="iso", utc=True)
    pre_chain: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        _add_logger_name_with_module,
        timestamper,
    ]

    structlog.configure(
        processors=[
            *pre_chain,
            structlog.processors.dict_tracebacks,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )

    # Bind the service tag to every record.
    structlog.contextvars.bind_contextvars(service=service)

    # Also configure stdlib logging so libraries that use
    # `logging` (uvicorn, web3.py, FastAPI) emit JSON too.
    root = logging.getLogger()
    root.handlers.clear()
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        structlog.stdlib.ProcessorFormatter(
            foreign_pre_chain=pre_chain,
            processors=[
                structlog.stdlib.ProcessorFormatter.remove_processors_meta,
                structlog.processors.JSONRenderer(),
            ],
        )
    )
    root.addHandler(handler)
    root.setLevel(log_level)
