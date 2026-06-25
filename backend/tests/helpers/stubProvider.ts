/**
 * In-memory `JsonRpcProvider` stand-in for unit tests.
 *
 * ethers v6 ships no `MockProvider`, so we spy on a real instance's
 * methods. Spying is preferable to subclassing because the abstract
 * `_send` / `_detectNetwork` plumbing is fragile and we don't need it —
 * the chain/* code only ever calls the high-level `getBlockNumber`,
 * `getLogs`, etc., which are easy to stub.
 */
import { JsonRpcProvider } from 'ethers';
import { vi, type MockInstance } from 'vitest';

export interface StubProviderOptions {
  blockNumber?: number;
  chainId?: number;
  balance?: bigint;
  logs?: unknown[];
  callResult?: string;
  block?: unknown;
  blockNull?: boolean;
  transaction?: unknown;
  transactionNull?: boolean;
}

export interface StubProviderHandle {
  provider: JsonRpcProvider;
  mocks: {
    getBlockNumber: MockInstance;
    getNetwork: MockInstance;
    getBalance: MockInstance;
    getLogs: MockInstance;
    call: MockInstance;
    getBlock: MockInstance;
    getTransaction: MockInstance;
  };
}

export function makeStubProvider(opts: StubProviderOptions = {}): StubProviderHandle {
  const provider = new JsonRpcProvider('http://localhost:0'); // never actually contacted

  const blockNumber = opts.blockNumber ?? 0x1234;
  const chainId = opts.chainId ?? 1;
  const balance = opts.balance ?? 1000n;
  const logs = opts.logs ?? [];
  const callResult = opts.callResult ?? '0x' + 'ab'.repeat(32);
  const block = opts.blockNull
    ? null
    : (opts.block ?? {
        number: 0x1234,
        hash: '0x' + '11'.repeat(32),
        parentHash: '0x' + '00'.repeat(32),
        timestamp: 0x65a0a1b2,
        gasLimit: 0x1c9c380n,
        gasUsed: 0x5208n,
        miner: '0x' + '22'.repeat(20),
        transactions: [],
      });
  const transaction = opts.transactionNull
    ? null
    : (opts.transaction ?? {
        hash: '0x' + 'ee'.repeat(32),
        blockHash: '0x' + '33'.repeat(32),
        blockNumber: 0x1234,
        from: '0x' + '44'.repeat(20),
        to: '0x' + '55'.repeat(20),
        value: 0n,
        gasLimit: 0x5208n,
        gasPrice: 0x3b9aca00n,
        nonce: 1,
        input: '0x',
        type: 2,
      });

  const mocks = {
    getBlockNumber: vi.spyOn(provider, 'getBlockNumber').mockResolvedValue(blockNumber),
    getNetwork: vi.spyOn(provider, 'getNetwork').mockResolvedValue({
      chainId: BigInt(chainId),
      name: 'mainnet',
      ensAddress: undefined,
    } as never),
    getBalance: vi.spyOn(provider, 'getBalance').mockResolvedValue(balance),
    getLogs: vi.spyOn(provider, 'getLogs').mockResolvedValue(logs as never),
    call: vi.spyOn(provider, 'call').mockResolvedValue(callResult),
    getBlock: vi.spyOn(provider, 'getBlock').mockResolvedValue(block as never),
    getTransaction: vi.spyOn(provider, 'getTransaction').mockResolvedValue(transaction as never),
  };

  return { provider, mocks };
}
