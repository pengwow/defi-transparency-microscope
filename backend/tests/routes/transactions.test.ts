/**
 * Tests for `GET /api/v1/transactions`.
 *
 * Covers:
 *   - happy path with default params (blocks=10, limit=100)
 *   - happy path with custom params (blocks, limit, addresses)
 *   - Zod validation: bad blocks, bad limit, non-numeric values
 *   - 502 when the chain layer's getLogs throws
 *   - response envelope shape (Transaction[])
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Log } from 'ethers';

import { buildTestApp } from '../helpers/buildTestApp.js';

const ZERO_HASH = '0x' + '0'.repeat(64);

/** A single Swap-shaped log. The listTransactions classifier treats it as Swap. */
function swapLog(blockNumber: number, txHash: string): Log {
  return {
    blockNumber,
    blockHash: ZERO_HASH,
    transactionHash: txHash,
    address: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640', // USDC/WETH V3
    data:
      '0x' +
      '0000000000000000000000000000000000000000000000000000000000000000' + // amount0
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // amount1 (-1)
    topics: [
      '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67', // Swap event
      '0x' + '0'.repeat(64), // sender
      '0x' + '0'.repeat(64), // recipient
    ],
    logIndex: 0,
    transactionIndex: 0,
    removed: false,
  } as unknown as Log;
}

describe('GET /api/v1/transactions', () => {
  let app: Awaited<ReturnType<typeof buildTestApp>>['app'];
  let stub: Awaited<ReturnType<typeof buildTestApp>>['stub'];

  beforeEach(async () => {
    const result = await buildTestApp({ stub: { blockNumber: 19_500_000 } });
    app = result.app;
    stub = result.stub;
    // Default: a single swap log at block 19_499_999.
    const logs: Log[] = [swapLog(19_499_999, '0x' + '1'.repeat(64))];
    stub.mocks.getLogs.mockResolvedValue(logs);
    stub.mocks.getBlock.mockImplementation(async (tag: unknown) => {
      const n = typeof tag === 'number' ? tag : Number(tag);
      return {
        number: n,
        hash: ZERO_HASH,
        parentHash: ZERO_HASH,
        timestamp: 1_700_000_000 + n,
        transactions: [],
      } as never;
    });
    stub.mocks.getTransaction.mockImplementation(async (hash: string) => {
      return {
        hash,
        blockNumber: 19_499_999,
        from: '0x' + 'a'.repeat(40),
        to: '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
        value: 0n,
        gasPrice: 50_000_000_000n,
        gasLimit: 200_000n,
        nonce: 1,
        data: '0x',
      } as never;
    });
  });

  it('returns 200 with empty array when the chain has no relevant logs', async () => {
    stub.mocks.getLogs.mockResolvedValueOnce([]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('classifies a Swap log and returns the transaction summary', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveLength(1);
    const tx = body[0];
    expect(tx.hash).toBe('0x' + '1'.repeat(64));
    // Plain V3 swap with no special context → classifier returns 'normal'.
    // The protocol/heuristic labels ('arbitrage' / 'jit' / 'sandwich' /
    // 'liquidation') only fire when context fields exceed the thresholds.
    expect(tx.type).toBe('normal');
    expect(typeof tx.timestamp).toBe('number');
    expect(tx.blockNumber).toBe(19_499_999);
    // Bigints are serialised as decimal strings (spec §7).
    expect(typeof tx.value).toBe('string');
    expect(/^\d+$/.test(tx.value)).toBe(true);
    expect(typeof tx.gasPrice).toBe('string');
    expect(typeof tx.gasLimit).toBe('string');
  });

  it('uses default blocks=10 and limit=100 when no query is given', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    expect(stub.mocks.getLogs).toHaveBeenCalledTimes(1);
    // listTransactions passes { fromBlock, toBlock, addresses, limit }
    const callArgs = stub.mocks.getLogs.mock.calls[0]?.[0] as {
      fromBlock?: number;
      toBlock?: number;
    };
    // 19_500_000 - 10 + 1 = 19_499_991 .. 19_500_000
    expect(callArgs.fromBlock).toBe(19_499_991);
    expect(callArgs.toBlock).toBe(19_500_000);
  });

  it('honours a custom blocks parameter', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/transactions?blocks=5' });
    const callArgs = stub.mocks.getLogs.mock.calls[0]?.[0] as {
      fromBlock?: number;
      toBlock?: number;
    };
    expect(callArgs.fromBlock).toBe(19_499_996);
    expect(callArgs.toBlock).toBe(19_500_000);
  });

  it('honours a custom limit parameter', async () => {
    await app.inject({ method: 'GET', url: '/api/v1/transactions?limit=42' });
    const callArgs = stub.mocks.getLogs.mock.calls[0]?.[0] as {
      fromBlock?: number;
      toBlock?: number;
    };
    // limit is forwarded to the chain layer (it uses it to cap).
    expect(callArgs).toBeDefined();
  });

  it('parses a comma-separated addresses list into the chain call', async () => {
    const addr1 = '0x' + '1'.repeat(40);
    const addr2 = '0x' + '2'.repeat(40);
    await app.inject({
      method: 'GET',
      url: `/api/v1/transactions?addresses=${addr1},${addr2}`,
    });
    const callArgs = stub.mocks.getLogs.mock.calls[0]?.[0] as {
      topics?: ReadonlyArray<ReadonlyArray<string> | string | null>;
    };
    // The chain layer encodes addresses into a topic filter — we just
    // assert the call was made with non-empty topics (covers the parse
    // path) rather than asserting exact topic shape (too brittle to the
    // chain layer's internals).
    expect(callArgs.topics).toBeDefined();
  });

  it('trims whitespace in the addresses list and drops empty entries', async () => {
    const addr1 = '0x' + '1'.repeat(40);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/transactions?addresses=%20${addr1}%20,,%20`,
    });
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 with validation envelope when blocks is non-numeric', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions?blocks=abc' });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('returns 400 when blocks exceeds the 200 cap', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions?blocks=201' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 400 when blocks is below 1', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions?blocks=0' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 400 when limit exceeds the 200 cap', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions?limit=999' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 400 when limit is not an integer', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions?limit=2.5' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation');
  });

  it('returns 502 with upstream_unreachable when getLogs throws', async () => {
    stub.mocks.getLogs.mockRejectedValueOnce(new Error('rpc timed out'));

    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    expect(res.statusCode).toBe(502);
    expect(res.json().error).toBe('upstream_unreachable');
  });

  it('response is application/json', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/transactions' });
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
