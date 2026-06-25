# DTM Frontend (MVP)

DeFi Transparency Microscope — MVP frontend for analyzing DeFi transactions, pools, and positions.

## Stack

- React 18 + TypeScript
- Vite
- Vitest + jsdom
- ESLint + Prettier

## Scripts

```bash
pnpm install         # install dependencies
pnpm dev             # start dev server
pnpm test            # run unit tests (excludes integration tests)
pnpm test:integration  # run HttpAPI integration suite against a live backend
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint
pnpm build           # production build
```

## Project layout

```
src/
  algorithms/    # Core math (CPMM, sandwich, IL, HF, attribution)
  components/    # React components
  canvas/        # Canvas-based visualisations
  mocks/         # In-memory data generators
  pages/         # Route pages
  services/      # DataAPI implementations (mock + http + barrel)
  store/         # Zustand stores
  styles/        # Global CSS
  types/         # Type definitions
  utils/         # Helpers
tests/           # Vitest setup
```

## Algorithm references

- CPMM constant-product (x*y=k)
- Sandwich attack model
- Impermanent Loss (V2 + V3)
- Health Factor (Aave-style)
- Profit attribution

## Backend integration

The data layer is the `DataAPI` interface in `src/services/api.ts`. Two
implementations live side-by-side:

- `MockAPI` (`src/services/mockApi.ts`) — pure in-memory, deterministic, used by
  default. Drives the demo / test rigs.
- `HttpAPI` (`src/services/httpApi.ts`) — talks to the Fastify backend at
  `/api/v1/*` and rehydrates the bigint-as-decimal-string convention.

The `src/services/index.ts` barrel exports `currentAPI`, selected at module
load time via Vite env vars:

| Var                  | Default                    | Effect |
|----------------------|----------------------------|--------|
| `VITE_USE_BACKEND`   | unset / `false`            | `true` ⇒ `HttpAPI`, otherwise `MockAPI` |
| `VITE_BACKEND_URL`   | `http://localhost:8000`    | Backend origin (no `/api/v1` suffix) |

Copy `frontend/.env.example` to `frontend/.env.local` and set
`VITE_USE_BACKEND=true` to run against a live backend; see
[`backend/README.md`](./backend/README.md) for the server side.

### End-to-end against a live backend

```bash
# Terminal 1 — stub backend (no mainnet RPC needed; works offline)
cd backend && pnpm e2e:server         # listens on http://127.0.0.1:8765

# Terminal 2 — frontend integration suite
cd frontend
INTEGRATION_BACKEND_URL=http://127.0.0.1:8765 pnpm test:integration
```

The integration suite (10 tests) talks to a real HTTP server, exercising
every endpoint of the `DataAPI` contract end-to-end: route layer,
bigint-as-decimal-string serialisation, and the `HttpAPI` rehydration /
field-mapping logic. It is excluded from `pnpm test` so the default
unit-test run stays fast and offline-only.

To point the dev server at the same backend, add to `frontend/.env.local`:

```
VITE_USE_BACKEND=true
VITE_BACKEND_URL=http://127.0.0.1:8765
```
