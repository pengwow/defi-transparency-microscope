/**
 * Sandwich attack simulation.
 *
 * Same-direction 3-swap model:
 *   1. Attacker frontrun:  sell token0 for token1
 *   2. Victim trade:       sell token0 for token1 (gets a worse rate)
 *   3. Attacker backrun:   sell the received token1 back for token0
 *
 * The implementation is a backend port of the frontend's
 * `frontend/src/algorithms/sandwich.ts`; the CPMM math is a thin
 * wrapper around `getAmountOut` from `experiments/cpmm.ts`.
 *
 * For a scenario that includes a `poolAddress` matching a known
 * Uniswap V2 pair we read fresh reserves via `provider.call()` before
 * simulating.  If the call fails (or the address doesn't match a
 * curated pool, or no address is supplied), we fall back to the
 * CPMM math on the caller-supplied reserves.  This keeps the
 * deterministic path simple while still allowing the route to honour
 * live on-chain state when available.
 *
 * Per design spec §9.2.
 */
import { Interface, getAddress } from 'ethers';

import { POOLS } from '../chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI } from '../chain/abis.js';
import { upstreamUnreachable } from '../errors.js';
import type { ChainProvider } from '../chain/provider.js';
import { getAmountOut } from './cpmm.js';
import type { ExperimentResult, SandwichScenario } from './types.js';

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);

export interface SandwichExperimentResult extends Record<string, unknown> {
  attackerSpent: string;
  attackerReceived: string;
  attackerProfit: string;
  victimLoss: string;
  step1AmountOut: string;
  step2AmountOut: string;
  step3AmountOut: string;
  /** Alias of attackerProfit — kept for the frontend. */
  netProfit: string;
  /** True when the provider's call() succeeded and supplied reserves. */
  usedProvider: boolean;
  /** Optional V2 pool address that supplied the reserves (or undefined). */
  poolAddress?: string;
  feeHundredthsBip: number;
}

/**
 * Set of curated V2 pool addresses the implementation knows about.  We
 * look up the key by checksummed address and read reserves via the
 * canonical Uniswap V2 `getReserves()` selector.
 */
const KNOWN_V2_POOLS: ReadonlySet<string> = new Set(
  Object.values(POOLS)
    .filter((a) => a === POOLS.V2_WETH_USDC) // only V2 has reserves()
    .map((a) => getAddress(a).toLowerCase()),
);

/**
 * Try to read V2 reserves from the provider.  Returns `null` on any
 * failure so the caller can fall back to the supplied `reserve0/1`.
 */
async function readV2Reserves(
  provider: ChainProvider,
  poolAddress: string,
): Promise<{ reserve0: bigint; reserve1: bigint } | null> {
  try {
    const data = v2Iface.encodeFunctionData('getReserves', []);
    const raw = await provider.call({ to: poolAddress, data });
    const decoded = v2Iface.decodeFunctionResult('getReserves', raw);
    return {
      reserve0: BigInt(decoded[0]),
      reserve1: BigInt(decoded[1]),
    };
  } catch {
    return null;
  }
}

/**
 * Pure-CPMM 3-swap simulation.  Mirrors the frontend
 * `simulateSandwich` exactly so the deterministic path agrees with
 * the front-end.
 */
