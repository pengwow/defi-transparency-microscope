/**
 * WsClient — typed client for the backend's `/ws` realtime feed.
 *
 * Spec §8.2/§8.3 define the protocol.  The client:
 *   - Opens a single WebSocket to `${wsUrl}/ws`.
 *   - Sends `{action:'subscribe', topics:[...]}` / `unsubscribe` / `ping`.
 *   - Re-sends the active subscription set after every reconnect, so
 *     topic state survives transient network drops.
 *   - Exposes a small event surface (`onMessage`, `onStateChange`) so
 *     consumers can wire messages into stores / UI without having to
 *     know the transport details.
 *   - Reconnects with capped exponential backoff (1s, 2s, 4s, 8s,
 *     16s, 30s — then 30s repeated).
 *
 * Usage:
 *
 *   const ws = new WsClient({
 *     url: 'ws://localhost:8000',
 *     topics: ['mempool'],
 *     onMessage: (msg) => { ... },
 *   });
 *   ws.start();
 *   ...
 *   ws.stop();
 *
 * The constructor takes an optional `WebSocketImpl` for tests; in
 * production the global `WebSocket` is used.  `Message`-shaped
 * envelopes are surfaced as `unknown` to keep the client transport-
 * agnostic — consumers should narrow on `msg.type` themselves.
 */

export type WsState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface WsMessageEnvelope {
  type: string;
  data: unknown;
}

export interface WsClientOptions {
  /** Backend origin, e.g. `ws://localhost:8000`.  `/ws` is appended. */
  url: string;
  /** Topics to subscribe to immediately after the welcome handshake. */
  topics?: string[];
  /** Called for every parsed JSON envelope. */
  onMessage?: (msg: WsMessageEnvelope) => void;
  /** Called whenever the connection state transitions. */
  onStateChange?: (state: WsState) => void;
  /** Override the WebSocket constructor (used by tests). */
  WebSocketImpl?: typeof WebSocket;
  /** Min / max backoff in ms (defaults: 1000 / 30000). */
  backoffMinMs?: number;
  backoffMaxMs?: number;
}

