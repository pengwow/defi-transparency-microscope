# DTM Frontend (MVP)

DeFi Transparency Microscope — MVP frontend for analyzing DeFi transactions, pools, and positions.

## Stack

- React 18 + TypeScript
- Vite
- Vitest + jsdom
- ESLint + Prettier

## Scripts

```bash
pnpm install      # install dependencies
pnpm dev          # start dev server
pnpm test         # run tests
pnpm typecheck    # tsc --noEmit
pnpm lint         # eslint
pnpm build        # production build
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
