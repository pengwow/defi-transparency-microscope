/**
 * Preset experiment scenarios.
 *
 * These power the "Experiments" page — a list of named, parameterised
 * simulations the user can open, tweak, and step through.
 */

import type { DexProtocol, ExperimentConfig } from '@/types';
import type { ExperimentPreset } from './api';

const ONE_E18 = 10n ** 18n;
const ONE_E6 = 10n ** 6n;

const uniswapV2: DexProtocol = 'uniswap_v2';
const uniswapV3: DexProtocol = 'uniswap_v3';

export const EXPERIMENT_PRESETS: ExperimentPreset[] = [
  {
    id: 'sandwich-eth-usdc',
    name: 'Sandwich: ETH/USDC',
    description:
      'Classic same-block sandwich on the most liquid V2 pair. Compare attacker P&L at varying victim size.',
    config: {
      name: 'Sandwich: ETH/USDC',
      protocol: uniswapV2,
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * ONE_E6,
      fee: 3000,
      runs: 50,
    } satisfies ExperimentConfig,
  },
  {
    id: 'sandwich-wbtc-eth-v3',
    name: 'Sandwich: WBTC/ETH (V3)',
    description:
      'Concentrated liquidity variant — tighter tick range makes the attack more profitable for the same victim size.',
    config: {
      name: 'Sandwich: WBTC/ETH (V3)',
      protocol: uniswapV3,
      reserve0: 500n * 10n ** 8n,
      reserve1: 10_000n * ONE_E18,
      fee: 3000,
      tickLower: 250_000,
      tickUpper: 260_000,
      runs: 50,
    } satisfies ExperimentConfig,
  },
  {
    id: 'il-eth-usdc',
    name: 'Impermanent Loss: ETH/USDC',
    description:
      'V2 LP vs HODL across a range of price moves. Spot the -50% IL threshold at 2x price change.',
    config: {
      name: 'IL: ETH/USDC',
      protocol: uniswapV2,
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * ONE_E6,
      fee: 3000,
      runs: 25,
    } satisfies ExperimentConfig,
  },
  {
    id: 'attribution-eth-usdc',
    name: 'P&L Attribution: ETH/USDC',
    description:
      'Decompose a swap into price impact, fees paid, gas spent, and the LPs rebate portion.',
    config: {
      name: 'Attribution: ETH/USDC',
      protocol: uniswapV2,
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * ONE_E6,
      fee: 3000,
      runs: 30,
    } satisfies ExperimentConfig,
  },
];

/** Return all available experiment presets. */
export function listExperiments(): ExperimentPreset[] {
  return EXPERIMENT_PRESETS;
}

/** Look up a preset by id; throws on unknown id. */
export function getExperiment(id: string): ExperimentPreset {
  const found = EXPERIMENT_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`UNKNOWN_EXPERIMENT: ${id}`);
  return found;
}
