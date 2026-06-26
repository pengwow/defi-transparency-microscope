# DTM Backend (Python) — New Plan

> Replaces the previous TypeScript/Fastify implementation
> (`docs/superpowers/specs/2026-06-25-dtm-backend-design.md`).
> The wire format, REST endpoints, WebSocket protocol, address
> list, and OpenAPI spec are unchanged — only the implementation
> language and HTTP framework move.

## 1. Why this change

The user requirement is that the backend be **Python + FastAPI**, not
Node.js + Fastify.  Concretely:

- The TypeScript implementation has ~316 unit tests, 16 integration
  tests, an OpenAPI 3.1 spec, a custom CORS resolver, an offline
  e2e stub, a per-glob coverage checker, and a 4-job GitHub Actions
  CI pipeline.  **All of this is being deleted and rebuilt in Python.**
- The frontend's `HttpAPI` (`frontend/src/services/httpApi.ts`) and
  the `WsClient` (`frontend/src/services/wsClient.ts`) are kept
  verbatim.  The wire format must remain byte-for-byte compatible.
- The design intent in `asset/design/DTM_Detailed_Design.html §6`
  is unchanged; only the implementation language shifts.

## 2. Tech stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | Python 3.12 | Async, mature typing (`from __future__ import annotations`) |
| HTTP framework | FastAPI 0.115 | Async, OpenAPI auto-gen, Pydantic v2 validation |
| ASGI server | Uvicorn 0.32 | Standard FastAPI runner |
| WebSocket | FastAPI's built-in WS | Avoids pulling Starlette separately; supports subprotocols |
| Chain | **web3.py 7.x** (async API) | Official Ethereum Foundation library, mature async support |
| Validation | Pydantic v2 | Same library FastAPI uses; model → JSON |
| Tests | pytest 8 + pytest-asyncio + httpx.AsyncClient | Standard Python async testing |
| Mock chain | Custom in-memory `Web3` shim + `eth_call` ABI fixture | Same approach as before, just in Python |
| Logging | structlog 24 | Structured JSON logs to match the Fastify `pino` shape |
| CORS | `fastapi.middleware.cors.CORSMiddleware` | Built-in |
| Config | `pydantic-settings` 2 | Type-safe env loading |
| Lint | ruff 0.6 + mypy 1.11 | Standard Python tooling |
| Coverage | coverage.py 7 + `pytest --cov` + a custom per-glob check | Replaces the v8 json-summary script |

### 2.1 Why web3.py, not web3.py-async-only or ape

- `web3.py` is the official eth-foundation library; it has the
  best long-term maintenance and the largest ABI / event
  coverage.
- The async API (`AsyncWeb3`) is a first-class citizen in 7.x.
- The middleware layer supports an in-memory fake (used in tests
  and the e2e stub) without monkey-patching the global provider.

## 3. Architecture

