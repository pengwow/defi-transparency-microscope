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
  config.ts             # env → typed config
  logger.ts             # pino instance (pretty in dev)
  errors.ts             # typed HTTP error helpers
  server.ts             # Fastify bootstrap
  chain/                # on-chain data layer (pools / txs / lending / LP)
  experiments/          # sandwich / IL / attribution pure-math engines
  routes/
    health.ts           # GET  /api/v1/health
    pools.ts            # GET  /api/v1/pools
    transactions.ts     # GET  /api/v1/transactions
    positions.ts        # GET  /api/v1/lending-positions, /api/v1/lp-positions
    experiments.ts      # GET/POST /api/v1/experiments*
  ws/                   # WebSocket hub + mempool/AMM/liquidation watchers
tests/
  setup.ts                  # vitest globals
  helpers/                  # buildTestApp, stubProvider
  routes/                   # per-route unit tests
  chain/                    # chain-layer unit tests
  experiments/              # experiment engine unit tests
  ws/                       # WebSocket hub tests
  integration/
    smoke.test.ts           # end-to-end smoke test over all 9 DataAPI endpoints
```

## REST API

The backend exposes 9 DataAPI methods + 1 liveness probe (see
`docs/superpowers/specs/2026-06-25-dtm-backend-design.md` §7 for the
full contract).  All routes are mounted under `/api/v1`.

Bigints are serialised as decimal strings on the wire to preserve
precision; the frontend's `HttpAPI` rehydrates them to native `bigint`
on the way out.

### `GET /api/v1/health`

```bash
curl -s http://localhost:8000/api/v1/health
# { "status": "ok", "chain": "mainnet", "blockNumber": 19500000, "wsConnected": false }
```

### `GET /api/v1/pools`

```bash
curl -s http://localhost:8000/api/v1/pools | jq '.[0]'
# {
#   "id": "0xB4e16d0168e52d35CaCD2C6185b44281Ec28C9Dc",
#   "protocol": "uniswap_v2",
#   "token0": { "address": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", "symbol": "WETH", ... },
#   "token1": { "address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "symbol": "USDC", ... },
#   "reserve0": "100000000000000000000000",
#   "reserve1": "160000000000000",
#   "feeTier": 3000
# }
```

### `GET /api/v1/transactions`

```bash
curl -s 'http://localhost:8000/api/v1/transactions?blocks=10&limit=100' | jq '.[0]'
# {
#   "hash": "0x...",
#   "from": "0x...",
#   "to": "0x...",
#   "value": "0",
#   "gasPrice": "50000000000",
#   "gasLimit": "200000",
#   "blockNumber": 19499999,
#   "timestamp": 1700000000,
#   "type": "normal"   // normal | sandwich | arbitrage | jit | liquidation
# }
```

### `GET /api/v1/lending-positions`

```bash
curl -s http://localhost:8000/api/v1/lending-positions | jq '.[0]'
# {
#   "id": "aave-v3:0x...",
#   "owner": "0x...",
#   "protocol": "aave_v3",
#   "collateral": { "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "1000000000000000000" },
#   "debt":       { "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "500000000" },
#   "liquidationThresholdE18": "825000000000000000",
#   "healthFactor": 1.72,
#   "timestamp": 1700000000
# }
```

### `GET /api/v1/lp-positions`

```bash
curl -s http://localhost:8000/api/v1/lp-positions | jq '.[0]'
# {
#   "id": "1",
#   "owner": "0x...",
#   "poolId": "0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640",
#   "token0": { ... }, "token1": { ... },
#   "amount0": "1000000",
#   "amount1": "500000000000000000",
#   "tickLower": 199000, "tickUpper": 201000,
#   "feeTier": 3000, "apr": 0.124, "valueUsd": 49000,
#   "feeIncomeE18": "...",
#   "impermanentLossE18": "...",
#   "netPnlE18": "...",
#   "timestamp": 1700000000
# }
```

### `GET /api/v1/experiments`

```bash
curl -s http://localhost:8000/api/v1/experiments | jq 'length'
# 4
```

### `GET /api/v1/experiments/:id`

```bash
curl -s http://localhost:8000/api/v1/experiments/il-eth-usdc | jq
# { "id": "il-eth-usdc", "name": "IL: ETH/USDC", "description": "...", "config": { ... } }
```

### `POST /api/v1/experiments/sandwich`

```bash
curl -s -X POST http://localhost:8000/api/v1/experiments/sandwich \
  -H 'content-type: application/json' \
  -d '{
    "scenario": {
      "reserve0":         "80000000000000000000000",
      "reserve1":         "160000000000000000000000000",
      "victimAmountIn":   "400000000000000000000",
      "attackerAmountIn": "800000000000000000000",
      "fee": 3000
    }
  }' | jq '.result | { attackerProfit, victimLoss, netProfit }'
# { "attackerProfit": "...", "victimLoss": "...", "netProfit": "..." }
```

### `POST /api/v1/experiments/il`

```bash
curl -s -X POST http://localhost:8000/api/v1/experiments/il \
  -H 'content-type: application/json' \
  -d '{
    "reserve0":   "80000000000000000000000",
    "reserve1":   "160000000000000000000000000",
    "priceRatio": 2
  }' | jq '.result | { il, variant }'
# { "il": -0.0572, "variant": "v2" }
```

### `POST /api/v1/experiments/attribution`

```bash
curl -s -X POST http://localhost:8000/api/v1/experiments/attribution \
  -H 'content-type: application/json' \
  -d '{
    "reserve0": "80000000000000000000000",
    "reserve1": "160000000000000000000000000",
    "amountIn": "10000000000000000000",
    "fee":      3000
  }' | jq '.result | { priceImpact, fees, gasCost, rebates, netPnl }'
# { "priceImpact": "...", "fees": "...", "gasCost": "...", "rebates": "0", "netPnl": "..." }
```
