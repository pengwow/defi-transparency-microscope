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
  state/         # App state
  test/          # Test fixtures
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
