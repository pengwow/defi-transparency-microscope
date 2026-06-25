/**
 * Experiment types shared by the experiments/ module and the
 * `/api/v1/experiments*` routes.
 *
 * These mirror the shapes in `frontend/src/services/api.ts` and
 * `frontend/src/types/experiment.ts` but are kept independent of the
 * frontend (the backend is self-contained per the design spec §3.2).
 *
 * All bigint quantities are raw integer token units (token decimals);
 * callers should serialise them as decimal strings per spec §7.
 */

/** DEX protocol flavour for an experiment. */
export type DexProtocol = 'uniswap_v2' | 'uniswap_v3';

/** Fee in hundredths of a bip (3000 = 0.30%). */
export type FeeHundredthsBip = number;

/**
 * Scenario parameters for the sandwich attack simulation
 * (`experiments/sandwich.ts`).
 *
 * Same-direction 3-swap model:
 *   1. Attacker frontrun:  sell token0 for token1
 *   2. Victim trade:       sell token0 for token1 (gets a worse rate)
 *   3. Attacker backrun:   sell the received token1 back for token0
 *
 * `reserve0` / `reserve1` are optional: when the scenario carries a
 * `poolAddress` (only added by the route layer) the experiment will
 * fetch fresh reserves from the provider instead.  In the experiments
 * module itself the reserves are required.
 */
export interface SandwichScenario {
  /** Initial reserve of token0 in the pool. */
  reserve0?: bigint;
  /** Initial reserve of token1 in the pool. */
  reserve1?: bigint;
  /** Victim's trade size in token0. */
  victimAmountIn: bigint;
  /** Attacker's frontrun size in token0. */
  attackerAmountIn: bigint;
  /** Fee in hundredths of a bip (3000 = 0.3%). */
  fee: FeeHundredthsBip;
}

/**
 * Impermanent loss scenario.
 *
 * `priceRatio = newPrice / oldPrice` (e.g. 2 means the asset doubled).
 * `tickLower` / `tickUpper` are optional V3 bounds; when omitted the
 * run is treated as a V2 (full-range) calculation.
 */
export interface ILInput {
  /** Initial reserve of token0 (kept for parity with the sandwich API). */
  reserve0: bigint;
  /** Initial reserve of token1. */
  reserve1: bigint;
  /** newPrice / oldPrice; must be > 0. */
  priceRatio: number;
  /** Optional V3 lower bound price. */
  tickLower?: number;
  /** Optional V3 upper bound price. */
  tickUpper?: number;
  /** Optional amplification factor (1 = V2). Smaller ⇒ more concentrated. */
  concentration?: number;
}

/**
 * Profit-attribution scenario.
 *
 * `fee` is the pool fee in hundredths of a bip and is only used to
 * compute the fee component; the other three components are taken
 * directly from the input.
 */
export interface AttributionInput {
  reserve0: bigint;
  reserve1: bigint;
  /** Trade size in token0. */
  amountIn: bigint;
  /** Fee in hundredths of a bip (3000 = 0.3%). */
  fee: FeeHundredthsBip;
  /** LP rebate component, in token0 units (defaults to 0). */
  rebates?: bigint;
  /** Gas cost component, in token0 units (defaults to 0). */
  gasCost?: bigint;
}

/**
 * The result of any experiment run. Each experiment module decorates
 * the `result` map with its own keys so the type can stay generic.
 */
export interface ExperimentResult<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Wall-clock duration of the run in milliseconds. */
  durationMs: number;
  /** Experiment-specific result payload. */
  result: T;
}

/** Named experiment preset (matches frontend `ExperimentPreset`). */
export interface ExperimentPreset {
  id: string;
  name: string;
  description: string;
  /** Free-form configuration; the route layer passes it back verbatim. */
  config: {
    name: string;
    description?: string;
    protocol: DexProtocol;
    reserve0: bigint;
    reserve1: bigint;
    fee: FeeHundredthsBip;
    tickLower?: number;
    tickUpper?: number;
    runs: number;
  };
}
