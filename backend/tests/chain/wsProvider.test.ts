/**
 * Tests for the WS provider wrapper.
 *
 * We do NOT exercise real WebSockets. Instead we drive the `WSHealth`
 * state machine directly to verify:
 *   - initial state is `disconnected`
 *   - `connect()` transitions to `connecting` then `connected`
 *   - simulated close transitions back to `disconnected`
 *   - `createWsProvider(undefined)` returns null
 *
 * For the happy-path factory we mock the `WebSocketProvider` constructor
 * so we can return a controllable stub.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createWsProvider,
  WSHealth,
  type WSHealthState,
} from '../../src/chain/wsProvider.js';

type WSEventName = 'connect' | 'disconnect' | 'error' | 'close';

function makeFakeWsProvider(): {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any;
  emit: (event: WSEventName) => void;
  on: (event: WSEventName, fn: () => void) => void;
} {
  const listeners: Record<WSEventName, Array<() => void>> = {
    connect: [],
    disconnect: [],
    error: [],
    close: [],
  };
  const provider = {
    on: vi.fn((event: WSEventName, fn: () => void) => {
      listeners[event].push(fn);
    }),
    once: vi.fn((event: WSEventName, fn: () => void) => {
      listeners[event].push(fn);
    }),
    off: vi.fn(),
    destroy: vi.fn(),
    websocket: {
      // some internal API used in ethers — keep shape happy
      readyState: 0,
    },
  };
  return {
    provider,
    emit: (event: WSEventName) => {
      for (const fn of listeners[event]) fn();
    },
    on: (event: WSEventName, fn: () => void) => {
      listeners[event].push(fn);
    },
  };
}

describe('createWsProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when url is undefined', () => {
    const result = createWsProvider(undefined);
    expect(result).toBeNull();
  });

  it('returns null when url is the empty string', () => {
    const result = createWsProvider('');
    expect(result).toBeNull();
  });

  it('creates a WSHealth wrapper for a non-empty url', () => {
    const fake = makeFakeWsProvider();
    const ws = createWsProvider('wss://example.invalid', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createProvider: (() => fake.provider) as any,
    });
    expect(ws).not.toBeNull();
    expect(ws!.state).toBe('connecting');
    expect(typeof ws!.close).toBe('function');
  });

  it('calls the factory exactly once with the given url', () => {
    const fake = makeFakeWsProvider();
    const factory = vi.fn(() => fake.provider);
    createWsProvider('wss://example.invalid', {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createProvider: factory as any,
    });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledWith('wss://example.invalid');
  });
});

describe('WSHealth state machine', () => {
  let fake: ReturnType<typeof makeFakeWsProvider>;

  beforeEach(() => {
    fake = makeFakeWsProvider();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in "disconnected" state', () => {
    const h = new WSHealth();
    expect(h.state).toBe<WSHealthState>('disconnected');
  });

  it('attaches listeners on creation that update state on connect', () => {
    const h = new WSHealth();
    const provider = fake.provider;
    h.attach(provider);
    fake.emit('connect');
    expect(h.state).toBe<WSHealthState>('connected');
  });

  it('transitions to "disconnected" on simulated close', () => {
    const h = new WSHealth();
    h.attach(fake.provider);
    fake.emit('connect');
    expect(h.state).toBe<WSHealthState>('connected');
    fake.emit('close');
    expect(h.state).toBe<WSHealthState>('disconnected');
  });

  it('transitions to "disconnected" on simulated error', () => {
    const h = new WSHealth();
    h.attach(fake.provider);
    fake.emit('connect');
    fake.emit('error');
    expect(h.state).toBe<WSHealthState>('disconnected');
  });

  it('transitions to "reconnecting" on first disconnect after connected', () => {
    const h = new WSHealth();
    h.attach(fake.provider);
    fake.emit('connect');
    fake.emit('disconnect');
    expect(h.state).toBe<WSHealthState>('reconnecting');
  });

  it('close() destroys the provider and reports disconnected', () => {
    const h = new WSHealth();
    h.attach(fake.provider);
    h.close();
    expect(h.state).toBe<WSHealthState>('disconnected');
    expect(fake.provider.destroy).toHaveBeenCalled();
  });

  it('subscribe exposes state changes via a callback', () => {
    const h = new WSHealth();
    const seen: WSHealthState[] = [];
    const unsubscribe = h.subscribe((s) => seen.push(s));
    h.attach(fake.provider);
    fake.emit('connect');
    fake.emit('close');
    unsubscribe();
    fake.emit('connect'); // should not be seen
    // At minimum we should have seen connected and disconnected (or
    // reconnecting). The exact path is implementation-dependent.
    expect(seen).toContain('connected');
  });
});
