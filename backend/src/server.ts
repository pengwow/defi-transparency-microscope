import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { JsonRpcProvider } from 'ethers';
import { ZodError } from 'zod';

import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import { isHttpError } from './errors.js';
import { EthersChainProvider, type ChainProvider } from './chain/provider.js';
import { CachedProvider } from './chain/cachedProvider.js';
import { createWsProvider } from './chain/wsProvider.js';
import { MempoolSource, type MempoolTransport } from './chain/mempool.js';
import { LiquidationWatcher } from './chain/liquidationWatcher.js';
import { AmmSyncWatcher } from './chain/ammSyncWatcher.js';
import { WSHub } from './ws/hub.js';
import { MessageBatcher } from './ws/batcher.js';
import { wsRoutes } from './ws/routes.js';
import { WSTopic } from './ws/topics.js';
import healthRoute from './routes/health.js';
import poolsRoute from './routes/pools.js';
import transactionsRoute from './routes/transactions.js';
import positionsRoute from './routes/positions.js';
import experimentsRoute from './routes/experiments.js';

declare module 'fastify' {
  interface FastifyInstance {
    /** Chain access for all chain-data routes. */
    provider: ChainProvider;
    /** Tiny health state source used only by /api/v1/health. */
    wsHealth: { isWebSocketConnected(): boolean };
    /** WebSocket registry. Routes register/unregister sockets with this. */
    hub: WSHub;
  }
}

export interface BuildServerOptions {
  config?: Config;
  /** Required: the chain data source for the routes. */
  provider: ChainProvider;
  /**
   * Optional WebSocket health state. When omitted the server reports
   * `wsConnected: false`. In production this is wired to the WS state
   * machine; in tests callers can inject a stub.
   */
  wsHealth?: { isWebSocketConnected(): boolean };
  /**
   * Optional WebSocket hub. When omitted the server creates one with
   * default options and starts the heartbeat. Tests pass a pre-built
   * hub to keep their lifecycle under their own control.
   */
  hub?: WSHub;
  /**
   * Optional mempool source. When provided, the source's emissions
   * are wired into the hub's `mempool` topic (batched through a
   * `MessageBatcher` if `mempoolBatcher` is also provided). When
   * omitted, the server creates no mempool source and emits nothing
   * on that topic.
   */
  mempoolSource?: MempoolSource;
  /** Optional batcher for mempool messages. */
  mempoolBatcher?: MessageBatcher<unknown>;
  /** Optional Aave V3 liquidation watcher. */
  liquidationWatcher?: LiquidationWatcher;
  /** Optional AMM sync watcher. */
  ammSyncWatcher?: AmmSyncWatcher;
  /**
   * Optional transport for the mempool source. When `mempoolSource`
   * is omitted but this is provided, the server builds a default
   * `MempoolSource` from it.
   */
  mempoolTransport?: MempoolTransport | null;
}

const DEFAULT_WS_HEALTH: { isWebSocketConnected(): boolean } = {
  isWebSocketConnected: () => false,
};

/**
 * Custom JSON serializer that converts BigInt to decimal strings.
 * See design spec §7 ("bigints serialized as decimal strings").
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/**
 * Deep-walk a payload and convert every BigInt to its decimal string
 * representation. Returns a new value (or the same primitive if there
 * are no BigInts). Used by the `preSerialization` hook so Fastify's
 * default `JSON.stringify` does not throw on BigInt.
 */
function serializeBigInts(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializeBigInts);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeBigInts(v);
    }
    return out;
  }
  return value;
}

