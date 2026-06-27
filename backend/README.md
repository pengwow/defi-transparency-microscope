# dtm-backend (Python · FastAPI · web3.py)

> DeFi Transparency Microscope — Python backend.
> Wire-compatible with the frontend `HttpAPI` / `WsClient` (the
> frontend is unchanged and has no awareness of this rewrite).

## Status

All five planned phases are landed:

| Phase | Surface | Endpoints / behaviour |
| --- | --- | --- |
| 1 | Skeleton + CORS | `GET /api/v1/health` |
| 2 | Chain data | `/pools`, `/transactions`, `/lending-positions`, `/lp-positions` |
| 3 | Experiments | `/experiments`, `/experiments/{id}`, `/experiments/sandwich`, `/experiments/il`, `/experiments/attribution` |
| 4 | WebSocket hub | `GET /ws` + `mempool` / `amm_sync` / `liquidation` watchers |
| 5 | Polish | error envelope, coverage gates, CI |

See [docs/superpowers/plans/2026-06-26-dtm-backend-python.md](../docs/superpowers/plans/2026-06-26-dtm-backend-python.md)
for the original plan.

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

### Running backend + frontend together

Use the repo-level dev launcher to start both stacks in one
terminal with colour-coded output and a single Ctrl+C shutdown:

```bash
# from the repo root
./scripts/dev.sh                # both backend (8000) + frontend (5173)
./scripts/dev.sh --backend-only # only the FastAPI server
./scripts/dev.sh --frontend-only
BACKEND_PORT=9000 FRONTEND_PORT=5174 ./scripts/dev.sh
```

Each service's output is prefixed (`[backend] …` / `[frontend] …`)
so the two streams stay easy to tell apart, and a single Ctrl+C
sends SIGTERM to both process trees (with a 5s grace period
before SIGKILL).  Set `KEEP_LOGS=1` to retain the per-service
log files in `/tmp/dev-{backend,frontend}.*.log` for debugging.

## Layout

```
backend/
├── pyproject.toml
├── .env.example
├── src/dtm_backend/
│   ├── __init__.py
│   ├── config.py        # pydantic-settings, env-driven
│   ├── errors.py        # ErrorResponse + global exception handlers
│   ├── logger.py        # structlog JSON
│   ├── main.py          # `dtm-backend` console script
│   ├── server.py        # FastAPI factory + CORS + lifespan + handlers
│   ├── chain/           # web3.py adapters, ABI registry, classification
│   ├── experiments/     # pure-math sandwich / IL / attribution
│   ├── routes/          # HTTP endpoints (one module per resource)
│   ├── scripts/         # e2e stub server
│   ├── watchers/        # AsyncIterator[T] -> WS broadcast loops
│   └── ws/              # WSHub, WSTopic, WSMessage union
└── tests/               # mirror the src/ tree, one file per module
```

## HTTP API

| Method | Path | Notes |
| --- | --- | --- |
| `GET`  | `/api/v1/health` | Liveness; reports `wsConnected` from the live hub. |
| `GET`  | `/api/v1/pools` | V2 + V3 pools. |
| `GET`  | `/api/v1/transactions` | Mempool + mined txs (typed). |
| `GET`  | `/api/v1/lending-positions` | Aave V3 positions. |
| `GET`  | `/api/v1/lp-positions` | Uniswap V3 LP positions. |
| `GET`  | `/api/v1/experiments` | 4 in-memory presets. |
| `GET`  | `/api/v1/experiments/{id}` | Single preset (404 if unknown). |
| `POST` | `/api/v1/experiments/sandwich` | Run a sandwich simulation. |
| `POST` | `/api/v1/experiments/il` | Compute V2 / V3 IL. |
| `POST` | `/api/v1/experiments/attribution` | 4-component PnL decomposition. |
| `GET`  | `/ws` | WebSocket — see below. |

### Error envelope

Every 4xx / 5xx response is a JSON object of the form:

```json
{ "error": "not_found", "message": "missing preset: 'foo'" }
```

| `error` | HTTP | When |
| --- | --- | --- |
| `not_found` | 404 | Unknown resource id. |
| `validation` | 422 | Pydantic request validation. |
| `upstream_unreachable` | 502 | RPC / external dependency failure. |
| `internal` | 500 | Unhandled exception. |
| `http_<code>` | various | Other 4xx from the framework. |

`details` is included only when there's a structured payload (e.g.
`{ "errors": [...] }` for validation).

## WebSocket

`GET /ws` accepts a single client per connection and emits envelopes:

| `type` | Direction | Purpose |
| --- | --- | --- |
| `welcome` | server → client | On connect. |
| `subscribed` / `unsubscribed` | server → client | Ack for `subscribe` / `unsubscribe`. |
| `pong` | server → client | Reply to a client `ping`. |
| `mempool_tx` | server → client | Mempool transaction. |
| `amm_sync` | server → client | AMM reserve update. |
| `liquidation_event` | server → client | Aave V3 liquidation. |
| `block_confirm` | server → client | New block. |
| `error` | server → client | `{error, message}` envelope. |

Client → server actions: `subscribe` / `unsubscribe` / `ping` (all
JSON with a `topics` list, except `ping`).

## Configuration

All settings come from environment variables (with a `.env` file
in the working directory if present).  See [`.env.example`](./.env.example)
for the full list.  Highlights:

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `8000` | uvicorn bind port |
| `HOST` | `0.0.0.0` | uvicorn bind host |
| `LOG_LEVEL` | `info` | `debug` / `info` / `warning` / `error` |
| `ENV` | `dev` | `dev` / `test` / `prod` |
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
code).  Per-glob thresholds are enforced by
[`scripts/coverage_check.py`](../scripts/coverage_check.py):

| Glob | Threshold |
| --- | --- |
| `chain/` | ≥ 80 % |
| `experiments/` | ≥ 90 % |
| `routes/` | ≥ 70 % |

Run the gate locally:

```bash
coverage run -m pytest tests/ -q
coverage json -o coverage/coverage.json
python3.12 ../scripts/coverage_check.py --coverage coverage/coverage.json
```

## CORS

`server._build_cors_options()` translates `Config.cors_*` into
`CORSMiddleware` kwargs.  Resolution rules (preserved from the
previous TypeScript backend):

- `CORS_ALLOW_ALL=true`        → `allow_origins=["*"]`
- `*` in `CORS_ORIGINS`        → `allow_origins=["*"]`
- otherwise                    → exact-match allow-list

`allow_credentials` is always `False` (CORS spec forbids `*` with
credentials).

## CI

The GitHub Actions pipeline (`.github/workflows/ci.yml`) runs four
jobs on every push to `main` and on pull requests:

1. `backend · unit` — pip install, ruff, mypy, pytest, coverage
2. `frontend · unit` — pnpm lint / typecheck / test
3. `e2e · backend skeleton` — boots the offline stub, runs
   `scripts/e2e-smoke.sh`
4. `frontend · build` — `pnpm build` with `VITE_USE_BACKEND=true`

## End-to-end smoke

[`scripts/e2e-smoke.sh`](../scripts/e2e-smoke.sh) installs the
backend, boots the offline e2e stub on a free port, and verifies
the wire shape of every REST endpoint, the CORS headers, and the
`/ws` envelope flow.  Use it locally or in CI.

## License

MIT.
