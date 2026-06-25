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
  hooks/         # Custom hooks
  pages/         # Route pages
  services/      # DataAPI implementations
    api.ts          # DataAPI contract (the 9 methods the UI consumes)
    mockApi.ts      # In-browser mock (default backend)
    httpApi.ts      # fetch-based implementation against the dtm-backend
    index.ts        # `currentAPI` — picks MockAPI or HttpAPI from env
  state/         # App state
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

## Pointing the UI at the real backend

By default the UI talks to its in-browser `MockAPI` (no network).  To
run it against the real `dtm-backend` REST service, set two env vars
(see `frontend/.env.example`):

```bash
# frontend/.env.local
VITE_USE_BACKEND=true
VITE_BACKEND_URL=http://localhost:8000
```

Restart `pnpm dev` (or rebuild) — the `currentAPI` singleton in
`@/services` resolves to `HttpAPI` when `VITE_USE_BACKEND === 'true'`
and to `MockAPI` otherwise.  Both implementations satisfy the same
`DataAPI` interface, so no other code needs to change.

`HttpAPI` rehydrates the backend's decimal-string bigints back into
native `bigint` and translates response shapes (e.g. backend's
`Pool.id` → UI's `Pool.address`, backend's `Transaction.gasLimit` →
UI's `Transaction.gasUsed`) so the rest of the UI code is unaware
which backend it's talking to.

When `VITE_USE_BACKEND=true` and the backend is unreachable, requests
fail with `HttpApiError` carrying the HTTP status and the server's
`error` code.