```
backend/
├── pyproject.toml          # uv-friendly, also works with pip
├── uv.lock                 # lock file
├── .env.example
├── README.md
├── openapi.yaml            # re-exported from FastAPI's auto-gen
├── src/
│   └── dtm_backend/        # the package
│       ├── __init__.py
│       ├── main.py             # `dtm-backend` entrypoint (uvicorn)
│       ├── config.py           # pydantic-settings Config
│       ├── server.py           # FastAPI app factory + lifespan
│       ├── errors.py           # error envelope + exception handlers
│       ├── chain/
│       │   ├── __init__.py
│       │   ├── addresses.py    # EIP-55 mainnet addresses
│       │   ├── abis.py         # minimal ABI strings
│       │   ├── provider.py     # AsyncWeb3 factory + fallback
│       │   ├── cached.py       # CachedProvider (TTL cache)
│       │   ├── pools.py        # listPools()
│       │   ├── transactions.py # listTransactions()
│       │   ├── lending.py      # listLendingPositions()
│       │   ├── lp.py           # listLpPositions()
│       │   ├── classify.py     # log → TxType
│       │   ├── chain_name.py   # chainId → friendly name
│       │   ├── amm_sync_watcher.py
│       │   ├── liquidation_watcher.py
│       │   └── mempool.py      # MempoolSource (WS or HTTP poll)
│       ├── ws/
│       │   ├── __init__.py
│       │   ├── topics.py       # WSTopic + isValidTopic + WSMessage
│       │   ├── hub.py          # WebSocket connection registry
│       │   └── routes.py       # /ws endpoint
│       ├── experiments/
│       │   ├── __init__.py
│       │   ├── cpmm.py         # getAmountOut (pure math)
│       │   ├── sandwich.py     # 3-swap simulation
│       │   ├── il.py           # calculateV2IL / calculateV3IL
│       │   ├── attribution.py  # 4-component decomposition
│       │   ├── presets.py      # 4 in-memory presets
│       │   └── types.py        # ExperimentResult etc. (pydantic)
│       └── routes/
│           ├── __init__.py
│           ├── health.py
│           ├── pools.py
│           ├── transactions.py
│           ├── positions.py
│           └── experiments.py
├── scripts/
│   ├── e2e_server.py       # offline FastAPI + ABI-encoded canned data
│   └── coverage_check.py   # parses coverage.py json-summary, asserts per-glob thresholds
└── tests/
    ├── conftest.py
    ├── helpers/
    │   ├── fake_web3.py    # in-memory AsyncWeb3 stand-in
    │   └── build_test_app.py
    ├── chain/
    │   ├── addresses.test.py
    │   ├── pools.test.py
    │   ├── transactions.test.py
    │   ├── lending.test.py
    │   ├── lp.test.py
    │   ├── classify.test.py
    │   ├── amm_sync_watcher.test.py
    │   ├── liquidation_watcher.test.py
    │   └── mempool.test.py
    ├── experiments/
    │   ├── cpmm.test.py
    │   ├── sandwich.test.py
    │   ├── il.test.py
    │   ├── attribution.test.py
    │   └── presets.test.py
    ├── ws/
    │   ├── topics.test.py
    │   ├── hub.test.py
    │   └── routes.test.py
    ├── routes/
    │   ├── health.test.py
    │   ├── pools.test.py
    │   ├── transactions.test.py
    │   ├── positions.test.py
    │   └── experiments.test.py
    ├── build_cors_options.test.py
    ├── config.test.py
    └── integration/
        ├── smoke.test.py     # hits every REST endpoint
        └── ws.test.py        # hits /ws, subscribes, receives
```

### 3.1 Data flow (identical to TS spec)

```
RPC node  ──► AsyncWeb3  ──► chain/*.py (typed wrappers)
                                    │
                                    ├─► REST routes ──► HTTP response
                                    │
                                    └─► broadcaster ──► WS hub ──► clients
```

### 3.2 Layer boundaries (identical to TS spec)

| Layer | Inputs | Outputs | Forbidden |
|---|---|---|---|
| `chain/*` | AsyncWeb3, addresses, ABIs | pydantic domain models | FastAPI, HTTPException |
| `experiments/*` | input configs | `ExperimentResult` | FastAPI, HTTPException |
| `routes/*` | `Request`, pydantic schema | `JSONResponse` | direct AsyncWeb3 (must go through `chain/*`) |
| `ws/*` | provider events | WS messages | HTTP, REST |

## 4. Wire contract (preserved verbatim)

The wire contract is the **single source of truth** for the rewrite.
The frontend's `httpApi.ts` / `wsClient.ts` is the contract
specification.  No field, type, or URL changes.

### 4.1 REST endpoints (under `/api/v1`)

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | chain head + ws hub status |
| GET | `/pools` | 3 curated pools (V2 + V3) |
| GET | `/transactions?blocks=10&limit=200` | trailing-block scan, classified |
| GET | `/lending-positions` | Aave V3 curated borrowers |
| GET | `/lp-positions` | V3 curated LPs |
| GET | `/experiments` | 4 in-memory presets |
| GET | `/experiments/{id}` | one preset, 404 if unknown |
| POST | `/experiments/sandwich` | 3-swap simulation |
| POST | `/experiments/il` | V2 or V3 IL |
| POST | `/experiments/attribution` | 4-component decomposition |

### 4.2 Bigint serialisation

All integer-typed fields (token amounts, reserves, gas, P&L,
NFT tokenIds) are emitted and accepted as **decimal strings**
(e.g. `"1000000000000000000"`).  Implementation: a Pydantic
`BeforeValidator` that accepts `int | str` and emits `str`.

### 4.3 Error envelope (preserved)

```json
{ "error": "not_found" | "validation" | "upstream_unreachable" | "internal",
  "message": "...",
  "issues"?: [...],     // only on "validation"
  "traceId"?: "..." }   // only on "internal"
```

