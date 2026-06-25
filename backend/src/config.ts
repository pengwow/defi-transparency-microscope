import 'dotenv/config';

export interface Config {
  rpcUrl: string;
  rpcWsUrl: string | null;
  port: number;
  chainId: number;
  logLevel: string;
  cacheTtlMs: number;
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
  };
}

/** Built-in fallback list (used by chain/provider.ts in M2). */
export const DEFAULT_RPC_FALLBACKS = DEFAULT_RPC_URLS.slice();
