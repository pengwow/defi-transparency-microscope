/**
 * WebSocket connection registry + broadcast.
 *
 * Spec §8.4 (heartbeat) and §8.5 (batching) define the per-socket
 * lifecycle. This file owns:
 *   - the Set<HubSocket> of active subscribers
 *   - per-socket topic subscriptions (Set<WSTopic>)
 *   - topic-filtered broadcast (only delivers to subscribers)
 *   - 30 s heartbeat: pings all sockets, terminates ones silent for >2x
 *     the heartbeat interval
 *   - lightweight statistics (count, send/drop totals, per-topic counts)
 *
 * The hub is intentionally transport-agnostic: it consumes a structural
 * `HubSocket` (a `ws.WebSocket` shim) rather than coupling to the
 * `ws` package directly. That makes the hub trivially unit-testable.
 */
import { WSTopic, type WSMessage } from './topics.js';

/**
 * Minimal contract the hub needs from a connected socket.
 * The `ws` WebSocket satisfies this; tests pass a stub.
 */
export interface HubSocket {
  readyState: number;
  /** Sentinel for the OPEN readyState (mirrored from `ws`). */
  OPEN: number;
  /** Sentinel for the CLOSED readyState (mirrored from `ws`). */
  CLOSED: number;
  send(data: string): void;
  ping(): void;
  terminate(): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

export interface WSHubOptions {
  /** Heartbeat interval in milliseconds. Default 30_000 (spec §8.4). */
  heartbeatMs?: number;
  /** Test hook: override `Date.now` / `setInterval` is not used; we use a clock. */
  now?: () => number;
}

export interface WSHubStats {
  subscriberCount: number;
  messagesSent: number;
  messagesDropped: number;
  subscribersByTopic: Record<string, number>;
}

interface Subscriber {
  socket: HubSocket;
  topics: Set<WSTopic>;
  lastPong: number;
}

const DEFAULT_HEARTBEAT_MS = 30_000;

/**
 * Try to JSON.stringify a message, turning BigInt into decimal strings.
 * Mirrors the replacer used by the HTTP layer (see server.ts).
 */
function serializeMessage(message: WSMessage): string {
  return JSON.stringify(message, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

export class WSHub {
  private readonly subscribers = new Map<HubSocket, Subscriber>();
  private readonly heartbeatMs: number;
  private readonly now: () => number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private messagesSent = 0;
  private messagesDropped = 0;

  constructor(opts: WSHubOptions = {}) {
    this.heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  /** Number of currently registered sockets. */
  get size(): number {
    return this.subscribers.size;
  }

  /** Add a new socket. Idempotent for the same socket. */
  register(socket: HubSocket): void {
    if (this.subscribers.has(socket)) return;
    this.subscribers.set(socket, {
      socket,
      topics: new Set<WSTopic>(),
      lastPong: this.now(),
    });
  }

  /** Remove a socket. Idempotent. */
  unregister(socket: HubSocket): void {
    this.subscribers.delete(socket);
  }

  /**
   * Replace the socket's subscription set with `topics`. Empty array
   * unsubscribes from everything.
   */
  subscribe(socket: HubSocket, topics: WSTopic[]): void {
    const sub = this.subscribers.get(socket);
    if (!sub) return;
    sub.topics = new Set<WSTopic>(topics);
  }

  /**
   * Read-only access to a socket's subscription set. Returns an empty
   * set if the socket is unknown.
   */
  getSubscribers(socket: HubSocket): Set<WSTopic> {
    return this.subscribers.get(socket)?.topics ?? new Set<WSTopic>();
  }

  /**
   * Mark a socket as alive (pong received). Resets its silent timer
   * so the heartbeat won't terminate it.
   */
  markAlive(socket: HubSocket): void {
    const sub = this.subscribers.get(socket);
    if (sub) sub.lastPong = this.now();
  }

  /**
   * Send `message` to every subscriber whose topic set includes
   * `topic`. Counts a dropped message for every send that throws.
   */
  broadcast(topic: WSTopic, message: WSMessage): void {
    const payload = serializeMessage(message);
    for (const sub of this.subscribers.values()) {
      if (!sub.topics.has(topic)) continue;
      if (sub.socket.readyState !== sub.socket.OPEN) continue;
      try {
        sub.socket.send(payload);
        this.messagesSent += 1;
      } catch {
        this.messagesDropped += 1;
      }
    }
  }

  /** Aggregated observability. */
  getStats(): WSHubStats {
    const subscribersByTopic: Record<string, number> = {
      [WSTopic.Mempool]: 0,
      [WSTopic.Liquidations]: 0,
      [WSTopic.AmmSync]: 0,
      [WSTopic.BlockConfirm]: 0,
    };
    for (const sub of this.subscribers.values()) {
      for (const t of sub.topics) {
        subscribersByTopic[t] = (subscribersByTopic[t] ?? 0) + 1;
      }
    }
    return {
      subscriberCount: this.subscribers.size,
      messagesSent: this.messagesSent,
      messagesDropped: this.messagesDropped,
      subscribersByTopic,
    };
  }

  /**
   * Start the heartbeat timer. Idempotent. Ping all sockets; sockets
   * that have not responded in 2x the heartbeat interval are terminated
   * and removed.
   */
  startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => this.tick(), this.heartbeatMs);
  }

  /** Stop the heartbeat timer. Idempotent. */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Tear-down: stop heartbeat and unregister everything. */
  stop(): void {
    this.stopHeartbeat();
    this.subscribers.clear();
  }

  private tick(): void {
    const cutoff = this.now() - 2 * this.heartbeatMs;
    for (const [socket, sub] of this.subscribers) {
      try {
        if (sub.socket.readyState === sub.socket.OPEN) {
          sub.socket.ping();
        }
      } catch {
        // ignore — the socket will be cleaned up below
      }
      if (sub.lastPong < cutoff) {
        try {
          socket.terminate();
        } catch {
          // best-effort
        }
        this.subscribers.delete(socket);
      }
    }
  }
}
