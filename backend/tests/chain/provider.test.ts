/**
 * Tests for the ChainProvider abstraction and EthersChainProvider.
 *
 * ethers v6 has no built-in MockProvider, so we spy on a real
 * `JsonRpcProvider` instance via the `makeStubProvider` helper.
 */
import { describe, it, expect } from 'vitest';
import {
  Interface,
  type Block,
  type Filter,
  type Log,
  type TransactionRequest,
  type TransactionResponse,
} from 'ethers';
import { EthersChainProvider } from '../../src/chain/provider.js';
import { makeStubProvider } from '../helpers/stubProvider.js';

describe('EthersChainProvider', () => {
  describe('constructor', () => {
    it('stores the underlying ethers provider', () => {
      const { provider } = makeStubProvider();
      const cp = new EthersChainProvider(provider);
      expect(cp).toBeInstanceOf(EthersChainProvider);
    });

    it('exposes the raw provider via the `raw` getter', () => {
      const { provider } = makeStubProvider();
      const cp = new EthersChainProvider(provider);
      expect(cp.raw).toBe(provider);
    });
  });

  describe('getBlockNumber', () => {
    it('forwards to provider.getBlockNumber() and returns a number', async () => {
      const { provider, mocks } = makeStubProvider({ blockNumber: 19_500_000 });
      const cp = new EthersChainProvider(provider);
      const result = await cp.getBlockNumber();
      expect(result).toBe(19_500_000);
      expect(mocks.getBlockNumber).toHaveBeenCalled();
    });
  });

  describe('getBalance', () => {
    it('forwards the address to provider.getBalance() and returns bigint', async () => {
      const { provider, mocks } = makeStubProvider({ balance: 12345n });
      const cp = new EthersChainProvider(provider);
      const addr = '0x' + 'aa'.repeat(20);
      const result = await cp.getBalance(addr);
      expect(typeof result).toBe('bigint');
      expect(result).toBe(12345n);
      expect(mocks.getBalance).toHaveBeenCalled();
    });
  });

  describe('getChainId', () => {
    it('returns the network chainId as a number', async () => {
      const { provider, mocks } = makeStubProvider({ chainId: 1 });
      const cp = new EthersChainProvider(provider);
      const id = await cp.getChainId();
      expect(typeof id).toBe('number');
      expect(id).toBe(1);
      expect(mocks.getNetwork).toHaveBeenCalled();
    });

    it('works for non-mainnet chainIds (e.g. sepolia)', async () => {
      const { provider } = makeStubProvider({ chainId: 11155111 });
      const cp = new EthersChainProvider(provider);
      expect(await cp.getChainId()).toBe(11155111);
    });
  });

  describe('getNetwork', () => {
    it('returns the underlying network object', async () => {
      const { provider } = makeStubProvider();
      const cp = new EthersChainProvider(provider);
      const net = await cp.getNetwork();
      expect(Number(net.chainId)).toBe(1);
      expect(net.name).toBe('mainnet');
    });
  });

  describe('getLogs', () => {
    it('forwards the filter to provider.getLogs() and returns the logs', async () => {
      const sampleLog = {
        address: '0x' + '66'.repeat(20),
        blockHash: '0x' + '77'.repeat(32),
        blockNumber: 0x1233,
        data: '0x',
        topics: ['0x' + '88'.repeat(32)],
        transactionHash: '0x' + '99'.repeat(32),
        transactionIndex: 0,
        logIndex: 0,
        removed: false,
      };
      const { provider, mocks } = makeStubProvider({ logs: [sampleLog] });
      const cp = new EthersChainProvider(provider);
      const filter: Filter = { fromBlock: 0, toBlock: 10, address: '0x' + 'cc'.repeat(20) };
      const logs = await cp.getLogs(filter);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs).toHaveLength(1);
      expect(mocks.getLogs).toHaveBeenCalled();
    });

    it('returned logs have the expected fields', async () => {
      const sampleLog = {
        address: '0x' + '66'.repeat(20),
        blockHash: '0x' + '77'.repeat(32),
        blockNumber: 0x1233,
        data: '0x',
        topics: ['0x' + '88'.repeat(32)],
        transactionHash: '0x' + '99'.repeat(32),
        transactionIndex: 0,
        logIndex: 0,
        removed: false,
      };
      const { provider } = makeStubProvider({ logs: [sampleLog] });
      const cp = new EthersChainProvider(provider);
      const logs: Log[] = await cp.getLogs({ fromBlock: 0, toBlock: 1 });
      const log = logs[0];
      expect(typeof log.address).toBe('string');
      expect(typeof log.blockHash).toBe('string');
      expect(typeof log.blockNumber).toBe('number');
      expect(Array.isArray(log.topics)).toBe(true);
    });
  });

  describe('call', () => {
    it('forwards the transaction and returns the hex string', async () => {
      const { provider, mocks } = makeStubProvider({ callResult: '0xdeadbeef' });
      const cp = new EthersChainProvider(provider);
      const tx: TransactionRequest = { to: '0x' + 'dd'.repeat(20), data: '0x' };
      const result = await cp.call(tx);
      expect(result).toBe('0xdeadbeef');
      expect(mocks.call).toHaveBeenCalled();
    });
  });

  describe('getBlock', () => {
    it('forwards to provider.getBlock() and returns a Block-shaped object', async () => {
      const { provider, mocks } = makeStubProvider();
      const cp = new EthersChainProvider(provider);
      const block: null | Block = await cp.getBlock(0x1234);
      expect(block).not.toBeNull();
      expect(mocks.getBlock).toHaveBeenCalled();
    });

    it('returns null when the provider returns null', async () => {
      const { provider, mocks } = makeStubProvider({ blockNull: true });
      const cp = new EthersChainProvider(provider);
      const block = await cp.getBlock(0);
      expect(block).toBeNull();
      expect(mocks.getBlock).toHaveBeenCalled();
    });
  });

  describe('getTransaction', () => {
    it('forwards hash to provider.getTransaction() and returns TransactionResponse', async () => {
      const { provider, mocks } = makeStubProvider();
      const cp = new EthersChainProvider(provider);
      const tx: null | TransactionResponse = await cp.getTransaction('0x' + 'ee'.repeat(32));
      expect(tx).not.toBeNull();
      expect(mocks.getTransaction).toHaveBeenCalled();
    });

    it('returns null for unknown hashes', async () => {
      const { provider } = makeStubProvider({ transactionNull: true });
      const cp = new EthersChainProvider(provider);
      const tx = await cp.getTransaction('0xunknown');
      expect(tx).toBeNull();
    });
  });

  describe('abi decoding sanity (Interface.from)', () => {
    it('decodes a known ERC20 balanceOf call result with ethers Interface', () => {
      // sanity: the ABIs we expose should still parse via ethers Interface
      const iface = new Interface([
        'function balanceOf(address account) view returns (uint256)',
      ]);
      const result = iface.decodeFunctionResult('balanceOf', '0x' + '0a'.repeat(32));
      // The interface will decode this as a single bigint; ethers pads the
      // 0x0a... into a full 256-bit bigint. We just assert it's a bigint.
      expect(typeof result[0]).toBe('bigint');
    });
  });
});