### 4.4 WebSocket protocol (preserved)

```
URL: ws://host:port/ws
Hello: server → { "type": "welcome" }
Client → server:
  { "action": "subscribe",   "topics": [...] }
  { "action": "unsubscribe", "topics": [...] }
  { "action": "ping" }
Server → client:
  { "type": "subscribed",   "topics": [...] }
  { "type": "unsubscribed", "topics": [...] }
  { "type": "pong" }
  { "type": "mempool_tx",   "data": { ... } }
  { "type": "liquidation_event", "data": { ... } }
  { "type": "amm_sync",     "data": { ... } }
  { "type": "block_confirm","data": { ... } }
  { "type": "error",        "data": { "message": "..." } }
Heartbeat: server pings every 30s.
```

### 4.5 CORS (preserved)

`CORS_ORIGINS` env var (comma-separated, default
`http://localhost:5173,http://127.0.0.1:5173`, special value
`*`).  Same resolution rules as the previous backend.

## 5. Phased delivery

Per the user's "先骨架,后细节" choice, the rebuild is broken into
5 phases.  Each phase ends with a green commit and a push.

### Phase 0 — Spec + scaffolding (this document)

- ✅ Plan document (`docs/superpowers/plans/2026-06-26-dtm-backend-python.md`).
- ⏭ Create the new `backend/` skeleton (empty `pyproject.toml`,
  `src/dtm_backend/__init__.py`, `main.py` that imports FastAPI,
  config, lifespan).
- ⏭ Add a `package.json` at the repo root? **No** — Python uses
  `pyproject.toml`, no JS root.
