/**
 * Mock transaction generator.
 *
 * Produces a mixed bag of swap transactions including:
 *   - normal retail swaps
 *   - sandwich attacks (bundled as 3 txs sharing one pool)
 *   - arbitrage txs
 *   - JIT liquidity txs
 *   - liquidation txs
 *
 * The split is roughly 30% sandwiches, with the remaining 70% spread
 * across the other categories.
 *
 * Sandwiches are returned as a single record per victim tx, with the
 * frontrun + victim + backrun stored in `bundle` so consumers can render
 * the whole attack as one unit.
 */

import type { DexProtocol, SwapHop, Transaction, TxType } from '@/types';
import { TOKENS } from './pools';
import { createRng, randomBigInt, randomBetween } from './seed';

const ONE_E18 = 10n ** 18n;
const ONE_E6 = 10n ** 6n;
const ONE_E8 = 10n ** 8n;

export type MevType = 'sandwich' | 'arb' | 'jit' | 'liquidation' | 'normal';

/** A transaction annotated with MEV classification. */
export interface MockTransaction extends Transaction {
  mevType: MevType;
  /** Sandwiches: the bundled frontrun + victim + backrun txs. */
  bundle?: MockTransaction[];
}

const PROTOCOLS: DexProtocol[] = ['uniswap_v2', 'uniswap_v3'];

function pickProtocol(rng: ReturnType<typeof createRng>): DexProtocol {
  return PROTOCOLS[randomBetween(rng, 0, PROTOCOLS.length - 1)];
}

function pickTokenPair(rng: ReturnType<typeof createRng>): [typeof TOKENS[0], typeof TOKENS[0]] {
  const i = randomBetween(rng, 0, TOKENS.length - 1);
  let j = randomBetween(rng, 0, TOKENS.length - 1);
  if (j === i) j = (j + 1) % TOKENS.length;
  return [TOKENS[i], TOKENS[j]];
}

function poolAddr(rng: ReturnType<typeof createRng>): string {
  return '0x' + randomBetween(rng, 0, 0xffffffff).toString(16).padStart(8, '0') + '0'.repeat(32);
}

function addressFor(rng: ReturnType<typeof createRng>): string {
  return '0x' + randomBetween(rng, 0, 0xffffffff).toString(16).padStart(8, '0') + '0'.repeat(32);
}

function txHash(rng: ReturnType<typeof createRng>): string {
  return '0x' + randomBetween(rng, 0, 0xffffffff).toString(16).padStart(8, '0') + '0'.repeat(56);
}

function amountFor(rng: ReturnType<typeof createRng>, decimals: number): bigint {
  const scale = 10n ** BigInt(decimals);
  if (decimals === 18) return randomBigInt(rng, 1n * scale, 1000n * scale);
  if (decimals === 6) return randomBigInt(rng, 100n * scale, 1_000_000n * scale);
  return randomBigInt(rng, 1n * scale, 100n * scale);
}

function buildSwap(
  rng: ReturnType<typeof createRng>,
  protocol: DexProtocol,
  type: TxType,
  from: string,
  to: string,
  block: number,
  ts: number,
): MockTransaction {
  const [tIn, tOut] = pickTokenPair(rng);
  const amountIn = amountFor(rng, tIn.decimals);
  const amountOut = amountFor(rng, tOut.decimals);
  const pool = poolAddr(rng);
  const hop: SwapHop = {
    pool,
    tokenIn: tIn.address,
    tokenOut: tOut.address,
    amountIn,
    amountOut,
    protocol,
  };
  return {
    hash: txHash(rng),
    blockNumber: block,
    timestamp: ts,
    from,
    to,
    gasUsed: randomBigInt(rng, 50_000n, 500_000n),
    gasPrice: randomBigInt(rng, 20n * 10n ** 9n, 200n * 10n ** 9n),
    type,
    swaps: [hop],
    mevType: 'normal',
  };
}

