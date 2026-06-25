/**
 * Fastify WebSocket route — `GET /ws`.
 *
 * Spec §8.2/§8.3: the client-facing endpoint for the realtime
 * protocol. The route:
 *   - upgrades the HTTP request to a WebSocket
 *   - registers the new socket with the WSHub
 *   - sends a `{type: 'welcome'}` envelope on open
 *   - parses incoming JSON messages of the form
 *     `{action: 'subscribe'|'unsubscribe'|'ping', topics?: string[]}`
 *     and applies the action
 *   - acks with `{type: 'ack'|'pong'|'error', data: ...}`
 *   - unregisters the socket on close
 *
 * The route is intentionally thin — all broadcast / heartbeat logic
 * lives in `WSHub`. The route is the per-socket I/O shim.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { WebSocket } from 'ws';

import { type WSHub } from './hub.js';
import { WSTopic, isValidTopic } from './topics.js';

export interface WSRoutesOptions {
  hub: WSHub;
}

const ALLOWED_ACTIONS = new Set(['subscribe', 'unsubscribe', 'ping']);

function sendError(socket: WebSocket, message: string): void {
  const err = { type: 'error', data: { message } };
  socket.send(JSON.stringify(err));
}

function sendAck(
  socket: WebSocket,
  ok: boolean,
  subscribed: WSTopic[] | string[] = [],
): void {
  const ack = { type: 'ack', data: { ok, subscribed } };
  socket.send(JSON.stringify(ack));
}

function sendPong(socket: WebSocket): void {
  const pong = { type: 'pong', data: { pong: Date.now() } };
  socket.send(JSON.stringify(pong));
}

function sendWelcome(socket: WebSocket): void {
  // Welcome envelope — same shape as the data plane but typed
  // distinctly as a control message. Uses a literal `type: 'welcome'`
  // so subscribers can branch on it without it being conflated with
  // the spec-defined `WSMessage` types.
  const payload = {
    type: 'welcome',
    data: { server: 'dtm-backend', version: '1.0.0' },
  };
  socket.send(JSON.stringify(payload));
}

/**
 * Register the WS route. Plugin form (FastifyPluginAsync) so it
 * composes inside an enclosing `app.register(...)` call without
 * polluting the parent's namespace.
 */
export const wsRoutes: FastifyPluginAsync<WSRoutesOptions> = async (
  app: FastifyInstance,
  opts: WSRoutesOptions,
) => {
  const { hub } = opts;

  app.get('/ws', { websocket: true }, (socket: WebSocket) => {
    hub.register(socket as never);
    sendWelcome(socket);

    socket.on('message', (raw: Buffer | string) => {
      let payload: unknown;
      try {
        payload = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
      } catch {
        sendError(socket, 'malformed JSON');
        return;
      }
      if (!payload || typeof payload !== 'object') {
        sendError(socket, 'expected JSON object');
        return;
      }
      const { action, topics } = payload as {
        action?: unknown;
        topics?: unknown;
      };
      if (typeof action !== 'string' || !ALLOWED_ACTIONS.has(action)) {
        sendError(socket, `unknown action: ${String(action)}`);
        return;
      }

      if (action === 'ping') {
        hub.markAlive(socket as never);
        sendPong(socket);
        return;
      }

      // subscribe / unsubscribe — both expect `topics: string[]`
      if (!Array.isArray(topics) || topics.some((t) => typeof t !== 'string')) {
        sendError(socket, 'topics must be a string array');
        return;
      }
      const validated = (topics as string[]).filter(isValidTopic);
      const rejected = (topics as string[]).filter((t) => !isValidTopic(t));

      const current = hub.getSubscribers(socket as never);
      let next: WSTopic[];
      if (action === 'subscribe') {
        next = Array.from(new Set<WSTopic>([...current, ...(validated as WSTopic[])]));
      } else {
        // unsubscribe
        const dropSet = new Set<string>(validated);
        next = Array.from(current).filter((t) => !dropSet.has(t));
      }
      hub.subscribe(socket as never, next);
      // Mark the socket alive on any valid action
      hub.markAlive(socket as never);
      if (rejected.length > 0) {
        sendError(
          socket,
          `ignored unknown topics: ${rejected.join(', ')}`,
        );
      }
      sendAck(socket, true, next);
    });

    socket.on('pong', () => hub.markAlive(socket as never));

    socket.on('close', () => {
      hub.unregister(socket as never);
    });

    socket.on('error', () => {
      hub.unregister(socket as never);
    });
  });
};
