# DTM Backend Service — Design Spec

> Companion to the existing frontend spec (`2026-06-25-dtm-mvp-frontend-design.md`).
> Implements the backend layer described in `asset/design/DTM_Detailed_Design.html` §6.

## 1. Overview

The DTM (DeFi Transparency Microscope) backend is a Node.js + TypeScript service that:

- **Fetches on-chain data** from Ethereum mainnet via `ethers.js` v6
- **Implements the `DataAPI` contract** already used by the frontend (see [frontend/src/services/api.ts](file:///workspace/frontend/src/services/api.ts))
- **Pushes real-time events** over WebSocket to the live-sampling and liquidation pages
- **Runs experiment simulations** for the fork-experiment page

The frontend's `MockAPI` is the only thing that needs to change on the UI side: switch the export in `frontend/src/services/mockApi.ts` (or a new `httpApi.ts`) to point at `http://localhost:8000`.

### 1.1 Goals

| Goal | Success Criterion |
|---|---|
| Drop-in HTTP replacement for `MockAPI` | All 9 `DataAPI` methods return data with the same shape as the mocks |
| Live mempool + liquidation event stream | WebSocket clients receive `mempool_tx`, `liquidation_event`, `amm_sync` messages within 5s of chain activity |
| Reasonable mainnet coverage | At least 3 pools (V2 ETH/USDC, V3 ETH/USDC, V3 ETH/USDT) and 8 lending + 8 LP positions are queryable |
| Production-shape code | 70%+ test coverage on `chain/`, all endpoints have at least one integration test |

### 1.2 Non-Goals (v1)

- Anvil fork experiment slices (the design doc describes this; deferred to v2)
- IPFS / report publication
- Authentication (no JWT in v1 — single-user local dev)
- Multi-chain support (mainnet only)
- Historical indexing (we query the last N blocks on demand, no Postgres)

## 2. Tech Stack

| Component | Choice | Rationale |
|---|---|---|
| Language | TypeScript 5.5+ | Share types with frontend via JSDoc-style imports |
| Runtime | Node.js 20 LTS | ethers v6 + `ws` mature support |
| HTTP framework | Fastify 4 | Fast, native JSON-schema validation, Zod-friendly |
| WebSocket | `ws` 8 via `@fastify/websocket` | Fastify-native |
| Chain | ethers.js v6 | Modern, typed, ubiquitous |
| Validation | Zod 3 | Same as frontend |
| Tests | Vitest + Supertest | Reuse Vitest config from frontend |
| Logging | `pino` (Fastify default) | Zero-config structured JSON logs |
| Config | `dotenv` + custom parser | Standard |

## 3. Architecture

```
backend/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── README.md
├── src/
│   ├── server.ts              # Fastify bootstrap + lifecycle
│   ├── config.ts              # env → typed config object
│   ├── logger.ts              # pino instance
│   ├── chain/
│   │   ├── provider.ts        # ethers JsonRpcProvider + WebSocketProvider
│   │   ├── abis.ts            # minimal ABIs (Uniswap V2/V3, Aave V3, ERC20, ERC721)
│   │   ├── addresses.ts       # mainnet contract addresses (curated)
│   │   ├── pools.ts           # listPools() — Uniswap V2/V3 reserves + metadata
│   │   ├── transactions.ts    # listTransactions() — recent block log scan
│   │   ├── mempool.ts         # mempool_tx event source (WS or HTTP poll)
│   │   ├── lending.ts         # listLendingPositions() — Aave V3 reads
│   │   ├── lp.ts              # listLpPositions() — Uniswap V3 NFT enumeration
│   │   └── classify.ts        # heuristic: log → TxType ('sandwich' | 'arb' | …)
│   ├── ws/
│   │   ├── hub.ts             # WebSocket connection registry
│   │   ├── topics.ts          # topic enum + filter helper
│   │   └── broadcaster.ts     # debounced fan-out from chain events
│   ├── experiments/
│   │   ├── sandwich.ts        # runSandwichExperiment() — eth_call simulation
│   │   ├── il.ts              # runIlExperiment() — pure math
│   │   └── attribution.ts     # runAttributionExperiment() — pure math
│   ├── routes/
│   │   ├── health.ts          # GET /api/v1/health
│   │   ├── pools.ts           # GET /api/v1/pools
│   │   ├── transactions.ts    # GET /api/v1/transactions
│   │   ├── positions.ts       # GET /api/v1/lending-positions, /api/v1/lp-positions
│   │   └── experiments.ts     # GET/POST experiment endpoints
│   ├── types.ts               # re-exports from @/types (JSDoc) — kept in sync manually
│   └── errors.ts              # typed HTTP error mapper
└── tests/
    ├── setup.ts               # global vitest setup + mock provider
    ├── helpers/mockProvider.ts# in-memory ethers provider for tests
    ├── chain/
    │   ├── pools.test.ts
    │   ├── lending.test.ts
    │   ├── lp.test.ts
    │   ├── transactions.test.ts
    │   └── classify.test.ts
    ├── experiments/
    │   ├── sandwich.test.ts
    │   ├── il.test.ts
    │   └── attribution.test.ts
    ├── ws/
    │   └── hub.test.ts
    └── routes/
        └── api.test.ts        # Fastify inject() end-to-end
```

### 3.1 Data Flow

```
RPC node  ──► ethers Provider  ──► chain/*.ts (typed wrappers)
                                       │
                                       ├─► REST routes ──► HTTP response
                                       │
                                       └─► broadcaster ──► WS hub ──► clients
```

### 3.2 Layer Boundaries

| Layer | Inputs | Outputs | Forbidden |
|---|---|---|---|
| `chain/*` | ethers provider, addresses, ABIs | typed domain objects | HTTP, Fastify, Zod |
| `experiments/*` | input configs, chain read access | `ExperimentResult` | HTTP, Fastify |
| `routes/*` | `Request`, Zod schema | `Reply` | direct ethers calls (must go through `chain/*`) |
| `ws/*` | ethers events | WS messages | HTTP, REST |

## 4. Data Model (mirrors frontend `types/`)

The backend defines the same shapes the frontend consumes. Files in `backend/src/types.ts` re-declare them as TypeScript interfaces (no runtime import — we keep the backend standalone). A CI check verifies both files stay in sync (out of scope for v1; manual).

Key types:

```ts
// Mirrors @/types/transaction.ts
export type TxType = 'normal' | 'sandwich' | 'arbitrage' | 'jit' | 'liquidation';

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gasPrice: bigint;
  gasLimit: bigint;
  input: string;
  nonce: number;
  blockNumber?: number;
  timestamp: number;
  type: TxType;
  mevProfit?: bigint;
  victimLoss?: bigint;
}

// Mirrors @/types/pool.ts
export interface Pool {
  id: string;       // address
  protocol: 'uniswap_v2' | 'uniswap_v3';
  token0: Token;
  token1: Token;
  reserve0?: bigint;   // V2 only
  reserve1?: bigint;   // V2 only
  sqrtPriceX96?: bigint; // V3 only
  feeTier?: number;    // V3 only (e.g. 3000 = 0.3%)
  liquidity?: bigint;  // V3 only
  tick?: number;       // V3 only
}

// Mirrors @/types/position.ts
export interface LendingPosition {
  id: string;
  owner: string;
  protocol: 'aave_v3';
  collateral: Record<string, bigint>; // token address → amount
  debt: Record<string, bigint>;
  liquidationThresholdE18: bigint;
  healthFactor: number;
  timestamp: number;
}

export interface LPPosition {
  id: string;          // NFT tokenId
  owner: string;
  poolId: string;      // pool address
  token0: Token;
  token1: Token;
  amount0: bigint;
  amount1: bigint;
  tickLower: number;
  tickUpper: number;
  feeTier: number;
  apr: number;
  valueUsd: number;
  feeIncomeE18: bigint;
  impermanentLossE18: bigint;
  netPnlE18: bigint;
  timestamp: number;
}
```

## 5. RPC & Provider Strategy

### 5.1 Configuration

```env
# .env
RPC_URL=https://eth.llamarpc.com            # required
RPC_WS_URL=wss://eth.llamarpc.com            # optional, falls back to HTTP polling
PORT=8000
CHAIN_ID=1                                   # mainnet
LOG_LEVEL=info
CACHE_TTL_MS=5000                            # 5s cache for repeated reads
```

### 5.2 Provider Lifecycle

- On startup: probe with `provider.getBlockNumber()`. If fails or `chainId !== 1`, exit with clear error.
- If `RPC_WS_URL` is set: create `WebSocketProvider` for mempool subscriptions.
- If not: poll `pendingTransactions` via `provider.send('eth_subscribe', …)` over HTTP every 1.5s.
- All providers wrapped in a `CachedProvider` that memoises read calls for `CACHE_TTL_MS`.

### 5.3 Public RPC Fallbacks

Built-in fallback order if `RPC_URL` is unset:
1. `https://eth.llamarpc.com` (Llama Nodes, no key)
2. `https://cloudflare-eth.com` (Cloudflare, no key)
3. `https://rpc.ankr.com/eth` (Ankr public, rate-limited)

We pick the first one that responds within 3s at startup.

## 6. Contract Addresses (Ethereum Mainnet)

| Contract | Address | Used by |
|---|---|---|
| Uniswap V2 Factory | `0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f` | `chain/pools.ts` |
| Uniswap V2 WETH/USDC | `0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc` | default V2 pool |
| Uniswap V3 Factory | `0x1F98431c8aD98523631AE4a59f267346ea31F984` | `chain/pools.ts` |
| Uniswap V3 WETH/USDC 0.3% | `0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640` | default V3 pool |
| Uniswap V3 WETH/USDT 0.3% | `0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa76` | default V3 pool |
| Uniswap V3 NonfungiblePositionManager | `0xC36442b4a4522E871399CD717DaCD8480db6b9A9` | `chain/lp.ts` |
| Aave V3 Pool | `0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2` | `chain/lending.ts` |
| Aave V3 PoolDataProvider | `0x7B4EB56E7CD4B454BA8ff71E4518426369a138a3` | `chain/lending.ts` |
| WETH | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | common base |
| USDC | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | common quote |
| USDT | `0xdAC17F958D2ee523a2206206994597C13D831ec7` | common quote |
| DAI | `0x6B175474E89094C44Da98b954EedeAC495271d0F` | common quote |
| WBTC | `0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599` | common quote |

**Hardcoded addresses, no override env** — keeps v1 simple. Document at top of `addresses.ts`.

## 7. REST API (DataAPI Mapping)

All endpoints return JSON with bigints serialized as decimal strings (via custom replacer in `server.ts`).

### 7.1 Health

```
GET /api/v1/health
→ { status: 'ok', chain: 'mainnet', blockNumber, wsConnected }
```

### 7.2 Pools

```
GET /api/v1/pools
→ Pool[]            // 3 curated pools by default
```

Implementation: pre-defined list of 3 pool addresses → multicall `getReserves()` (V2) and `slot0()` + `liquidity()` (V3) in parallel.

### 7.3 Transactions

```
GET /api/v1/transactions?blocks=10&limit=200
→ Transaction[]      // last N blocks, capped at 200
```

Implementation: `provider.getBlockNumber()` → for each block in range, fetch logs matching:
- Uniswap V2: `Swap(address,uint256,uint256,uint256,uint256,address)` topic
- Uniswap V3: `Swap(address,address,int256,int256,uint160,uint128,int24)` topic
- Aave V3: `LiquidationCall(address,address,address,uint256,uint256,address,address,uint256,uint256,uint256,uint256)` topic

Classify each log via `chain/classify.ts` (heuristic on log topics + gas price + log size).

### 7.4 Lending Positions

```
GET /api/v1/lending-positions
→ LendingPosition[]
```

Implementation: read `getReserveData()` for each reserve → compute sample user positions from a curated list of 8 high-volume Aave V3 borrowers (looked up via on-chain event scan of recent `Borrow` events). For v1 this is a fixed list refreshed every 5 minutes.

### 7.5 LP Positions

```
GET /api/v1/lp-positions
→ LPPosition[]
```

Implementation: use `NonfungiblePositionManager` `balanceOf` for a curated list of 8 active V3 LP addresses → `tokenOfOwnerByIndex` → `positions(tokenId)` for each. Refresh every 5 minutes.

### 7.6 Experiments

```
GET    /api/v1/experiments
→ ExperimentPreset[]           // 4 in-memory presets

GET    /api/v1/experiments/:id
→ ExperimentPreset

POST   /api/v1/experiments/sandwich
body  { scenario: SandwichScenario }
→     ExperimentResult         // eth_call simulation of 3 swaps

POST   /api/v1/experiments/il
body  { reserve0, reserve1, priceRatio }
→     ExperimentResult         // pure math

POST   /api/v1/experiments/attribution
body  { reserve0, reserve1, amountIn, fee }
→     ExperimentResult         // pure math
```

Zod validates all inputs; 400 on schema failure.

## 8. WebSocket Protocol

### 8.1 Endpoint

```
ws://localhost:8000/ws
```

### 8.2 Subscribe

```json
// client → server
{ "action": "subscribe", "topics": ["mempool", "liquidations", "amm_sync"] }

// server → client (ack)
{ "type": "subscribed", "topics": ["mempool", "liquidations", "amm_sync"] }
```

### 8.3 Messages

```jsonc
// server → client
{ "type": "mempool_tx", "data": { hash, from, to, value, gasPrice, input, type, timestamp } }
{ "type": "liquidation_event", "data": { user, collateral, debt, hf, protocol, profit, txHash, blockNumber } }
{ "type": "amm_sync", "data": { pool, reserve0, reserve1, price, blockNumber } }
{ "type": "block_confirm", "data": { number, timestamp, txCount, gasUsed } }
{ "type": "error", "data": { message } }
```

### 8.4 Heartbeat

Server sends `ping` every 30s. Client should respond with `pong` (handled by `ws` library auto). Clients silent for >60s are dropped.

### 8.5 Batching

Mempool messages are batched at 100ms windows to avoid message storms during high activity.

## 9. Key Algorithms

### 9.1 Log Classification (`chain/classify.ts`)

Pure function `classifyLog(log: Log): TxType`:
- Topic matches Aave `LiquidationCall` → `'liquidation'`
- Topic matches Uniswap V3 `Swap` AND `amount0` and `amount1` have opposite signs → `'swap'` baseline; check gas price for sandwich heuristic
- Topic matches Uniswap V2 `Swap` → similar
- Default → `'normal'`

**Heuristic for sandwich**: two consecutive `Swap` events on the same pool within the same block, from the same `from` address, sandwiching a third swap. We detect this in `transactions.ts` by pairing top-N swaps in each block.

### 9.2 Sandwich Simulation (`experiments/sandwich.ts`)

For input `SandwichScenario`:
1. `step1 = provider.estimateGas({ from: attacker, to: pool, data: swap(attackerAmountIn) })` — actually use `provider.call()` for the actual output
2. Same for `step2` (victim) and `step3` (attacker back-run)
3. Compute `attackerProfit = step3.outputWei - attackerAmountIn` (in attacker token units)
4. Compute `victimLoss = step2.expectedOutput - step2.actualOutput`
5. Return as `ExperimentResult`

If the pool is unknown, fall back to the CPMM math (`frontend/src/core/cpmm.ts` logic, re-implemented here to keep the backend self-contained).

### 9.3 IL & Attribution

Pure functions ported from `frontend/src/core/il.ts` and `attribution.ts`. We deliberately duplicate the ~50 lines of math to keep the backend dependency-free of frontend code.

## 10. Error Handling

| Scenario | HTTP | Body |
|---|---|---|
| Provider unreachable at boot | — | exit code 1, log to stderr |
| Provider drops mid-request | 502 | `{ error: 'upstream_unreachable' }` |
| Zod validation failure | 400 | `{ error: 'validation', issues: [...] }` |
| Unknown route | 404 | `{ error: 'not_found' }` |
| Unhandled internal | 500 | `{ error: 'internal', traceId }` |

All errors logged with `pino` at `error` level including stack trace.

## 11. Testing Strategy

| Layer | Tooling | Coverage target |
|---|---|---|
| `chain/*` (no network) | Vitest + custom `MockProvider` that fakes `getBlockNumber`, `getLogs`, contract calls | 80% |
| `experiments/*` | Vitest with hand-crafted inputs (math is deterministic) | 90% |
| `ws/*` | Vitest + `ws` client against test server | 70% |
| `routes/*` | Vitest + Fastify `inject()` with mock chain modules | 70% |
| End-to-end (skipped in CI) | Vitest + real RPC; gated on `RUN_E2E=1` | n/a |

`MockProvider` is the in-memory ethers provider; we register responses for specific contract addresses and selectors. Helpers in `tests/helpers/mockProvider.ts`.

## 12. Acceptance Criteria

1. `pnpm install && pnpm build` succeeds with no errors.
2. `pnpm test` runs all unit + integration tests; coverage report shows `chain/*` ≥ 80%, `experiments/*` ≥ 90%, `routes/*` ≥ 70%.
3. `pnpm dev` starts the server on `:8000` and probes the RPC successfully.
4. `curl http://localhost:8000/api/v1/health` returns 200 with chainId 1 and a non-null `blockNumber`.
5. `curl http://localhost:8000/api/v1/pools` returns ≥ 3 pools (V2 + V3 ETH/USDC, V3 ETH/USDT).
6. `curl 'http://localhost:8000/api/v1/transactions?blocks=5&limit=50'` returns ≥ 1 transaction.
7. `curl http://localhost:8000/api/v1/lending-positions` returns ≥ 4 positions.
8. `curl http://localhost:8000/api/v1/lp-positions` returns ≥ 4 positions.
9. `wscat -c ws://localhost:8000/ws` followed by `{"action":"subscribe","topics":["mempool"]}` receives `subscribed` ack.
10. `curl -X POST http://localhost:8000/api/v1/experiments/il -H 'Content-Type: application/json' -d '{"reserve0":"1000000000000000000","reserve1":"3000000000000","priceRatio":2}'` returns IL ≈ -0.057.
11. `pnpm lint` passes (ESLint 8 with `@typescript-eslint`).
12. The frontend's `MockAPI` can be swapped to an `HttpAPI` (new file in `frontend/src/services/httpApi.ts`) by toggling one import; all 6 pages still render.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Public RPC rate-limiting (429) | Built-in fallback chain + 5s read cache + token-bucket per provider |
| Public RPC mempool WS unreliable | Auto-fallback to HTTP polling every 1.5s if WS disconnects > 3 times |
| Aave `getReserveData` returns unexpected shape on a future fork | Pin to block `0x...` snapshot for testing; runtime guards on numeric types |
| Frontend type drift | Mirror types in `backend/src/types.ts`; explicit "keep in sync" header in both files |
| `bigint` JSON serialization gotchas | Centralised `replacer` in `server.ts`; integration test verifies large numbers round-trip |
| Scope creep (Anvil, IPFS, auth) | Explicit non-goals §1.2; v2 plan to add later |

## 14. Milestones (rough ordering)

1. **M1: Scaffold + Health** — package.json, server boot, `/health` endpoint, RPC probe.
2. **M2: Chain layer** — provider wrapper, addresses, ABIs, MockProvider, log classification.
3. **M3: Pool + Transaction endpoints** — `/pools`, `/transactions` with tests.
4. **M4: Position endpoints** — `/lending-positions`, `/lp-positions` with tests.
5. **M5: Experiments** — `/experiments/*` pure-math endpoints with tests.
6. **M6: WebSocket** — hub, broadcaster, classify-driven mempool stream.
7. **M7: Frontend wiring** — add `HttpAPI` in frontend, env switch, smoke test against backend.
8. **M8: Polish** — pino logs, .env.example, README, e2e harness (skippable).

## 15. Out-of-scope hooks for v2

- Anvil fork endpoints (`/fork/*`) — requires local Anvil binary
- IPFS report publishing
- JWT auth + rate limiting
- Postgres-backed historical index
- Multi-chain (Base, Arbitrum)
