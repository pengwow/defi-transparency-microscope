/**
 * Tests for ws/routes.ts — the Fastify WebSocket route.
 *
 * Spec §8 covers the protocol. The route:
 *   - upgrades incoming GET /ws to a WebSocket
 *   - on connection: register with the hub, send a welcome message
 *   - on message: parse {action, topics?}, apply, ack
 *   - on close: unregister
 *
 * Tests use the `ws` library client against the Fastify app
 * listening on a random port. We avoid `app.injectWS` because its
 * duplex-stream shim occasionally drops the first frame that
 * arrives in the same task as the upgrade completion, which is the
 * case for the welcome message.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';

import Fastify, { type FastifyInstance } from 'fastify';
import websocket from '@fastify/websocket';

import { wsRoutes } from '../../src/ws/routes.js';
import { WSHub } from '../../src/ws/hub.js';
import { WSTopic } from '../../src/ws/topics.js';

const waitFor = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface OpenClient {
  ws: WebSocket;
  /** Resolves with the parsed JSON of the next incoming message. */
  nextMessage: () => Promise<unknown>;
}

/** Open a real WS connection to the bound port and return helpers. */
function openClient(port: number, path = '/ws'): Promise<OpenClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`);
    const queue: unknown[] = [];
    const waiters: Array<(v: unknown) => void> = [];
    ws.on('message', (data) => {
      const parsed = (() => {
        try {
          return JSON.parse(data.toString());
        } catch {
          return data.toString();
        }
      })();
      const w = waiters.shift();
      if (w) w(parsed);
      else queue.push(parsed);
    });
    ws.once('open', () => {
      resolve({
        ws,
        nextMessage: () => {
          if (queue.length > 0) return Promise.resolve(queue.shift()!);
          return new Promise((r) => waiters.push(r));
        },
      });
    });
    ws.once('error', reject);
  });
}

describe('ws routes', () => {
  let app: FastifyInstance;
  let hub: WSHub;
  let port: number;

  beforeEach(async () => {
    hub = new WSHub({ heartbeatMs: 60_000 });
    app = Fastify({ logger: false });
    await app.register(websocket);
    wsRoutes(app, { hub });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const match = address.match(/:(\d+)$/);
    if (!match) throw new Error(`could not parse listen address: ${address}`);
    port = Number(match[1]);
  });

  afterEach(async () => {
    hub.stop();
    await app.close();
  });

  it('upgrades GET /ws and sends a welcome message', async () => {
    const c = await openClient(port);
    const msg = (await c.nextMessage()) as { type: string; data: { server: string } };
    expect(msg.type).toBe('welcome');
    expect(msg.data.server).toMatch(/dtm/);
    c.ws.close();
  });

  it('registers the new socket with the hub', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    expect(hub.size).toBe(1);
    c.ws.close();
  });

  it('subscribe action updates the hub subscriptions and acks', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    c.ws.send(JSON.stringify({ action: 'subscribe', topics: [WSTopic.Mempool, WSTopic.Liquidations] }));
    const ack = (await c.nextMessage()) as { type: string; data: { ok: boolean; subscribed: string[] } };
    expect(ack.type).toBe('ack');
    expect(ack.data.ok).toBe(true);
    expect(ack.data.subscribed).toEqual([WSTopic.Mempool, WSTopic.Liquidations]);
    c.ws.close();
  });

  it('unsubscribe action drops the supplied topics and acks', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    c.ws.send(
      JSON.stringify({ action: 'subscribe', topics: [WSTopic.Mempool, WSTopic.Liquidations] }),
    );
    await c.nextMessage();
    c.ws.send(JSON.stringify({ action: 'unsubscribe', topics: [WSTopic.Mempool] }));
    const result = (await c.nextMessage()) as { type: string; data: { subscribed: string[] } };
    expect(result.data.subscribed).toEqual([WSTopic.Liquidations]);
    c.ws.close();
  });

  it('ping action replies with a pong and updates liveness', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    c.ws.send(JSON.stringify({ action: 'ping' }));
    const pong = (await c.nextMessage()) as { type: string; data: { pong: number } };
    expect(pong.type).toBe('pong');
    expect(typeof pong.data.pong).toBe('number');
    c.ws.close();
  });

  it('invalid action sends an error envelope', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    c.ws.send(JSON.stringify({ action: 'explode' }));
    const err = (await c.nextMessage()) as { type: string; data: { message: string } };
    expect(err.type).toBe('error');
    expect(err.data.message).toMatch(/unknown action/i);
    c.ws.close();
  });

  it('unregister is invoked on socket close', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    expect(hub.size).toBe(1);
    c.ws.close();
    await waitFor(50);
    expect(hub.size).toBe(0);
  });

  it('subscribed sockets receive a broadcast', async () => {
    const c = await openClient(port);
    await c.nextMessage(); // welcome
    c.ws.send(JSON.stringify({ action: 'subscribe', topics: [WSTopic.Mempool] }));
    await c.nextMessage(); // ack
    hub.broadcast(WSTopic.Mempool, {
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'aa'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        type: 'normal',
        timestamp: 0,
      },
    });
    const got = (await c.nextMessage()) as { type: string };
    expect(got.type).toBe('mempool_tx');
    c.ws.close();
  });
});
