import { describe, it, expect, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildTestApp } from '../helpers/buildTestApp.js';

describe('GET /api/v1/health', () => {
  let app: FastifyInstance;
  let close: () => Promise<void>;

  beforeEach(async () => {
    const result = await buildTestApp({
      stub: { blockNumber: 19_500_000 },
      wsHealth: { isWebSocketConnected: () => true },
    });
    app = result.app;
    close = () => app.close();
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

  it('reflects wsConnected=false when the WS health source reports so', async () => {
    await close();
    const result = await buildTestApp({
      stub: { blockNumber: 19_500_000 },
      wsHealth: { isWebSocketConnected: () => false },
    });
    app = result.app;
    close = () => app.close();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.json().wsConnected).toBe(false);
  });

  it('returns blockNumber=0 (degraded) when the provider throws', async () => {
    await close();
    const result = await buildTestApp({
      wsHealth: { isWebSocketConnected: () => false },
    });
    result.stub.mocks.getBlockNumber.mockRejectedValueOnce(new Error('network down'));
    app = result.app;
    close = () => app.close();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().blockNumber).toBe(0);
  });

  it('uses expectedChainId from the buildServer config', async () => {
    await close();
    const result = await buildTestApp({
      chainId: 11155111, // sepolia
    });
    app = result.app;
    close = () => app.close();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.json().chain).toBe('sepolia');
  });

  it('falls back to chain-<id> for unknown chain ids', async () => {
    await close();
    const result = await buildTestApp({ chainId: 999_999 });
    app = result.app;
    close = () => app.close();

    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    expect(res.json().chain).toBe('chain:999999');
  });

  afterEach(async () => {
    await close();
  });
});

describe('404 handler', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const result = await buildTestApp();
    app = result.app;
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
