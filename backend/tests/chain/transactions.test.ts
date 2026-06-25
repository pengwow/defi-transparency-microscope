/**
 * Tests for chain/transactions.ts — listTransactions pulls logs from
 * the last N blocks and enriches them with the underlying transaction
 * envelope (gas price, input, nonce, etc.) and a TxType classification.
 */
import { describe, it, expect, vi } from 'vitest';
import type { Log, TransactionResponse } from 'ethers';
import { listTransactions } from '../../src/chain/transactions.js';
import { TOPIC_V2_SWAP, TOPIC_V3_SWAP } from '../../src/chain/classify.js';

function makeProvider(opts: {
  blockNumber: number;
  logs: Log[];
  txByHash: Map<string, TransactionResponse | null>;
  blockTimestamps?: Map<number, number>;
}) {
  const blockTimestamps = opts.blockTimestamps ?? new Map<number, number>([[100, 1700000000]]);
  return {
    getBlockNumber: vi.fn(async () => opts.blockNumber),
    getLogs: vi.fn(async (filter: { fromBlock: number; toBlock: number; topics?: unknown[] }) => {
      // Naive: return opts.logs if filter range covers the log block.
      return opts.logs.filter(
        (l) => l.blockNumber >= filter.fromBlock && l.blockNumber <= filter.toBlock,
      );
    }),
    getTransaction: vi.fn(async (hash: string) => {
      return opts.txByHash.get(hash) ?? null;
    }),
    getBlock: vi.fn(async (tag: number) => ({
      number: tag,
      hash: '0x' + '00'.repeat(32),
      parentHash: '0x' + '00'.repeat(32),
      timestamp: blockTimestamps.get(tag) ?? 1700000000,
      gasLimit: 0n,
      gasUsed: 0n,
      miner: '0x' + '00'.repeat(20),
      transactions: [],
    })),
  };
}

const AAVE_POOL = '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2';
const V2_POOL = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc';
const V3_POOL = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';
const TX_LIQ = '0x' + 'a1'.repeat(32);
const TX_V2 = '0x' + 'a2'.repeat(32);
const TX_V3 = '0x' + 'a3'.repeat(32);
const TOPIC_AAVE_LIQ = '0x1bfeb1aef4b3e33145cffddd62ce41edf6038b7b0372e76737c498bf28073c1a';

function makeLog(overrides: Partial<Log> = {}): Log {
  return {
    address: V3_POOL,
    blockHash: '0x' + 'bb'.repeat(32),
    blockNumber: 100,
    data: '0x',
    topics: [TOPIC_V3_SWAP],
    transactionHash: TX_V3,
    transactionIndex: 0,
    index: 0,
    removed: false,
    ...overrides,
  } as Log;
}

function makeTx(hash: string, from: string, to: string): TransactionResponse {
  return {
    hash,
    blockHash: '0x' + '00'.repeat(32),
    blockNumber: 100,
    from,
    to,
    value: 0n,
    gasLimit: 200000n,
    gasPrice: 50_000_000_000n,
    nonce: 7,
    input: '0xabcd',
    type: 2,
  } as unknown as TransactionResponse;
}

