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
  routes/
    health.ts   # GET /api/v1/health
tests/
  setup.ts               # vitest globals
  routes/health.test.ts  # health endpoint tests
```

More modules (`chain/`, `ws/`, `experiments/`) land in subsequent milestones.