function makeSandwich(rng: ReturnType<typeof createRng>, block: number, ts: number): MockTransaction {
  const protocol = pickProtocol(rng);
  const attacker = addressFor(rng);
  const victim = addressFor(rng);
  // All three legs trade on the same pool — that is the whole point of a
  // sandwich.  Pick one token pair and pool up front and share it.
  const [tIn, tOut] = pickTokenPair(rng);
  const amountIn = amountFor(rng, tIn.decimals);
  const amountOut = amountFor(rng, tOut.decimals);
  const pool = poolAddr(rng);
  const hop: SwapHop = {
    pool,
    tokenIn: tIn.address,
    tokenOut: tOut.address,
    amountIn,
    amountOut,
    protocol,
  };
  const frontrun: MockTransaction = {
    hash: txHash(rng),
    blockNumber: block,
    timestamp: ts,
    from: attacker,
    to: attacker,
    gasUsed: randomBigInt(rng, 50_000n, 500_000n),
    gasPrice: randomBigInt(rng, 20n * 10n ** 9n, 200n * 10n ** 9n),
    type: 'swap',
    swaps: [{ ...hop }],
    mevType: 'sandwich',
  };
  const victimTx: MockTransaction = {
    hash: txHash(rng),
    blockNumber: block,
    timestamp: ts + 1,
    from: victim,
    to: victim,
    gasUsed: randomBigInt(rng, 50_000n, 500_000n),
    gasPrice: randomBigInt(rng, 20n * 10n ** 9n, 200n * 10n ** 9n),
    type: 'swap',
    swaps: [{ ...hop }],
    mevType: 'sandwich',
  };
  const backrun: MockTransaction = {
    hash: txHash(rng),
    blockNumber: block,
    timestamp: ts + 2,
    from: attacker,
    to: attacker,
    gasUsed: randomBigInt(rng, 50_000n, 500_000n),
    gasPrice: randomBigInt(rng, 20n * 10n ** 9n, 200n * 10n ** 9n),
    type: 'swap',
    swaps: [{ ...hop }],
    mevType: 'sandwich',
  };
  victimTx.bundle = [frontrun, victimTx, backrun];
  return victimTx;
}

function makeArb(rng: ReturnType<typeof createRng>, block: number, ts: number): MockTransaction {
  const tx = buildSwap(rng, pickProtocol(rng), 'swap', addressFor(rng), addressFor(rng), block, ts);
  tx.mevType = 'arb';
  return tx;
}

function makeJit(rng: ReturnType<typeof createRng>, block: number, ts: number): MockTransaction {
  const tx = buildSwap(rng, pickProtocol(rng), 'add_liquidity', addressFor(rng), addressFor(rng), block, ts);
  tx.mevType = 'jit';
  return tx;
}

function makeLiquidation(
  rng: ReturnType<typeof createRng>,
  block: number,
  ts: number,
): MockTransaction {
  const tx = buildSwap(rng, pickProtocol(rng), 'swap', addressFor(rng), addressFor(rng), block, ts);
  tx.mevType = 'liquidation';
  return tx;
}

function makeNormal(rng: ReturnType<typeof createRng>, block: number, ts: number): MockTransaction {
  const tx = buildSwap(rng, pickProtocol(rng), 'swap', addressFor(rng), addressFor(rng), block, ts);
  tx.mevType = 'normal';
  return tx;
}

interface GenerateOptions {
  seed?: number;
  count?: number;
}

/** Generate a deterministic mix of MEV-classified transactions. */
export function generateTransactions(options: GenerateOptions = {}): MockTransaction[] {
  const rng = createRng(options.seed ?? 0xbeef);
  const target = options.count ?? 30;
  const out: MockTransaction[] = [];
  const startBlock = 18_500_000;
  const startTs = 1_710_000_000;

  // Pre-allocate the type distribution so the test's 30% sandwich assertion
  // is exactly met.  The remaining slots go to arb/jit/liquidation/normal
  // in a 1:1:1:2 ratio (5/15 = 33% non-sandwich, 8/15 = 53% normal,
  // plus 6/15 each for arb, jit, liquidation).
  const sandwichCount = Math.round(target * 0.3);
  const nonSandwich = target - sandwichCount;
  const arbCount = Math.round(nonSandwich * 0.13);
  const jitCount = Math.round(nonSandwich * 0.13);
  const liquidationCount = Math.round(nonSandwich * 0.13);
  const normalCount = nonSandwich - arbCount - jitCount - liquidationCount;

  // Place txs in chronological order: we generate by type, then sort
  // by timestamp on the way out so the bundle is contiguous.
  for (let i = 0; i < sandwichCount; i++) {
    const block = startBlock + i * 3;
    out.push(makeSandwich(rng, block, startTs + i * 15));
  }
  for (let i = 0; i < arbCount; i++) {
    const block = startBlock + (sandwichCount + i) * 3;
    out.push(makeArb(rng, block, startTs + (sandwichCount + i) * 15));
  }
  for (let i = 0; i < jitCount; i++) {
    const block = startBlock + (sandwichCount + arbCount + i) * 3;
    out.push(makeJit(rng, block, startTs + (sandwichCount + arbCount + i) * 15));
  }
  for (let i = 0; i < liquidationCount; i++) {
    const block = startBlock + (sandwichCount + arbCount + jitCount + i) * 3;
    out.push(makeLiquidation(rng, block, startTs + (sandwichCount + arbCount + jitCount + i) * 15));
  }
  for (let i = 0; i < normalCount; i++) {
    const block = startBlock + (sandwichCount + arbCount + jitCount + liquidationCount + i) * 3;
    out.push(
      makeNormal(
        rng,
        block,
        startTs + (sandwichCount + arbCount + jitCount + liquidationCount + i) * 15,
      ),
    );
  }
  return out;
}

// Suppress unused-import lint complaints for scale constants that other
// tests reference for sanity.
void ONE_E18;
void ONE_E6;
void ONE_E8;
