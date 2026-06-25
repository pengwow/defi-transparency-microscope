/**
 * `GET /api/v1/transactions` — recent on-chain transactions, classified.
 *
 * Query params (Zod-validated):
 *   - blocks  (default 10, max 200) — trailing block range to scan
 *   - limit   (default 100, max 200) — hard cap on results
 *   - addresses (optional comma-separated) — restrict the filter scope
 *
 * Delegates to `chain/transactions.listTransactions`. Any non-HttpError
 * raised by the chain layer (e.g. raw RPC failures that did not get
 * wrapped upstream) is mapped to `upstream_unreachable` (502) so the
 * client gets a uniform error envelope per spec §10.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z, ZodError } from 'zod';

import { listTransactions, type ListTransactionsOptions } from '../chain/transactions.js';
import { isHttpError, upstreamUnreachable } from '../errors.js';

const DEFAULT_BLOCKS = 10;
const DEFAULT_LIMIT = 100;
const MAX_BLOCKS = 200;
const MAX_LIMIT = 200;

const transactionsQuerySchema = z.object({
  blocks: z.coerce
    .number()
    .int('blocks must be an integer')
    .min(1, 'blocks must be >= 1')
    .max(MAX_BLOCKS, `blocks must be <= ${MAX_BLOCKS}`)
    .default(DEFAULT_BLOCKS),
  limit: z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be >= 1')
    .max(MAX_LIMIT, `limit must be <= ${MAX_LIMIT}`)
    .default(DEFAULT_LIMIT),
  addresses: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      const list = s
        .split(',')
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      return list.length > 0 ? list : undefined;
    }),
});

const transactionsRoute: FastifyPluginAsync<Record<never, never>> = async (
  fastify: FastifyInstance,
) => {
  fastify.get('/transactions', async (request, reply) => {
    const parsed = transactionsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ZodError(parsed.error.issues);
    }
    const { blocks, limit, addresses } = parsed.data;
    const options: ListTransactionsOptions = { blocks, limit, addresses };
    try {
      const txs = await listTransactions(fastify.provider, options);
      return reply.send(txs);
    } catch (err) {
      if (isHttpError(err)) throw err;
      throw upstreamUnreachable((err as Error).message);
    }
  });
};

export default transactionsRoute;
