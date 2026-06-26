import 'dotenv/config';

export interface Config {
  rpcUrl: string;
  rpcWsUrl: string | null;
  port: number;
  chainId: number;
  logLevel: string;
  cacheTtlMs: number;
  /** Poll interval for the Aave V3 liquidation watcher, in ms. */
  liquidationPollMs: number;
  /** How many trailing blocks the liquidation watcher scans per poll. */
  liquidationLookback: number;
  /** Poll interval for the AMM sync watcher, in ms. */
  ammSyncPollMs: number;
  /** How many trailing blocks the AMM sync watcher scans per poll. */
  ammSyncLookback: number;
  /** Debounce window for AMM sync emissions (per-pool coalescing), in ms. */
  ammSyncDebounceMs: number;
  /**
   * Comma-separated list of allowed CORS origins.  Special-cased:
   *   - unset / empty   → the dev defaults below
   *   - the literal "*" → any origin is allowed (echo `*` in
   *                       `Access-Control-Allow-Origin`)
   *   - otherwise       → exact-match allow-list
   */
  corsOrigins: string[];
  /** True when `corsOrigins` is the literal `*`. */
  corsAllowAll: boolean;
}

const DEFAULT_RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
];

/** Default CORS allow-list when `CORS_ORIGINS` is not set. */
const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function readString(key: string, fallback?: string): string {
  const value = process.env[key];
  if (value && value.trim().length > 0) return value.trim();
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required env var: ${key}`);
}

function readOptionalString(key: string): string | null {
  const value = process.env[key];
  if (!value || value.trim().length === 0) return null;
  return value.trim();
}

function readNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw || raw.trim().length === 0) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Env var ${key} must be a finite number, got: ${raw}`);
  }
  return parsed;
}

/**
 * Parse the `CORS_ORIGINS` env var.  Recognises:
 *   - unset / empty           → `DEFAULT_CORS_ORIGINS` (dev loopback list)
 *   - "*"                     → `['*']` (any origin)
 *   - comma-separated list    → trimmed, deduplicated, empty entries dropped
 */
function readCorsOrigins(env: NodeJS.ProcessEnv): { origins: string[]; allowAll: boolean } {
  const raw = env.CORS_ORIGINS;
  if (!raw || raw.trim().length === 0) {
    return { origins: [...DEFAULT_CORS_ORIGINS], allowAll: false };
  }
  if (raw.trim() === '*') {
    return { origins: ['*'], allowAll: true };
  }
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const dedup = Array.from(new Set(parts));
  return { origins: dedup, allowAll: false };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Build a temporary processEnv-like object so that subsequent reads see overrides.
  const merged: NodeJS.ProcessEnv = { ...env };

  const { origins: corsOrigins, allowAll: corsAllowAll } = readCorsOrigins(merged);

  return {
    rpcUrl: readString('RPC_URL', merged.RPC_URL ?? DEFAULT_RPC_URLS[0]),
    rpcWsUrl: readOptionalString('RPC_WS_URL'),
    port: readNumber('PORT', 8000),
    chainId: readNumber('CHAIN_ID', 1),
    logLevel: readString('LOG_LEVEL', 'info'),
    cacheTtlMs: readNumber('CACHE_TTL_MS', 5000),
    liquidationPollMs: readNumber('LIQUIDATION_POLL_MS', 12_000),
    liquidationLookback: readNumber('LIQUIDATION_LOOKBACK', 100),
    ammSyncPollMs: readNumber('AMM_SYNC_POLL_MS', 12_000),
    ammSyncLookback: readNumber('AMM_SYNC_LOOKBACK', 100),
    ammSyncDebounceMs: readNumber('AMM_SYNC_DEBOUNCE_MS', 250),
    corsOrigins,
    corsAllowAll,
  };
}

/** Built-in fallback list (used by chain/provider.ts in M2). */
export const DEFAULT_RPC_FALLBACKS = DEFAULT_RPC_URLS.slice();

/**
 * Exposed for tests that want to assert the dev defaults without
 * touching `process.env`.
 */
export const __TEST_DEFAULT_CORS_ORIGINS = DEFAULT_CORS_ORIGINS.slice();
