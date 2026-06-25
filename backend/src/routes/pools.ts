/**
 * `GET /api/v1/pools` — curated 3-pool summary.
 *
 * Delegates to `chain/pools.listPools` which returns V2 + V3 reserves /
 * slot0 state. Provider errors surface as 502 via the central error
 * handler (the chain layer already wraps them as `upstreamUnreachable`).
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

import { listPools } from '../chain/pools.js';

const poolsRoute: FastifyPluginAsync<Record<never, never>> = async (fastify: FastifyInstance) => {
  fastify.get('/pools', async (_request, reply) => {
    const pools = await listPools(fastify.provider);
    return reply.send(pools);
  });
};

export default poolsRoute;
