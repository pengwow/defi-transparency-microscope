"""Console entrypoint.

`dtm-backend` is registered in `pyproject.toml` as a console
script and is the canonical way to run the production server
(locally: `uv run dtm-backend` or `python -m dtm_backend`).
"""
from __future__ import annotations

import uvicorn

from dtm_backend.config import load_config
from dtm_backend.logger import configure_logging
from dtm_backend.server import create_app


def main() -> None:
    """Boot the production server."""
    cfg = load_config()
    # uvicorn accepts only a specific set of log-level names
    # (`critical` / `error` / `warning` / `info` / `debug` / `trace`).
    # Coerce a bare `warn` (the structlog-idiomatic short form) to
    # `warning` so an operator can set LOG_LEVEL=warn if they like.
    uvicorn_level = "warning" if cfg.log_level == "warn" else cfg.log_level
    configure_logging(cfg.log_level)
    app = create_app(cfg)
    uvicorn.run(
        app,
        host=cfg.host,
        port=cfg.port,
        log_level=uvicorn_level,
        access_log=False,  # structlog handles access logs
    )


if __name__ == "__main__":
    main()
