/**
 * In-memory experiment presets.
 *
 * Mirrors `frontend/src/services/experiments.ts`.  These power the
 * `GET /api/v1/experiments` and `GET /api/v1/experiments/:id` routes.
 * The ids and configs are intentionally a 1-for-1 copy so the frontend
 * can address presets interchangeably against either backend.
 */

import type { ExperimentPreset } from './types.js';

const ONE_E18 = 10n ** 18n;
const ONE_E8 = 10n ** 8n;
const ONE_E6 = 10n ** 6n;

export const EXPERIMENT_PRESETS: ExperimentPreset[] = [
  {
    id: 'sandwich-eth-usdc',
    name: 'Sandwich: ETH/USDC',
    description:
      'Classic same-block sandwich on the most liquid V2 pair. Compare attacker P&L at varying victim size.',
    config: {
      name: 'Sandwich: ETH/USDC',
      protocol: 'uniswap_v2',
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * ONE_E6,
      fee: 3000,
      runs: 50,
    },
  },
  {
    id: 'sandwich-wbtc-eth-v3',
    name: 'Sandwich: WBTC/ETH (V3)',
    description:
      'Concentrated liquidity variant — tighter tick range makes the attack more profitable for the same victim size.',
    config: {
      name: 'Sandwich: WBTC/ETH (V3)',
      protocol: 'uniswap_v3',
      reserve0: 500n * ONE_E8,
      reserve1: 10_000n * ONE_E18,
      fee: 3000,
      tickLower: 250_000,
      tickUpper: 260_000,
      runs: 50,
    },
  },
  {
    id: 'il-eth-usdc',
    name: 'Impermanent Loss: ETH/USDC',
    description:
      'V2 LP vs HODL across a range of price moves. Spot the -50% IL threshold at 2x price change.',
    config: {
      name: 'IL: ETH/USDC',
      protocol: 'uniswap_v2',
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * ONE_E6,
      fee: 3000,
      runs: 25,
    },
  },
  {
    id: 'attribution-eth-usdc',
    name: 'P&L Attribution: ETH/USDC',
    description:
      'Decompose a swap into price impact, fees paid, gas spent, and the LPs rebate portion.',
    config: {
      name: 'Attribution: ETH/USDC',
      protocol: 'uniswap_v2',
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * ONE_E6,
      fee: 3000,
      runs: 30,
    },
  },
];

/** Look up a preset by id.  Returns `undefined` when the id is unknown. */
export function getExperimentById(id: string): ExperimentPreset | undefined {
  return EXPERIMENT_PRESETS.find((p) => p.id === id);
}
