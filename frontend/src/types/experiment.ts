/**
 * Experiment / scenario types.
 * Used to parameterize and replay analysis runs deterministically.
 */

import type { DexProtocol } from './transaction';

export interface ExperimentConfig {
  /** Human-readable name. */
  name: string;
  /** Description. */
  description?: string;
  /** Protocol to use. */
  protocol: DexProtocol;
  /** Initial reserves, raw integers. */
  reserve0: bigint;
  reserve1: bigint;
  /** Fee in hundredths of a bip. */
  fee: number;
  /** Optional V3 range. */
  tickLower?: number;
  tickUpper?: number;
  /** Number of runs to average. */
  runs: number;
}

export interface ExperimentResult {
  config: ExperimentConfig;
  /** Per-run metrics. */
  results: Array<Record<string, number | bigint | string>>;
  /** Aggregated summary. */
  summary: Record<string, number>;
  /** Total elapsed time in ms. */
  durationMs: number;
}

/** Scenario parameters for sandwich simulation. */
export interface SandwichScenario {
  /** Initial reserves. */
  reserve0: bigint;
  reserve1: bigint;
  /** Victim's trade size in token0. */
  victimAmountIn: bigint;
  /** Attacker's frontrun size in token0. */
  attackerAmountIn: bigint;
  /** Fee in hundredths of a bip. */
  fee: number;
}
