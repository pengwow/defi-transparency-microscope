/**
 * `GET /api/v1/lending-positions` and `GET /api/v1/lp-positions`.
 *
 * Two endpoints in one plugin because they share the same shape
 * (curated chain positions returned by the chain layer) and the same
 * error handling pattern. Both delegate to the chain layer's list
 * functions; raw provider errors are mapped to `upstream_unreachable`
 * (502) so the client gets a uniform error envelope per spec §10.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { listLendingPositions } from '../chain/lending.js';
import { listLpPositions } from '../chain/lp.js';
import { isHttpError, upstreamUnreachable } from '../errors.js';

async function callChainOr502<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isHttpError(err)) throw err;
    throw upstreamUnreachable((err as Error).message);
  }
}

const positionsRoute: FastifyPluginAsync<Record<never, never>> = async (
  fastify: FastifyInstance,
) => {
  fastify.get('/lending-positions', async (_request, reply) => {
    const positions = await callChainOr502(() => listLendingPositions(fastify.provider));
    return reply.send(positions);
  });

  fastify.get('/lp-positions', async (_request, reply) => {
    const positions = await callChainOr502(() => listLpPositions(fastify.provider));
    return reply.send(positions);
  });
};

export default positionsRoute;
