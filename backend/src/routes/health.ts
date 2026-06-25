import type { FastifyInstance, FastifyPluginAsync } from 'fastify';

/**
 * Source of chain liveness data for the health endpoint.
 *
 * Implemented in M2 by `chain/provider.ts`. For M1 we accept a thin
 * interface so tests can inject a deterministic stub.
 */
export interface ChainHealthSource {
  getBlockNumber(): Promise<number>;
  isWebSocketConnected(): boolean;
}

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

interface HealthRouteOptions {
  chain: ChainHealthSource;
  expectedChainId: number;
}

const healthRoute: FastifyPluginAsync<HealthRouteOptions> = async (
  fastify: FastifyInstance,
  opts,
) => {
  const { chain, expectedChainId } = opts;

  fastify.get('/api/v1/health', async (_request, reply) => {
    let blockNumber = 0;
    try {
      blockNumber = await chain.getBlockNumber();
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
      wsConnected: chain.isWebSocketConnected(),
    });
  });
};

export default healthRoute;
