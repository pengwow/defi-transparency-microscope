/**
 * `GET /api/v1/experiments` and `POST /api/v1/experiments/*` routes.
 *
 *   GET    /experiments                → ExperimentPreset[]
 *   GET    /experiments/:id            → ExperimentPreset (404 on miss)
 *   POST   /experiments/sandwich       → runSandwichExperiment
 *   POST   /experiments/il             → runIlExperiment
 *   POST   /experiments/attribution    → runAttributionExperiment
 *
 * All `POST` bodies are Zod-validated; failures become 400 via the
 * central error handler.  Provider call failures (e.g. an upstream
 * RPC throw inside the sandwich sim) become 502 (`upstream_unreachable`).
 *
 * Bigint fields are accepted and serialised as decimal strings per
 * spec §7.
 */
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z, ZodError } from 'zod';
import { getAddress, isAddress } from 'ethers';

import { EXPERIMENT_PRESETS, getExperimentById } from '../experiments/presets.js';
import { runIlExperiment } from '../experiments/il.js';
import { runAttributionExperiment } from '../experiments/attribution.js';
import { runSandwichExperiment } from '../experiments/sandwich.js';
import { isHttpError, notFound, upstreamUnreachable } from '../errors.js';

const bigintString = z
  .string()
  .regex(/^-?\d+$/, 'expected a decimal integer string')
  .transform((s) => BigInt(s));

/**
 * Accept an optional checksummed Ethereum address; when supplied it
 * is normalised via `getAddress` so downstream code can do a clean
 * case-insensitive comparison.  Empty / missing ⇒ undefined.
 */
const optionalAddress = z
  .string()
  .refine((s) => s.length === 0 || isAddress(s), 'invalid address')
  .transform((s) => (s.length === 0 ? undefined : getAddress(s)))
  .optional();

const ilBodySchema = z.object({
  reserve0: bigintString,
  reserve1: bigintString,
  priceRatio: z.number().positive('priceRatio must be > 0'),
  tickLower: z.number().positive().optional(),
  tickUpper: z.number().positive().optional(),
  concentration: z.number().positive().optional(),
});

const attributionBodySchema = z.object({
  reserve0: bigintString,
  reserve1: bigintString,
  amountIn: bigintString,
  fee: z.number().int().min(0).max(1_000_000, 'fee must be in [0, 1_000_000] hundredths of a bip'),
  rebates: bigintString.optional(),
  gasCost: bigintString.optional(),
});

const sandwichScenarioSchema = z.object({
  poolAddress: optionalAddress,
  reserve0: bigintString.optional(),
  reserve1: bigintString.optional(),
  victimAmountIn: bigintString,
  attackerAmountIn: bigintString,
  fee: z.number().int().min(0).max(1_000_000, 'fee must be in [0, 1_000_000] hundredths of a bip'),
});

const sandwichBodySchema = z.object({
  scenario: sandwichScenarioSchema,
});

/**
 * Run a handler body and translate any provider / non-HttpError throws
 * to `upstreamUnreachable` so the route returns 502 with the canonical
 * error envelope.  HttpErrors and ZodErrors are re-thrown unchanged
 * (the central error handler maps them to their own envelopes).
 */
async function callExperiment<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (isHttpError(err)) throw err;
    if (err instanceof ZodError) throw err;
    throw upstreamUnreachable((err as Error).message);
  }
}

const experimentsRoute: FastifyPluginAsync<Record<never, never>> = async (
  fastify: FastifyInstance,
) => {
  fastify.get('/experiments', async (_request, reply) => {
    return reply.send(EXPERIMENT_PRESETS);
  });

  fastify.get<{ Params: { id: string } }>('/experiments/:id', async (request, reply) => {
    const preset = getExperimentById(request.params.id);
    if (!preset) throw notFound('experiment');
    return reply.send(preset);
  });

  fastify.post('/experiments/il', async (request, reply) => {
    const parsed = ilBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ZodError(parsed.error.issues);
    }
    const result = runIlExperiment(parsed.data);
    return reply.send(result);
  });

  fastify.post('/experiments/attribution', async (request, reply) => {
    const parsed = attributionBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ZodError(parsed.error.issues);
    }
    const result = runAttributionExperiment(parsed.data);
    return reply.send(result);
  });

  fastify.post('/experiments/sandwich', async (request, reply) => {
    const parsed = sandwichBodySchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ZodError(parsed.error.issues);
    }
    // Re-shape the parsed input to match SandwichScenario exactly.
    // `poolAddress` is optional; `reserve0/1` default to 0 when not
    // supplied (the sandwich runner needs both, so the route requires
    // either a `poolAddress` (provider lookup) or both reserves).
    const s = parsed.data.scenario;
    const result = await callExperiment(() =>
      runSandwichExperiment(fastify.provider, {
        ...(s.poolAddress ? { poolAddress: s.poolAddress } : {}),
        reserve0: s.reserve0 ?? 0n,
        reserve1: s.reserve1 ?? 0n,
        victimAmountIn: s.victimAmountIn,
        attackerAmountIn: s.attackerAmountIn,
        fee: s.fee,
      }),
    );
    return reply.send(result);
  });
};

export default experimentsRoute;
