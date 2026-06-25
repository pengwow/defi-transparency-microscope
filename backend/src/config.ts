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
}

const DEFAULT_RPC_URLS = [
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  // Build a temporary processEnv-like object so that subsequent reads see overrides.
  const merged: NodeJS.ProcessEnv = { ...env };

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
  };
}

/** Built-in fallback list (used by chain/provider.ts in M2). */
export const DEFAULT_RPC_FALLBACKS = DEFAULT_RPC_URLS.slice();
