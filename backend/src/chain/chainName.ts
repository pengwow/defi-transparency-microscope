/**
 * Chain name resolver.
 *
 * Maps an EVM chainId to a short human-readable name. Used by the
 * `/api/v1/health` endpoint, the WS broadcaster, and any UI label that
 * surfaces which network we're talking to.
 *
 * Note: this is the canonical chain-name module for the `chain/*` layer.
 * The `routes/health.ts` `defaultChainName` helper is a separate
 * duplicate retained for the M1 route API; the M2 refactor can collapse
 * them.
 */
const CHAIN_NAMES: Record<number, string> = {
  1: 'mainnet',
  11155111: 'sepolia',
  137: 'polygon',
  42161: 'arbitrum',
  8453: 'base',
};

/**
 * Resolve a chainId to a human-readable name. Unknown chainIds fall back
 * to `chain-<id>` so the value is still recognisable in logs and UI.
 */
export function resolveChainName(chainId: number): string {
  return CHAIN_NAMES[chainId] ?? `chain-${chainId}`;
}