- ⏭ Update root `.gitignore` to ignore `__pycache__`, `.venv`,
  `*.egg-info`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`,
  `htmlcov`, `coverage.json`.

### Phase 1 — Skeleton + Hello World e2e

- `src/dtm_backend/server.py` exports `create_app(config)` returning
  a FastAPI app.
- `GET /api/v1/health` returns `{ "status": "ok", "chain": "mainnet",
  "blockNumber": 0, "wsConnected": false }` (no chain access yet).
- `src/dtm_backend/scripts/e2e_server.py` boots the same app on
  port 8765 from a canned config.
- `tests/integration/smoke.test.py` hits `/api/v1/health`.
- Update `scripts/e2e-smoke.sh` to use `uvicorn` instead of `pnpm
  build && pnpm e2e:server`.
- CI: replace `backend-unit` job with `pip install -e .[dev]` and
  `pytest tests/ --ignore=tests/integration`.
- **Acceptance**: `bash scripts/e2e-smoke.sh` returns 0, frontend
  `VITE_USE_BACKEND=true` build still works.

### Phase 2 — Chain layer (real RPC reads)

- `chain/addresses.py`: copy the 11 addresses from the old
  `backend/src/chain/addresses.ts` as a frozen dict; add
  `is_checksummed()` + `assert_addresses_valid()`.
- `chain/abis.py`: copy the 6 ABI fragments as Python lists of
  string signatures (web3.py accepts strings).
- `chain/provider.py`: `make_async_web3(rpc_url, *, fallbacks)`
  that pings `eth_blockNumber` on each candidate, picks the
  first that responds within 3s, and returns an `AsyncWeb3`
  instance.
- `chain/cached.py`: TTL cache for `eth_call` results
  (5s default).  Uses `cachetools.TTLCache`.
- `chain/pools.py`, `chain/transactions.py`, `chain/lending.py`,
  `chain/lp.py`: port the TS modules.  Use `asyncio.gather` for
  parallel reads.
- `chain/classify.py`: pure-Python log classifier.
- `routes/pools.py`, `routes/transactions.py`,
  `routes/positions.py`: REST routes backed by `chain/*`.
- `tests/chain/*`: unit tests with the in-memory fake Web3.
- **Acceptance**: `GET /pools` and `GET /transactions` return
  valid JSON; frontend `HttpAPI.listPools()` works against
  `http://localhost:8000`.

### Phase 3 — Experiments (pure math)

- `experiments/cpmm.py`: `get_amount_out(amount_in, reserve_in,
  reserve_out, fee_bip)` — direct port of the TS
  `experiments/cpmm.ts`.
- `experiments/sandwich.py`, `il.py`, `attribution.py`: direct
  ports.  Use `web3.AsyncWeb3.eth.call` to optionally refresh
  V2 reserves on `poolAddress`.
- `experiments/presets.py`: 4 in-memory presets.
- `routes/experiments.py`: 5 endpoints.
- `tests/experiments/*`: 5 unit-test files, mirrors the TS suite.
- **Acceptance**: all 5 experiment endpoints return valid JSON;
  the front-end `runSandwichExperiment` / `runIlExperiment` /
  `runAttributionExperiment` all work.

### Phase 4 — WebSocket hub + mempool + watchers

- `ws/topics.py`: `WSTopic` enum + `WSMessage` union (Pydantic
  discriminated union).
- `ws/hub.py`: per-connection `asyncio.Queue`, broadcast helpers,
  subscribe / unsubscribe reconciliation, 30s heartbeat.
- `mempool.py`: `MempoolSource` with WS transport (when
  `RPC_WS_URL` set) and HTTP-polling fallback (every 1.5s).
- `amm_sync_watcher.py`, `liquidation_watcher.py`: port the
  TS watchers to async.
- `routes/ws.py`: `GET /ws` endpoint that uses `hub.register()`.
- `tests/integration/ws.test.py`: 5 e2e tests.
- **Acceptance**: 5/5 WS tests pass; `WsClient` connects and
  receives `welcome` + a synthetic `mempool_tx`.

### Phase 5 — Polish: errors, CORS, OpenAPI, coverage, CI

- `errors.py`: Pydantic `ErrorResponse` model + 4 exception
  handlers (`not_found`, `validation`, `upstream_unreachable`,
  `internal`).
- `config.py`: `CORS_ORIGINS` env parsing with the same
  semantics as the TS `readCorsOrigins` (dev defaults, `*`,
  comma-list, dedupe).
- `routes/health.py` adds `wsConnected: bool` wired to
  `hub.is_connected()`.
- `openapi.yaml`: re-export FastAPI's auto-generated spec, with
  manual docs on each endpoint matching the old spec.
- `scripts/coverage_check.py`: parse `coverage.json`, assert
  per-glob thresholds (`chain/ >= 80%`, `experiments/ >= 90%`,
  `routes/ >= 70%`).
- CI: 4 jobs (backend-unit, frontend-unit, e2e, frontend-build)
  reworked for Python; Python uses `actions/setup-python@v5` with
  cache=`pip` and a `pip install -e .[dev]`.
- `README.md`: replace the TypeScript-centric sections.
- **Acceptance**: `bash scripts/e2e-smoke.sh` 26/26 green;
  full CI green; per-glob coverage gates met; OpenAPI schema
  validates.

## 6. What gets deleted

| Path | Reason |
|---|---|
| `backend/` (entire directory) | Replaced by Python version |
| `docs/superpowers/specs/2026-06-25-dtm-backend-design.md` | Superseded by this plan |
| `.github/workflows/ci.yml` `backend-unit` and `e2e` jobs | Rewritten in Python |

## 7. What stays

- `frontend/` (unchanged) — the `HttpAPI` and `WsClient` are the
  contract spec.
- `docs/superpowers/specs/2026-06-25-dtm-mvp-frontend-design.md`
  (unchanged).
- `asset/design/DTM_Detailed_Design.html` (unchanged) — the high-
  level design intent.
- `docs/superpowers/plans/2026-06-25-dtm-frontend-demo-port.md`
  (unchanged).
- `scripts/e2e-smoke.sh` (rewritten in place, same name).

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Bigint serialisation in JSON differs from the TS implementation | Pydantic `BeforeValidator` produces decimal strings; explicit unit tests assert `int | str → str` |
| Web3.py vs ethers v6 ABI decoding differences | Each ABI fragment is small and we have end-to-end tests against the e2e stub |
| Async race in the WS hub (subscribe before welcome) | Hub buffers the welcome until the first `pop()` call; mirrors the TS fix |
| Pytest-asyncio event loop leakage between tests | Single session-scoped event loop; `asyncio_mode=auto`; fixtures use `pytest_asyncio.fixture` |
| Coverage.py vs v8 coverage format | Custom `coverage_check.py` reads coverage.py's `coverage.json` (a well-documented format) |
| Long phase delivery — workspace reset risk | One commit + push per phase (per the user's standing instruction) |

## 9. Open questions

None — all four decisions were captured from the user:
1. Delete TS backend entirely.
2. Use web3.py.
3. Keep wire contract identical.
4. Build in phases (skeleton first).
