import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { loadConfig, type Config } from './config.js';
import { logger } from './logger.js';
import healthRoute, { type ChainHealthSource } from './routes/health.js';
import { HttpError, isHttpError } from './errors.js';

export interface BuildServerOptions {
  config?: Config;
  /** Inject a deterministic chain source for tests. Falls back to a stub. */
  chainSource?: ChainHealthSource;
}

/**
 * Default chain health source: returns 0 / disconnected. The real
 * implementation lands in M2 (`chain/provider.ts`).
 */
const defaultChainSource: ChainHealthSource = {
  async getBlockNumber() {
    return 0;
  },
  isWebSocketConnected() {
    return false;
  },
};

/**
 * Custom JSON serializer that converts BigInt to decimal strings.
 * See design spec §7 ("bigints serialized as decimal strings").
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

export async function buildServer(opts: BuildServerOptions = {}): Promise<FastifyInstance> {
  const config = opts.config ?? loadConfig();
  const chain = opts.chainSource ?? defaultChainSource;

  const app = Fastify({
    logger,
    // Apply our bigint-aware replacer globally.
    serializerOpts: { bigInt: false },
  });

  // bigint-safe JSON.stringify: Fastify uses fast-json-stringify for schema'd
  // routes, but for un-schema'd responses we need a custom replacer. We
  // install it as a reply hook for un-schema'd payloads.
  app.addHook('onSend', async (_request, _reply, payload) => {
    if (typeof payload === 'string') return payload;
    if (Buffer.isBuffer(payload)) return payload;
    if (payload === null || payload === undefined) return payload;
    return JSON.stringify(payload, bigIntReplacer);
  });

  await app.register(cors, { origin: true });

  await app.register(healthRoute, { chain, expectedChainId: config.chainId });

  app.setErrorHandler((error, _request, reply) => {
    if (isHttpError(error)) {
      return reply.status(error.statusCode).send({ error: error.code, message: error.message });
    }
    app.log.error({ err: error }, 'unhandled error');
    return reply.status(500).send({ error: 'internal', message: 'internal error' });
  });

  app.setNotFoundHandler((_request, reply) => {
    const err: HttpError = new HttpError(404, 'not_found', 'route not found');
    return reply.status(404).send({ error: err.code, message: err.message });
  });

  return app as unknown as FastifyInstance;
}

async function start(): Promise<void> {
  const config = loadConfig();
  const app = await buildServer({ config });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    try {
      await app.close();
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
