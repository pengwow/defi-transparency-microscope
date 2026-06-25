/**
 * Log → TxType classifier.
 *
 * Pure functions: no I/O, no randomness, no Date.now. Same input → same
 * output. Tested without a real RPC.
 *
 * Spec §9.1: heuristics for sandwich / arbitrage / JIT are necessarily
 * approximate; the goal is to give the UI a useful "label" for a log
 * given a few decoded hints. We deliberately do NOT try to be a full
 * MEV inspector — the experiment layer in `experiments/*` does the
 * actual on-chain simulation.
 *
 * Precedence (highest first):
 *   liquidation > sandwich > arbitrage > jit > normal
 *
 * The classifier looks only at the log itself plus a small `Context`
 * object that the caller fills in. The caller (typically
 * `chain/transactions.ts`) decodes the log topics/data and the
 * transaction envelope to build that context — we keep the decoder
 * outside this file so the classifier stays cheap to test.
 */
import { id, type Log } from 'ethers';

import type { TxType } from './types.js';

/** Keccak-256 hashes of the events we recognise. Exported for tests + reuse. */
export const TOPIC_V2_SWAP = id('Swap(address,uint256,uint256,uint256,uint256,address)');
export const TOPIC_V2_SYNC = id('Sync(uint112,uint112)');
export const TOPIC_V3_SWAP = id(
  'Swap(address,address,int256,int256,uint160,uint128,int24)',
);
export const TOPIC_AAVE_LIQUIDATION_CALL = id(
  'LiquidationCall(address,address,address,uint256,uint256,address,bool,uint256,uint256,uint256,uint256,uint256)',
);

/**
 * Per-log hints supplied by the caller. Every field is optional; missing
 * fields are treated as "not a signal for that bucket".
 */
export interface ClassifyContext {
  /**
   * Absolute price impact of the swap, scaled by 1e18.
   *   0.5% impact → 5_000_000_000_000_000n
   * Anything strictly greater than 0.5% (5e15) is classified as
   * 'arbitrage' (when it's a V3 swap).
   */
  priceImpactE18?: bigint;

  /** Transaction gas price in wei. */
  gasPriceWei?: bigint;

  /**
   * True if the transaction's `from` address is the pool contract
   * itself (i.e. a router-aggregator path). False when `from` is a
   * contract or EOA that's not the pool.
   */
  isPoolContract?: boolean;

  /**
   * True if the same `from` address made a prior swap on the same pool
   * in this same block — strong sandwich signal.
   */
  sameSenderPriorSwap?: boolean;
}

/**
 * Heuristics constants — keep them here so tests can pin them and
 * callers don't need to know the magic numbers.
 */
export const ARBITRAGE_PRICE_IMPACT_E18 = 5_000_000_000_000_000n; // 0.5 %
export const JIT_GAS_PRICE_WEI = 200_000_000_000n; // 200 gwei

/**
 * Classify a single log into a TxType.
 *
 * Order of checks (see module docblock):
 *   1. Aave LiquidationCall topic           → 'liquidation'
 *   2. Same sender made a prior swap in block → 'sandwich'
 *   3. V3 swap with priceImpactE18 > 0.5%   → 'arbitrage'
 *   4. V3 swap from non-pool, gas ≥ 200 gwei → 'jit'
 *   5. anything else                          → 'normal'
 */
export function classifyLog(log: Log, context: ClassifyContext = {}): TxType {
  const topics = log.topics ?? [];
  if (topics.length === 0) return 'normal';

  // 1. Liquidations are unambiguous and beat every other signal.
  if (topics[0] === TOPIC_AAVE_LIQUIDATION_CALL) return 'liquidation';

  const isV2Swap = topics[0] === TOPIC_V2_SWAP;
  const isV3Swap = topics[0] === TOPIC_V3_SWAP;
  const isSwap = isV2Swap || isV3Swap;

  // 2. Sandwich: only meaningful for swaps.
  if (isSwap && context.sameSenderPriorSwap === true) return 'sandwich';

  // 3. Arbitrage: only V3 swaps can carry the priceImpact signal.
  if (
    isV3Swap &&
    context.priceImpactE18 !== undefined &&
    context.priceImpactE18 > ARBITRAGE_PRICE_IMPACT_E18
  ) {
    return 'arbitrage';
  }

  // 4. JIT: high-gas V3 swap from a non-pool contract.
  if (
    isV3Swap &&
    context.isPoolContract === false &&
    context.gasPriceWei !== undefined &&
    context.gasPriceWei >= JIT_GAS_PRICE_WEI
  ) {
    return 'jit';
  }

  return 'normal';
}

/**
 * Per-block bundle summary.
 *
 * Useful for the `classifyBundle` route handler and for the live
 * `/transactions` page footer ("this block: 3 sandwiches, 2 arbs,
 * 1 liquidation").
 */
export interface BundleSummary {
  sandwichCount: number;
  arbCount: number;
  jitCount: number;
  liquidationCount: number;
  normalCount: number;
}

/**
 * Classify a list of logs (typically all logs from a single block) and
 * return a histogram of TxTypes.
 *
 * The same `context` is applied to every log — in practice callers pass
 * the block-level price-impact and gas-price hints and rely on the
 * log-level V2/V3 topic to disambiguate.
 */
export function classifyBundle(logs: readonly Log[], context: ClassifyContext = {}): BundleSummary {
  const summary: BundleSummary = {
    sandwichCount: 0,
    arbCount: 0,
    jitCount: 0,
    liquidationCount: 0,
    normalCount: 0,
  };
  for (const log of logs) {
    const t = classifyLog(log, context);
    switch (t) {
      case 'sandwich':
        summary.sandwichCount += 1;
        break;
      case 'arbitrage':
        summary.arbCount += 1;
        break;
      case 'jit':
        summary.jitCount += 1;
        break;
      case 'liquidation':
        summary.liquidationCount += 1;
        break;
      default:
        summary.normalCount += 1;
        break;
    }
  }
  return summary;
}
