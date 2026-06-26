# dtm-backend (Python · FastAPI · web3.py)

> DeFi Transparency Microscope — Python backend.
> Wire-compatible with the frontend `HttpAPI` / `WsClient` (the
> frontend is unchanged and has no awareness of this rewrite).

## Status

**Phase 1 — skeleton.** Only the `GET /api/v1/health` route is
mounted.  The chain layer, REST routes, and WebSocket hub land in
later phases — see [docs/superpowers/plans/2026-06-26-dtm-backend-python.md](../docs/superpowers/plans/2026-06-26-dtm-backend-python.md).

## Quick start

```bash
# from repo root, or `cd backend`
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run the server (port 8000 by default)
dtm-backend

# Smoke test
curl http://127.0.0.1:8000/api/v1/health
# → {"status":"ok","chain":"mainnet","blockNumber":0,"wsConnected":false}
```

### Alternative: `uv`

```bash
uv sync --extra dev
uv run dtm-backend
```

## Layout

```
backend/
├── pyproject.toml
├── .env.example
├── src/dtm_backend/
│   ├── __init__.py
│   ├── config.py        # pydantic-settings, env-driven
│   ├── logger.py        # structlog JSON
│   ├── main.py          # `dtm-backend` console script
│   ├── server.py        # FastAPI factory + CORS + lifespan
│   ├── routes/
│   │   ├── __init__.py
│   │   └── health.py    # GET /api/v1/health
│   └── scripts/
│       ├── __init__.py
│       └── e2e_server.py  # `dtm-e2e-server` console script
└── tests/
    ├── conftest.py
    ├── config.test.py
    ├── build_cors_options.test.py
    └── integration/
        └── smoke.test.py
```

## Configuration

All settings come from environment variables (with a `.env` file
in the working directory if present).  See [`.env.example`](./.env.example)
for the full list.  Highlights:

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8000` | uvicorn bind port |
| `HOST` | `0.0.0.0` | uvicorn bind host |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warning` / `error` |
| `RPC_URL` | `https://eth.llamarpc.com` | Ethereum mainnet by default |
| `RPC_WS_URL` | *(unset)* | Optional WebSocket endpoint |
| `CHAIN_ID` | `1` | Used to label `/api/v1/health` |
| `CORS_ORIGINS` | `http://localhost:5173, http://127.0.0.1:5173` | Comma-separated allow-list |
| `CORS_ALLOW_ALL` | `false` | Set to `true` to unlock `*` |
| `CACHE_TTL_MS` | `5000` | Generic chain cache TTL |
| `LIQUIDATION_POLL_MS` | `12000` | Aave V3 liquidation watcher poll |
| `AMM_SYNC_POLL_MS` | `12000` | AMM sync watcher poll |

## Tests

```bash
pytest                                          # everything
pytest tests/ --ignore=tests/integration        # unit only
pytest tests/integration/                       # integration only
pytest --cov=src/dtm_backend --cov-report=term-missing
```

Coverage is configured in `pyproject.toml` to omit `main.py` and
the `scripts/` package (those are entry points, not library
code).  Per-glob thresholds will be added in Phase 5.

## CORS

`server._build_cors_options()` translates `Config.cors_*` into
`CORSMiddleware` kwargs.  Resolution rules (preserved from the
previous TypeScript backend):

- `CORS_ALLOW_ALL=true`        → `allow_origins=["*"]`
- `*` in `CORS_ORIGINS`        → `allow_origins=["*"]`
- otherwise                    → exact-match allow-list

`allow_credentials` is always `False` (CORS spec forbids `*` with
credentials).

## License

MIT.
