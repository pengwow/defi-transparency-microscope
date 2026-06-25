import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

interface HealthRouteOptions {
  /** Chain id this server is expected to be talking to. */
  expectedChainId: number;
}

/**
 * `GET /api/v1/health` — basic liveness payload.
 *
 * Reads the chain head block number and the current WebSocket health
 * state. The chain source is obtained from the Fastify decoration
 * installed in `server.ts`; the `expectedChainId` is a route option so
 * the server start path can pass it in from the Config.
 */
export function defaultChainName(chainId: number): string {
  const CHAIN_NAMES: Record<number, string> = {
    1: 'mainnet',
    5: 'goerli',
    11155111: 'sepolia',
    137: 'polygon',
    42161: 'arbitrum',
    10: 'optimism',
    8453: 'base',
  };
  return CHAIN_NAMES[chainId] ?? `chain:${chainId}`;
}

const healthRoute: FastifyPluginAsync<HealthRouteOptions> = async (
  fastify: FastifyInstance,
  opts,
) => {
  const { expectedChainId } = opts;
  const { provider, wsHealth } = fastify;

  fastify.get('/health', async (_request, reply) => {
    let blockNumber = 0;
    try {
      blockNumber = await provider.getBlockNumber();
    } catch {
      // Surface 0 so the client still gets a payload and the frontend can
      // render a degraded state. The 5xx path is reserved for genuine
      // server errors per the design spec.
      blockNumber = 0;
    }

    return reply.send({
      status: 'ok',
      chain: defaultChainName(expectedChainId),
      blockNumber,
      wsConnected: wsHealth.isWebSocketConnected(),
    });
  });
};

export default healthRoute;
