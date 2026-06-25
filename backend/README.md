# DTM Backend

DeFi Transparency Microscope — Node.js + Fastify backend service.

See [`docs/superpowers/specs/2026-06-25-dtm-backend-design.md`](../docs/superpowers/specs/2026-06-25-dtm-backend-design.md) for the full design.

## Quick start

```bash
# 1. install dependencies
pnpm install

# 2. copy the env template and edit as needed
cp .env.example .env

# 3. dev mode (auto-reload via tsx watch)
pnpm dev

# 4. build & run production
pnpm build
pnpm start
```

The server listens on `:8000` by default. Hit `GET /api/v1/health` to verify.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run with hot-reload (tsx) |
| `pnpm build` | Compile TypeScript to `dist/` |
| `pnpm start` | Run the compiled `dist/server.js` |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Watch-mode tests |
| `pnpm test:coverage` | Generate v8 coverage report |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | ESLint with `@typescript-eslint` |

## Layout

```
src/
  config.ts     # env → typed config
  logger.ts     # pino instance (pretty in dev)
  errors.ts     # typed HTTP error helpers
  server.ts     # Fastify bootstrap
  routes/       # REST handlers (health, pools, transactions, positions, experiments)
  chain/        # RPC provider + classification + address registry + V2/V3 read helpers
  experiments/  # CPMM, sandwich, IL, attribution math (mirrors frontend algorithms)
  ws/           # WebSocket topic hub + batcher (mempool_tx, liquidation_event, amm_sync)
tests/
  setup.ts                # vitest globals
  helpers/                # buildTestApp, stubProvider
  chain/, routes/, experiments/, ws/, integration/
```

## REST API

Base path: `/api/v1`. All responses are JSON; bigints are encoded as decimal
strings per spec §7. Errors use a uniform envelope:

```json
{ "error": { "code": "string", "message": "string", "details"?: {...} } }
```

| Method | Path | Description |
|---|---|---|
| `GET`  | `/health`              | Liveness probe |
| `GET`  | `/pools`               | Curated 3-pool snapshot (V2 + V3 reserves / slot0) |
| `GET`  | `/transactions`        | Recent on-chain txs (params: `blocks`, `limit`, `addresses`) |
| `GET`  | `/lending-positions`   | Curated Aave V3 borrower positions |
| `GET`  | `/lp-positions`        | Curated V3 NFT LP positions |
| `GET`  | `/experiments`         | Experiment preset catalog |
| `GET`  | `/experiments/:id`     | Single preset (404 on miss) |
| `POST` | `/experiments/sandwich`    | Run sandwich simulation |
| `POST` | `/experiments/il`          | Run IL calculation |
| `POST` | `/experiments/attribution` | Run profit attribution |

## WebSocket

Path: `/ws`. Subscribe by sending `{ "type": "subscribe", "topic": "..." }`
where topic is one of `mempool_tx`, `liquidation_event`, `amm_sync`. Messages
are batched and sent as JSON frames; see the design spec for the envelope.
