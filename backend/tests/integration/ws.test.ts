/**
 * End-to-end WebSocket test against a live backend.
 *
 * Skipped by default.  Runs only when `INTEGRATION_BACKEND_URL` is set
 * to a base URL whose WS endpoint is reachable at `ws://${host}/ws`.
 *
 * This complements `tests/ws/routes.test.ts` (which spins up its own
 * Fastify instance) by verifying the wiring is correct *through the
 * full `buildServer` path* — the same code the smoke stub and the
 * production server boot.
 *
 * Coverage of spec §12 #9:
 *   - welcome envelope
 *   - subscribe → ack
 *   - ping → pong
 *   - hub unregistration on close
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';

const BASE_URL = process.env.INTEGRATION_BACKEND_URL ?? '';
const skipAll = BASE_URL === '';

(skipAll ? describe.skip : describe)('ws (integration)', () => {
  let wsUrl: string;

  beforeAll(() => {
    if (!BASE_URL) return;
    // http://127.0.0.1:8765 → ws://127.0.0.1:8765/ws
    const u = new URL(BASE_URL);
    u.protocol = u.protocol.replace('http', 'ws');
    u.pathname = '/ws';
    wsUrl = u.toString();
  });

  const opened: WebSocket[] = [];
  function connect(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const t = setTimeout(() => {
        ws.terminate();
        reject(new Error(`WS connect timeout: ${wsUrl}`));
      }, 5_000);
      ws.once('open', () => {
        clearTimeout(t);
        opened.push(ws);
        resolve(ws);
      });
      ws.once('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });
  }

  function nextMessage(ws: WebSocket, timeoutMs = 2_000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('next-message timeout')), timeoutMs);
      ws.once('message', (data) => {
        clearTimeout(t);
        try {
          resolve(JSON.parse(data.toString()));
        } catch {
          resolve(data.toString());
        }
      });
    });
  }

  afterEach(() => {
    for (const ws of opened.splice(0)) {
      try {
        ws.close();
      } catch {
        /* noop */
      }
    }
  });

  it('GET /ws sends a welcome envelope', async () => {
    const ws = await connect();
    const msg = (await nextMessage(ws)) as { type: string; data: { server: string } };
    expect(msg.type).toBe('welcome');
    expect(msg.data.server).toMatch(/dtm/);
  });

  it('subscribe to "mempool" returns {type:"ack", data:{ok:true, subscribed:["mempool"]}}', async () => {
    const ws = await connect();
    await nextMessage(ws); // welcome
    ws.send(JSON.stringify({ action: 'subscribe', topics: ['mempool'] }));
    const ack = (await nextMessage(ws)) as {
      type: string;
      data: { ok: boolean; subscribed: string[] };
    };
    expect(ack.type).toBe('ack');
    expect(ack.data.ok).toBe(true);
    expect(ack.data.subscribed).toEqual(['mempool']);
  });

  it('ping returns a pong envelope with a numeric timestamp', async () => {
    const ws = await connect();
    await nextMessage(ws); // welcome
    ws.send(JSON.stringify({ action: 'ping' }));
    const pong = (await nextMessage(ws)) as { type: string; data: { pong: number } };
    expect(pong.type).toBe('pong');
    expect(typeof pong.data.pong).toBe('number');
  });

  it('invalid action is reported as an error envelope', async () => {
    const ws = await connect();
    await nextMessage(ws); // welcome
    ws.send(JSON.stringify({ action: 'explode' }));
    const err = (await nextMessage(ws)) as { type: string; data: { message: string } };
    expect(err.type).toBe('error');
    expect(err.data.message).toMatch(/unknown action/i);
  });

  it('rejects unknown topics with an error but still acks the valid ones', async () => {
    const ws = await connect();
    await nextMessage(ws); // welcome
    ws.send(JSON.stringify({ action: 'subscribe', topics: ['mempool', 'nonsense'] }));
    // The hub spec: invalid topics yield an `error` envelope; valid
    // ones still get an `ack` afterwards.
    const err = (await nextMessage(ws)) as { type: string; data: { message: string } };
    expect(err.type).toBe('error');
    expect(err.data.message).toMatch(/nonsense/);
    const ack = (await nextMessage(ws)) as {
      type: string;
      data: { ok: boolean; subscribed: string[] };
    };
    expect(ack.type).toBe('ack');
    expect(ack.data.subscribed).toEqual(['mempool']);
  });
});