/** Minimum shape of a WebSocket we will use.  Lets us stub it in tests. */
interface MinimalWebSocket {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  onopen: ((ev: Event) => void) | null;
  onclose: ((ev: CloseEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onmessage: ((ev: MessageEvent) => void) | null;
  readyState: number;
}

export class WsClient {
  private readonly url: string;
  private readonly onStateChange?: (state: WsState) => void;
  private readonly WSCtor: typeof WebSocket;
  private readonly backoffMin: number;
  private readonly backoffMax: number;
  private readonly initialTopics: string[];

  private socket: MinimalWebSocket | null = null;
  private state: WsState = 'idle';
  private activeTopics: Set<string> = new Set();
  /** Topics that were subscribed during a reconnect window. */
  private pendingTopics: Set<string> = new Set();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** True once `stop()` has been called — prevents further reconnects. */
  private stopped = true;
  /** True while user-initiated actions (sub/unsub) are pending. */
  private inflightActions: Array<Record<string, unknown>> = [];
  /** Public message callback (replaceable after construction). */
  private msgHandler: ((msg: WsMessageEnvelope) => void) | null = null;

  constructor(opts: WsClientOptions) {
    this.url = `${opts.url.replace(/\/+$/, '')}/ws`;
    this.msgHandler = opts.onMessage ?? null;
    this.onStateChange = opts.onStateChange;
    this.WSCtor =
      opts.WebSocketImpl ??
      (typeof WebSocket !== 'undefined' ? WebSocket : (undefined as never));
    this.backoffMin = opts.backoffMinMs ?? 1_000;
    this.backoffMax = opts.backoffMaxMs ?? 30_000;
    this.initialTopics = opts.topics ?? [];
  }

  /**
   * Replace the message callback.  Pass `null` to clear it.  Useful
   * when the consumer was constructed lazily (e.g. a service barrel)
   * and the actual handler lives in React-land.
   */
  setOnMessage(handler: ((msg: WsMessageEnvelope) => void) | null): void {
    this.msgHandler = handler;
  }

  /** Returns the current connection state. */
  getState(): WsState {
    return this.state;
  }

  /** Returns the currently active topic set. */
  getTopics(): string[] {
    return Array.from(this.activeTopics);
  }

  /** Begin connecting.  Safe to call multiple times. */
  start(): void {
    this.stopped = false;
    this.openSocket();
  }

  /** Permanently stop: close the socket and cancel any pending reconnect. */
  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        /* noop */
      }
      this.socket = null;
    }
    this.setState('closed');
  }

  /** Subscribe to one or more topics.  Idempotent. */
  subscribe(topics: string[]): void {
    const fresh = topics.filter((t) => !this.activeTopics.has(t) && !this.pendingTopics.has(t));
    if (fresh.length === 0) return;
    for (const t of fresh) this.pendingTopics.add(t);
    this.sendAction({ action: 'subscribe', topics: fresh });
  }

  /** Unsubscribe from one or more topics.  Idempotent. */
  unsubscribe(topics: string[]): void {
    const drop = topics.filter((t) => this.activeTopics.has(t) || this.pendingTopics.has(t));
    if (drop.length === 0) return;
    for (const t of drop) {
      this.activeTopics.delete(t);
      this.pendingTopics.delete(t);
    }
    this.sendAction({ action: 'unsubscribe', topics: drop });
  }

  /** Send a ping; the server replies with a `pong` envelope. */
  ping(): void {
    this.sendAction({ action: 'ping' });
  }

  // ─── internals ─────────────────────────────────────────────────────

  private setState(next: WsState): void {
    if (this.state === next) return;
    this.state = next;
    try {
      this.onStateChange?.(next);
    } catch {
      /* swallow consumer errors */
    }
  }

  private openSocket(): void {
    if (this.stopped) return;
    this.setState(this.reconnectAttempt === 0 ? 'connecting' : 'reconnecting');

    let ws: MinimalWebSocket;
    try {
      ws = new this.WSCtor(this.url) as unknown as MinimalWebSocket;
    } catch (err) {
      this.scheduleReconnect();
      void err;
      return;
    }
    this.socket = ws;

    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.setState('open');
      // Restore initial topics on first open; re-send the entire set
      // on subsequent opens so topic state survives a drop.
      const toSend = Array.from(
        new Set([...this.initialTopics, ...this.activeTopics, ...this.pendingTopics]),
      );
      this.pendingTopics.clear();
      this.activeTopics = new Set(toSend);
      for (const t of toSend) this.sendAction({ action: 'subscribe', topics: [t] });
      // Flush any queued actions.
      const queued = this.inflightActions.splice(0);
      for (const a of queued) this.sendAction(a);
    };

    ws.onmessage = (ev) => {
      const raw =
        typeof ev.data === 'string'
          ? ev.data
          : (ev.data as { toString(): string }).toString();
      let parsed: WsMessageEnvelope | null = null;
      try {
        parsed = JSON.parse(raw) as WsMessageEnvelope;
      } catch {
        return;
      }
      if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') return;

      // Track our own subscription state from the server's acks so a
      // dropped event-loop tick can't desync us.
      if (parsed.type === 'ack') {
        const data = parsed.data as { ok?: boolean; subscribed?: string[] } | null;
        if (data?.ok && Array.isArray(data.subscribed)) {
          this.activeTopics = new Set(data.subscribed);
        }
      }

      try {
        this.msgHandler?.(parsed);
      } catch {
        /* swallow consumer errors */
      }
    };

    ws.onerror = () => {
      // The close handler will follow; nothing to do here.
    };

    ws.onclose = () => {
      this.socket = null;
      if (this.stopped) {
        this.setState('closed');
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.stopped) return;
    this.reconnectAttempt += 1;
    const exp = Math.min(this.backoffMax, this.backoffMin * 2 ** (this.reconnectAttempt - 1));
    this.setState('reconnecting');
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, exp);
  }

  private sendAction(action: Record<string, unknown>): void {
    if (this.state !== 'open' || !this.socket) {
      // Queue the action so it gets sent after the next (re)open.
      // `subscribe`/`unsubscribe` actions are deduped via
      // activeTopics/pendingTopics, so duplicating the last intent is
      // safe — the server's `ack` will converge the truth.
      this.inflightActions.push(action);
      return;
    }
    try {
      this.socket.send(JSON.stringify(action));
    } catch {
      // Most likely the socket just closed; the close handler will
      // schedule a reconnect and any inflight action survives in the
      // queue above.
    }
  }
}
