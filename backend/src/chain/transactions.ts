/**
 * chain/transactions.ts — recent block log scan.
 *
 * Spec §7.3:
 *   - Fetches logs from the last N blocks matching V2 Swap, V3 Swap, and
 *     Aave LiquidationCall topics.
 *   - For each unique transaction, fetches the full envelope via
 *     `provider.getTransaction(hash)` to populate gas price, input,
 *     nonce, etc.
 *   - Classifies via `classify.ts`.
 *   - Deduplicates by tx hash.
 *
 * Pure module: no global state. Caller passes the `ChainProvider`.
 */
import type { Log, TransactionResponse } from 'ethers';

import {
  classifyLog,
  TOPIC_AAVE_LIQUIDATION_CALL,
  TOPIC_V2_SWAP,
  TOPIC_V3_SWAP,
  type ClassifyContext,
} from './classify.js';
import { AAVE_V3_POOL, POOLS } from './addresses.js';
import type { ChainProvider } from './provider.js';
import type { Transaction } from './types.js';

const DEFAULT_BLOCKS = 10;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 200;
const MAX_BLOCK_RANGE = 200;

/** Options accepted by `listTransactions`. */
export interface ListTransactionsOptions {
  /** How many trailing blocks to scan. Default 10, max 200. */
  blocks?: number;
  /** Hard cap on returned transactions. Default 200. */
  limit?: number;
  /** Restrict to specific addresses (pool / aave pool). Default: all known. */
  addresses?: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  if (n < lo) return lo;
  if (n > hi) return hi;
  return n;
}

/**
 * Build the topic filter for "any of the three event types". We use a
 * single-element topics array — ethers' filter engine ORs siblings, so
 * `[TOPIC_X, TOPIC_Y, TOPIC_Z]` matches any of them. We pass them in
 * the [address, [topic0, topic0, topic0]] shape.
 */
function buildLogFilter(opts: {
  fromBlock: number;
  toBlock: number;
  addresses: string[];
}): { fromBlock: number; toBlock: number; address: string[]; topics: string[][] } {
  return {
    fromBlock: opts.fromBlock,
    toBlock: opts.toBlock,
    address: opts.addresses,
    topics: [[TOPIC_V2_SWAP, TOPIC_V3_SWAP, TOPIC_AAVE_LIQUIDATION_CALL]],
  };
}

/**
 * Map a (log, transaction) pair to a `Transaction` domain object. The
 * classification context is derived from the log's address (isPoolContract
 * is false by default — we only know it's a known pool if it's in our
 * curated list) and the gas price on the tx envelope.
 */
function buildTransaction(
  log: Log,
  tx: TransactionResponse,
  classifyCtx: ClassifyContext,
): Transaction {
  const type = classifyLog(log, classifyCtx);
  // ethers' TransactionResponse has gasPrice as bigint | null on EIP-1559;
  // we coerce to bigint and fall back to 0n.
  const gasPrice = tx.gasPrice ?? 0n;
  const result: Transaction = {
    hash: tx.hash,
    from: tx.from,
    to: tx.to ?? '0x',
    value: tx.value,
    gasPrice,
    gasLimit: tx.gasLimit,
    input: tx.data,
    nonce: tx.nonce,
    blockNumber: tx.blockNumber ?? log.blockNumber,
    timestamp: 0, // populated by the caller once we have a block timestamp
    type,
  };
  return result;
}

async function fetchBlockTimestamp(
  provider: ChainProvider,
  blockNumber: number,
): Promise<number> {
  try {
    const block = await provider.getBlock(blockNumber);
    return block?.timestamp ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch the recent transaction stream. See spec §7.3.
 */
export async function listTransactions(
  provider: ChainProvider,
  options: ListTransactionsOptions = {},
): Promise<Transaction[]> {
  const blocks = clamp(options.blocks ?? DEFAULT_BLOCKS, 1, MAX_BLOCK_RANGE);
  const limit = clamp(options.limit ?? DEFAULT_LIMIT, 1, MAX_LIMIT);

  const headBlock = await provider.getBlockNumber();
  const fromBlock = Math.max(0, headBlock - blocks + 1);
  const toBlock = headBlock;

  const addresses = options.addresses ?? [
    POOLS.V2_WETH_USDC,
    POOLS.V3_WETH_USDC_3000,
    POOLS.V3_WETH_USDT_3000,
    AAVE_V3_POOL,
  ];

  const filter = buildLogFilter({ fromBlock, toBlock, addresses });
  const logs: Log[] = await provider.getLogs(filter);

  // Deduplicate by tx hash, preserving first-seen order. A V3 swap
  // usually emits a single Swap log, but Mint+Burn can also fire from
  // the same tx — we want one Transaction per hash.
  const seenHash = new Set<string>();
  const dedupedLogs: Log[] = [];
  for (const log of logs) {
    if (seenHash.has(log.transactionHash)) continue;
    seenHash.add(log.transactionHash);
    dedupedLogs.push(log);
  }
  if (dedupedLogs.length === 0) return [];

  // Fan out one getTransaction call per unique hash, in parallel.
  const txResults = await Promise.all(
    dedupedLogs.map((log) => provider.getTransaction(log.transactionHash)),
  );

  // Cache block timestamps so we only do one getBlock per block number.
  const blockTimestamps = new Map<number, number>();
  const transactions: Transaction[] = [];
  for (let i = 0; i < dedupedLogs.length; i += 1) {
    const log = dedupedLogs[i];
    const tx = txResults[i];
    if (!tx) continue; // pruned / unknown hash — skip
    if (transactions.length >= limit) break;

    const blockNumber = tx.blockNumber ?? log.blockNumber;
    if (!blockTimestamps.has(blockNumber)) {
      blockTimestamps.set(blockNumber, await fetchBlockTimestamp(provider, blockNumber));
    }
    const gasPrice = tx.gasPrice ?? 0n;
    const classifyCtx: ClassifyContext = {
      gasPriceWei: gasPrice,
      // The "is pool contract" hint is conservative — if the log's
      // emitter isn't one of our curated pools, the from address
      // is treated as a non-pool contract.
      isPoolContract: addresses
        .map((a) => a.toLowerCase())
        .includes(log.address.toLowerCase()),
    };

    const t = buildTransaction(log, tx, classifyCtx);
    t.timestamp = blockTimestamps.get(blockNumber) ?? 0;
    transactions.push(t);
  }

  return transactions;
}
