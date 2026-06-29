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
    # Print a human-readable CORS banner so a developer firing up
    # the backend alongside a Vite dev server can immediately see
    # which origins are allowed (and the wildcard state, if any).
    # If your browser console says
    #   "No 'Access-Control-Allow-Origin' header is present"
    # but this banner shows your origin in the list, the cause is
    # almost certainly that the backend is not reachable on the URL
    # the frontend is using (proxy / port mismatch / not started).
    effective = list(cfg.cors_origins) if not cfg.cors_allow_all else ["*"]
    if cfg.cors_allow_all or "*" in cfg.cors_origins:
        effective_label = "* (wildcard)"
    else:
        effective_label = ", ".join(effective)
    print(
        f"[dtm-backend] CORS allow_origins: {effective_label}\n"
        f"[dtm-backend]   (set CORS_ORIGINS / CORS_ALLOW_ALL to override)\n"
        f"[dtm-backend] listening on http://{cfg.host}:{cfg.port}",
        flush=True,
    )
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
