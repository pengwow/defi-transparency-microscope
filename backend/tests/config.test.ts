/**
 * Config tests — focused on the CORS allow-list resolution and the
 * `CORS_ORIGINS` env var parsing.
 *
 * The rest of the env-var readers are exercised indirectly by the
 * `loadConfig` integration test (it would require a heavy mock of
 * `process.env` for marginal value), so this file sticks to the
 * behaviour that is new in this PR.
 */
import { describe, expect, it } from 'vitest';

import { loadConfig, __TEST_DEFAULT_CORS_ORIGINS } from '../src/config.js';

const ENV_BASE: NodeJS.ProcessEnv = {
  // Set the other readers to deterministic values; we only care
  // about the CORS plumbing in this file.
  RPC_URL: 'http://example.invalid',
  CHAIN_ID: '1',
  LOG_LEVEL: 'silent',
  PORT: '8000',
  CACHE_TTL_MS: '1000',
  LIQUIDATION_POLL_MS: '1000',
  LIQUIDATION_LOOKBACK: '10',
  AMM_SYNC_POLL_MS: '1000',
  AMM_SYNC_LOOKBACK: '10',
  AMM_SYNC_DEBOUNCE_MS: '50',
};

describe('loadConfig — CORS', () => {
  it('defaults to the dev loopback list when CORS_ORIGINS is unset', () => {
    const cfg = loadConfig({ ...ENV_BASE });
    expect(cfg.corsAllowAll).toBe(false);
    expect(cfg.corsOrigins).toEqual(__TEST_DEFAULT_CORS_ORIGINS);
    expect(cfg.corsOrigins).toContain('http://localhost:5173');
    expect(cfg.corsOrigins).toContain('http://127.0.0.1:5173');
  });

  it('treats an empty CORS_ORIGINS as the dev defaults', () => {
    const cfg = loadConfig({ ...ENV_BASE, CORS_ORIGINS: '' });
    expect(cfg.corsAllowAll).toBe(false);
    expect(cfg.corsOrigins).toEqual(__TEST_DEFAULT_CORS_ORIGINS);
  });

  it('treats the literal "*" as allow-all', () => {
    const cfg = loadConfig({ ...ENV_BASE, CORS_ORIGINS: '*' });
    expect(cfg.corsAllowAll).toBe(true);
    expect(cfg.corsOrigins).toEqual(['*']);
  });

  it('parses a comma-separated allow-list verbatim (trimmed, deduped)', () => {
    const cfg = loadConfig({
      ...ENV_BASE,
      CORS_ORIGINS: 'https://a.example, https://b.example,https://a.example,  ',
    });
    expect(cfg.corsAllowAll).toBe(false);
    expect(cfg.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
  });

  it('drops entries that are empty after trimming', () => {
    const cfg = loadConfig({
      ...ENV_BASE,
      CORS_ORIGINS: ',,,https://a.example,,',
    });
    expect(cfg.corsOrigins).toEqual(['https://a.example']);
  });
});
