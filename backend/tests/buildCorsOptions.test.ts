/**
 * Tests for `buildCorsOptions` — the resolver that turns a `Config`
 * + optional overrides into the options block fed to
 * `@fastify/cors`.
 */
import { describe, expect, it } from 'vitest';

import { buildCorsOptions } from '../src/server.js';
import type { Config } from '../src/config.js';

function makeConfig(over: Partial<Config> = {}): Config {
  return {
    rpcUrl: 'http://example.invalid',
    rpcWsUrl: null,
    port: 8000,
    chainId: 1,
    logLevel: 'silent',
    cacheTtlMs: 0,
    liquidationPollMs: 1000,
    liquidationLookback: 10,
    ammSyncPollMs: 1000,
    ammSyncLookback: 10,
    ammSyncDebounceMs: 50,
    corsOrigins: ['http://localhost:5173'],
    corsAllowAll: false,
    ...over,
  };
}

describe('buildCorsOptions', () => {
  it('passes through "*" when allowAll is true', () => {
    const cfg = makeConfig({ corsAllowAll: true, corsOrigins: ['*'] });
    const opts = buildCorsOptions(cfg);
    expect(opts.origin).toBe('*');
    expect(opts.credentials).toBe(false);
    expect(opts.methods).toEqual(expect.arrayContaining(['GET', 'POST', 'OPTIONS']));
  });

  it('uses the config allow-list when allowAll is false', () => {
    const cfg = makeConfig({
      corsAllowAll: false,
      corsOrigins: ['https://a.example', 'https://b.example'],
    });
    const opts = buildCorsOptions(cfg);
    expect(opts.origin).toEqual(['https://a.example', 'https://b.example']);
    expect(opts.credentials).toBe(false);
  });

  it('honours originsOverride (used by tests)', () => {
    const cfg = makeConfig({
      corsAllowAll: false,
      corsOrigins: ['https://prod.example'],
    });
    const opts = buildCorsOptions(cfg, ['*']);
    expect(opts.origin).toBe('*');
  });

  it('honours allowAllOverride flipping false → true', () => {
    const cfg = makeConfig({ corsAllowAll: false, corsOrigins: ['https://a.example'] });
    const opts = buildCorsOptions(cfg, undefined, true);
    expect(opts.origin).toBe('*');
  });
});
