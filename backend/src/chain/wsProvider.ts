/**
 * WebSocket provider wrapper.
 *
 * Design spec §5.2: if `RPC_WS_URL` is set, create a `WebSocketProvider`
 * for mempool subscriptions. The transport is unreliable (public WS nodes
 * disconnect often), so we wrap it in a tiny `WSHealth` state machine
 * the rest of the backend uses to decide between WS-driven and
 * HTTP-polling strategies.
 *
 * This module deliberately avoids a real WS in tests: callers can pass
 * a `createProvider` factory to inject a stub, and `WSHealth` itself
 * exposes its state machine so the unit tests can drive transitions
 * directly.
 */
import { WebSocketProvider, type WebSocketLike } from 'ethers';

export type WSHealthState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'closed';

type Listener = (state: WSHealthState) => void;

export interface WSWrapOptions {
  /** Inject a factory to bypass real WS construction (tests). */
  createProvider?: (url: string) => WebSocketProvider;
}

/**
 * Observable state machine for a WebSocketProvider.
 *
 * Listens to the underlying provider's `connect`, `disconnect`, `error`,
 * and `close` events and exposes the current state plus a `subscribe`
 * channel for downstream consumers (e.g. the WS broadcaster deciding
 * whether to switch to HTTP polling).
 */
export class WSHealth {
  private _state: WSHealthState = 'disconnected';
  private listeners = new Set<Listener>();
  // The provider we listen to; kept so `close()` can call destroy().
  private provider: WebSocketProvider | null = null;

  get state(): WSHealthState {
    return this._state;
  }

  /**
   * Attach to a provider; safe to call only once per WSHealth instance.
   * Replaces the current binding (calls `close()` on the old one).
   */
  attach(provider: WebSocketProvider): void {
    this.detach();
    this.provider = provider;
    this.setState('connecting');
    provider.on('connect', () => this.setState('connected'));
    provider.on('disconnect', () => this.setState('reconnecting'));
    provider.on('error', () => this.setState('disconnected'));
    provider.on('close', () => this.setState('disconnected'));
  }

  /** Stop listening and destroy the underlying provider. */
  close(): void {
    if (this.provider) {
      try {
        this.provider.destroy();
      } catch {
        // destroy() is best-effort; some implementations throw if already closed.
      }
    }
    this.setState('disconnected');
  }

  private detach(): void {
    if (this.provider) {
      this.provider.removeAllListeners?.();
    }
    this.provider = null;
  }

  private setState(next: WSHealthState): void {
    if (this._state === next) return;
    this._state = next;
    for (const fn of this.listeners) {
      try {
        fn(next);
      } catch {
        // listeners must not break the state machine
      }
    }
  }

  /** Subscribe to state changes; returns an unsubscribe function. */
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    // Emit current state immediately for new subscribers
    try {
      fn(this._state);
    } catch {
      // ignore
    }
    return () => {
      this.listeners.delete(fn);
    };
  }
}

export interface WSWrap {
  provider: WebSocketProvider;
  health: WSHealth;
  state: WSHealthState;
  close(): void;
}

/**
 * Build a `WSWrap` for the given WS URL, or null if no URL was provided.
 *
 * When `url` is `undefined` or empty, this returns `null` so callers can
 * fall back to HTTP polling.
 */
export function createWsProvider(url: string | undefined, opts: WSWrapOptions = {}): WSWrap | null {
  if (!url || url.trim().length === 0) return null;
  const create = opts.createProvider ?? ((u: string) => new WebSocketProvider(u));
  const provider = create(url);
  const health = new WSHealth();
  health.attach(provider);
  // The state property must reflect the wrapper's current state. We
  // return a small object that proxies the `state` getter.
  return {
    provider,
    health,
    get state(): WSHealthState {
      return health.state;
    },
    close(): void {
      health.close();
    },
  };
}

// WebSocketLike is re-exported for type-only consumers (e.g. tests).
export type { WebSocketLike };