export async function buildServer(opts: BuildServerOptions): Promise<FastifyInstance> {
  const config = opts.config ?? loadConfig();
  const { provider } = opts;
  const wsHealth = opts.wsHealth ?? DEFAULT_WS_HEALTH;
  const ownsHub = !opts.hub;
  const hub = opts.hub ?? new WSHub();
  if (ownsHub) hub.startHeartbeat();

  const app = Fastify({
    logger,
    // Apply our bigint-aware replacer globally.
    serializerOpts: { bigInt: false },
  });

  app.decorate('provider', provider);
  app.decorate('wsHealth', wsHealth);
  app.decorate('hub', hub);

  // Bigints must be serialised as decimal strings (spec §7). Fastify's
  // default JSON.stringify throws on BigInt; we add a preSerialization
  // hook that walks the payload and converts every BigInt to a string
  // BEFORE Fastify's serializer runs. The onSend hook then re-stringifies
  // the mutated payload (which now has only plain JSON values).
  app.addHook('preSerialization', async (_request, _reply, payload) => {
    return serializeBigInts(payload);
  });

  app.addHook('onSend', async (_request, _reply, payload) => {
    if (typeof payload === 'string') return payload;
    if (Buffer.isBuffer(payload)) return payload;
    if (payload === null || payload === undefined) return payload;
    return JSON.stringify(payload, bigIntReplacer);
  });

  // Central error handler — installed before any route plugin so it
  // applies to every encapsulated context (the route plugins all
  // register under /api/v1).
  app.setErrorHandler((error, _request, reply) => {
    if (isHttpError(error)) {
      void reply.status(error.statusCode).send({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof ZodError) {
      void reply
        .status(400)
        .send({ error: 'validation', message: 'invalid query parameters', issues: error.issues });
      return;
    }
    app.log.error({ err: error }, 'unhandled error');
    void reply.status(500).send({ error: 'internal', message: 'internal error' });
  });

  app.setNotFoundHandler((_request, reply) => {
    void reply.status(404).send({ error: 'not_found', message: 'route not found' });
  });

  await app.register(cors, { origin: true });
  // @fastify/websocket is registered here (vs the route file) so the
  // hub is available to the route plugin via the app decorator.
  await app.register(websocket);
  await app.register(wsRoutes, { hub });

  // Routes are registered under /api/v1 via the per-plugin `prefix` option
  // so each route file declares short, relative paths.
  await app.register(healthRoute, { prefix: '/api/v1', expectedChainId: config.chainId });
  await app.register(poolsRoute, { prefix: '/api/v1' });
  await app.register(transactionsRoute, { prefix: '/api/v1' });
  await app.register(positionsRoute, { prefix: '/api/v1' });
  await app.register(experimentsRoute, { prefix: '/api/v1' });

  // --- Event sources wiring ---------------------------------------
  // Mempool: the source is owned either by the caller (tests) or
  // created here. A batcher debounces per the spec §8.5 (100 ms).
  let mempoolSource: MempoolSource | undefined = opts.mempoolSource;
  let mempoolBatcher: MessageBatcher<unknown> | undefined = opts.mempoolBatcher;
  if (!mempoolSource && opts.mempoolTransport) {
    mempoolSource = new MempoolSource({ provider, transport: opts.mempoolTransport });
  }
  if (mempoolSource) {
    if (!mempoolBatcher) mempoolBatcher = new MessageBatcher<unknown>({ flushIntervalMs: 100 });
    mempoolBatcher.onFlush((batch) => {
      for (const tx of batch) {
        hub.broadcast(WSTopic.Mempool, {
          type: 'mempool_tx',
          // The source emits PendingTx; the broadcast shape matches.
          data: tx as never,
        });
      }
    });
    mempoolSource.onMessage((txs) => {
      for (const tx of txs) mempoolBatcher!.add(tx);
    });
    mempoolSource.start();
  }

  // Liquidation: simple pass-through, no batching.
  if (opts.liquidationWatcher) {
    opts.liquidationWatcher.onEvent((evt) => {
      hub.broadcast(WSTopic.Liquidations, { type: 'liquidation_event', data: evt });
    });
    opts.liquidationWatcher.start();
  }

  // AMM sync: simple pass-through.
  if (opts.ammSyncWatcher) {
    opts.ammSyncWatcher.onEvent((evt) => {
      hub.broadcast(WSTopic.AmmSync, { type: 'amm_sync', data: evt });
    });
    opts.ammSyncWatcher.start();
  }

  // Ensure we tear down owned resources on app close.
  app.addHook('onClose', async () => {
    mempoolSource?.stop();
    mempoolBatcher?.stop();
    opts.liquidationWatcher?.stop();
    opts.ammSyncWatcher?.stop();
    if (ownsHub) hub.stop();
  });

  return app as unknown as FastifyInstance;
}

async function start(): Promise<void> {
  const config = loadConfig();
  const rpc = new JsonRpcProvider(config.rpcUrl);
  const base = new EthersChainProvider(rpc);
  const provider = new CachedProvider(base, { ttlMs: config.cacheTtlMs });
  const wsWrap = createWsProvider(config.rpcWsUrl ?? undefined);
  const wsHealth = wsWrap
    ? { isWebSocketConnected: () => wsWrap.state === 'connected' }
    : DEFAULT_WS_HEALTH;

  // Production: spin up the liquidation + AMM watchers against the
  // cached provider. The mempool source is started in HTTP-poll
  // mode by default (no WS URL configured) and will keep that mode
  // unless `RPC_WS_URL` is set, in which case the WS transport is
  // wrapped by the source automatically.
  const liquidationWatcher = new LiquidationWatcher(provider, {
    pollIntervalMs: config.liquidationPollMs,
    lookbackBlocks: config.liquidationLookback,
  });
  const ammSyncWatcher = new AmmSyncWatcher(provider, {
    pollIntervalMs: config.ammSyncPollMs,
    lookbackBlocks: config.ammSyncLookback,
    debounceMs: config.ammSyncDebounceMs,
  });

  const app = await buildServer({
    config,
    provider,
    wsHealth,
    liquidationWatcher,
    ammSyncWatcher,
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
      wsWrap?.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(
      { port: config.port, chainId: config.chainId, rpcUrl: config.rpcUrl },
      'dtm-backend listening',
    );
  } catch (err) {
    app.log.error({ err }, 'failed to start server');
    process.exit(1);
  }
}

// Only auto-start when run directly (not when imported by tests).
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  void start();
}