function simulateCPMM(
  reserve0: bigint,
  reserve1: bigint,
  victimAmountIn: bigint,
  attackerAmountIn: bigint,
  feeHundredthsBip: bigint,
): {
  attackerSpent: bigint;
  attackerReceived: bigint;
  attackerProfit: bigint;
  victimLoss: bigint;
  step1AmountOut: bigint;
  step2AmountOut: bigint;
  step3AmountOut: bigint;
} {
  if (reserve0 <= 0n || reserve1 <= 0n) throw new Error('INSUFFICIENT_LIQUIDITY');
  if (victimAmountIn <= 0n) throw new Error('INSUFFICIENT_VICTIM_AMOUNT');
  if (attackerAmountIn < 0n) throw new Error('INSUFFICIENT_ATTACKER_AMOUNT');

  if (attackerAmountIn === 0n) {
    return {
      attackerSpent: 0n,
      attackerReceived: 0n,
      attackerProfit: 0n,
      victimLoss: 0n,
      step1AmountOut: 0n,
      step2AmountOut: 0n,
      step3AmountOut: 0n,
    };
  }

  const step1AmountOut = getAmountOut(
    attackerAmountIn,
    reserve0,
    reserve1,
    feeHundredthsBip,
  );

  const r0AfterStep1 = reserve0 + attackerAmountIn;
  const r1AfterStep1 = reserve1 - step1AmountOut;
  const step2AmountOut = getAmountOut(
    victimAmountIn,
    r0AfterStep1,
    r1AfterStep1,
    feeHundredthsBip,
  );

  const r0AfterStep2 = r0AfterStep1 + victimAmountIn;
  const r1AfterStep2 = r1AfterStep1 - step2AmountOut;
  const step3AmountOut = getAmountOut(
    step1AmountOut,
    r1AfterStep2,
    r0AfterStep2,
    feeHundredthsBip,
  );

  // Baseline (no-sandwich) victim output for the loss computation.
  const baselineOut = getAmountOut(victimAmountIn, reserve0, reserve1, feeHundredthsBip);

  return {
    attackerSpent: attackerAmountIn,
    attackerReceived: step3AmountOut,
    attackerProfit: step3AmountOut - attackerAmountIn,
    victimLoss: baselineOut - step2AmountOut,
    step1AmountOut,
    step2AmountOut,
    step3AmountOut,
  };
}

/**
 * Run a sandwich simulation.  When the scenario includes a
 * `poolAddress` for a known V2 pool, reserves are read from the
 * provider first; on any failure we transparently fall back to the
 * caller-supplied reserves and set `usedProvider: false`.
 */
export async function runSandwichExperiment(
  provider: ChainProvider,
  scenario: SandwichScenario & { poolAddress?: string },
): Promise<ExperimentResult<SandwichExperimentResult>> {
  const start = Date.now();
  const { victimAmountIn, attackerAmountIn, fee } = scenario;

  let reserve0 = scenario.reserve0 ?? 0n;
  let reserve1 = scenario.reserve1 ?? 0n;
  let usedProvider = false;
  let poolAddress: string | undefined;

  if (scenario.poolAddress) {
    const lower = scenario.poolAddress.toLowerCase();
    if (KNOWN_V2_POOLS.has(lower)) {
      const observed = await readV2Reserves(provider, scenario.poolAddress);
      if (observed) {
        reserve0 = observed.reserve0;
        reserve1 = observed.reserve1;
        usedProvider = true;
        poolAddress = scenario.poolAddress;
      }
    }
  }

  let sim: ReturnType<typeof simulateCPMM>;
  try {
    sim = simulateCPMM(reserve0, reserve1, victimAmountIn, attackerAmountIn, BigInt(fee));
  } catch (err) {
    // Map CPMM validation errors to upstream_unreachable so the
    // route can return 502 (the chain layer's standard envelope).
    throw upstreamUnreachable((err as Error).message);
  }

  return {
    durationMs: Date.now() - start,
    result: {
      attackerSpent: sim.attackerSpent.toString(),
      attackerReceived: sim.attackerReceived.toString(),
      attackerProfit: sim.attackerProfit.toString(),
      victimLoss: sim.victimLoss.toString(),
      step1AmountOut: sim.step1AmountOut.toString(),
      step2AmountOut: sim.step2AmountOut.toString(),
      step3AmountOut: sim.step3AmountOut.toString(),
      netProfit: sim.attackerProfit.toString(),
      usedProvider,
      ...(poolAddress ? { poolAddress } : {}),
      feeHundredthsBip: fee,
    },
  };
}