describe('listTransactions', () => {
  it('returns empty array when no logs match', async () => {
    const provider = makeProvider({ blockNumber: 100, logs: [], txByHash: new Map() });
    const txs = await listTransactions(provider as never, { blocks: 5, limit: 100 });
    expect(txs).toEqual([]);
  });

  it('deduplicates logs by transaction hash (same tx, two logs → 1 tx)', async () => {
    const tx = makeTx(TX_V3, '0x' + '11'.repeat(20), V3_POOL);
    const logs: Log[] = [
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: TX_V3, index: 0, blockNumber: 100 }),
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: TX_V3, index: 1, blockNumber: 100 }),
    ];
    const provider = makeProvider({
      blockNumber: 100,
      logs,
      txByHash: new Map([[TX_V3, tx]]),
    });
    const txs = await listTransactions(provider as never, { blocks: 5, limit: 100 });
    expect(txs).toHaveLength(1);
    expect(txs[0].hash).toBe(TX_V3);
    expect(provider.getTransaction).toHaveBeenCalledTimes(1);
  });

  it('returns mixed V2 swap, V3 swap, and Aave liquidation in correct shape', async () => {
    const liqTx = makeTx(TX_LIQ, '0x' + '88'.repeat(20), AAVE_POOL);
    const v2Tx = makeTx(TX_V2, '0x' + '77'.repeat(20), V2_POOL);
    const v3Tx = makeTx(TX_V3, '0x' + '66'.repeat(20), V3_POOL);
    const logs: Log[] = [
      makeLog({ address: AAVE_POOL, topics: [TOPIC_AAVE_LIQ], transactionHash: TX_LIQ, blockNumber: 100 }),
      makeLog({ address: V2_POOL, topics: [TOPIC_V2_SWAP], transactionHash: TX_V2, blockNumber: 100 }),
      makeLog({ address: V3_POOL, topics: [TOPIC_V3_SWAP], transactionHash: TX_V3, blockNumber: 100 }),
    ];
    const provider = makeProvider({
      blockNumber: 100,
      logs,
      txByHash: new Map([
        [TX_LIQ, liqTx],
        [TX_V2, v2Tx],
        [TX_V3, v3Tx],
      ]),
    });
    const txs = await listTransactions(provider as never, { blocks: 10, limit: 100 });
    expect(txs).toHaveLength(3);
    // Shape check
    for (const t of txs) {
      expect(typeof t.hash).toBe('string');
      expect(typeof t.from).toBe('string');
      expect(typeof t.gasPrice).toBe('bigint');
      expect(typeof t.gasLimit).toBe('bigint');
      expect(typeof t.nonce).toBe('number');
      expect(typeof t.timestamp).toBe('number');
      expect(typeof t.type).toBe('string');
    }
    // Classification
    const types = new Set(txs.map((t) => t.type));
    expect(types.has('liquidation')).toBe(true);
    expect(types.has('normal')).toBe(true);
  });

  it('respects the `limit` option and caps results', async () => {
    const hashes = Array.from({ length: 5 }, (_, i) => '0x' + (i + 1).toString(16).padStart(64, '0'));
    const logs: Log[] = hashes.map((h, i) =>
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: h, index: i }),
    );
    const txByHash = new Map<string, TransactionResponse | null>();
    for (const h of hashes) {
      txByHash.set(h, makeTx(h, '0x' + '11'.repeat(20), V3_POOL));
    }
    const provider = makeProvider({ blockNumber: 100, logs, txByHash });
    const txs = await listTransactions(provider as never, { blocks: 5, limit: 3 });
    expect(txs).toHaveLength(3);
  });

  it('skips transactions that the provider cannot fetch (null tx response)', async () => {
    const logs: Log[] = [
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: TX_V3 }),
    ];
    const provider = makeProvider({
      blockNumber: 100,
      logs,
      txByHash: new Map([[TX_V3, null]]), // simulate pruned / unknown tx
    });
    const txs = await listTransactions(provider as never, { blocks: 5, limit: 100 });
    expect(txs).toEqual([]);
  });

  it('queries a single block when blocks=1', async () => {
    const provider = makeProvider({ blockNumber: 50, logs: [], txByHash: new Map() });
    await listTransactions(provider as never, { blocks: 1, limit: 10 });
    expect(provider.getLogs).toHaveBeenCalledTimes(1);
    const arg = (provider.getLogs.mock.calls[0]![0] as { fromBlock: number; toBlock: number });
    expect(arg.toBlock - arg.fromBlock + 1).toBe(1);
  });

  it('returns Transaction objects that include timestamp and blockNumber', async () => {
    const tx = makeTx(TX_V3, '0x' + '11'.repeat(20), V3_POOL);
    const logs: Log[] = [makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: TX_V3 })];
    const provider = makeProvider({
      blockNumber: 100,
      logs,
      txByHash: new Map([[TX_V3, tx]]),
    });
    const [t] = await listTransactions(provider as never, { blocks: 5, limit: 10 });
    expect(t.blockNumber).toBe(100);
    expect(t.timestamp).toBeGreaterThan(0);
  });
});
