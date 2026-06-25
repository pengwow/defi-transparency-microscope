import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../../src/server.js';
import type { ChainHealthSource } from '../../src/routes/health.js';

function makeChainSource(overrides: Partial<ChainHealthSource> = {}): ChainHealthSource {
  return {
    getBlockNumber: vi.fn(async () => 19_500_000),
    isWebSocketConnected: vi.fn(() => true),
    ...overrides,
  };
}

describe('GET /api/v1/health', () => {
  let app: FastifyInstance;
  let chain: ChainHealthSource;

  beforeEach(async () => {
    chain = makeChainSource();
    app = await buildServer({
      config: {
        rpcUrl: 'https://example.invalid',
        rpcWsUrl: null,
        port: 8000,
        chainId: 1,
        logLevel: 'silent',
        cacheTtlMs: 5000,
      },
      chainSource: chain,
    });
    await app.ready();
  });

  it('returns 200 with status, chain, blockNumber, wsConnected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toEqual({
      status: 'ok',
      chain: 'mainnet',
      blockNumber: 19_500_000,
      wsConnected: true,
    });
  });

  it('reports chain name as "mainnet" for chainId 1', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.json().chain).toBe('mainnet');
  });

  it('returns blockNumber as a number', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = res.json();
    expect(typeof body.blockNumber).toBe('number');
    expect(Number.isInteger(body.blockNumber)).toBe(true);
  });

  it('returns wsConnected as a boolean', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const body = res.json();
    expect(typeof body.wsConnected).toBe('boolean');
  });

  it('reflects wsConnected=false when the chain source reports so', async () => {
    await app.close();
    chain = makeChainSource({ isWebSocketConnected: vi.fn(() => false) });
    app = await buildServer({
      config: {
        rpcUrl: 'https://example.invalid',
        rpcWsUrl: null,
        port: 8000,
        chainId: 1,
        logLevel: 'silent',
        cacheTtlMs: 5000,
      },
      chainSource: chain,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.json().wsConnected).toBe(false);
  });

  it('returns blockNumber=0 (degraded) when the provider throws', async () => {
    await app.close();
    chain = makeChainSource({
      getBlockNumber: vi.fn(async () => {
        throw new Error('network down');
      }),
    });
    app = await buildServer({
      config: {
        rpcUrl: 'https://example.invalid',
        rpcWsUrl: null,
        port: 8000,
        chainId: 1,
        logLevel: 'silent',
        cacheTtlMs: 5000,
      },
      chainSource: chain,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().blockNumber).toBe(0);
  });

  it('uses expectedChainId from the config', async () => {
    await app.close();
    chain = makeChainSource();
    app = await buildServer({
      config: {
        rpcUrl: 'https://example.invalid',
        rpcWsUrl: null,
        port: 8000,
        chainId: 11155111, // sepolia
        logLevel: 'silent',
        cacheTtlMs: 5000,
      },
      chainSource: chain,
    });
    await app.ready();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.json().chain).toBe('sepolia');
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('404 handler', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildServer({
      config: {
        rpcUrl: 'https://example.invalid',
        rpcWsUrl: null,
        port: 8000,
        chainId: 1,
        logLevel: 'silent',
        cacheTtlMs: 5000,
      },
    });
    await app.ready();
  });

  it('returns 404 with error envelope for unknown routes', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/does-not-exist' });
    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toBe('not_found');
  });

  afterEach(async () => {
    await app.close();
  });
});
