/**
 * Tests for chain/classify.ts — heuristic log → TxType classifier.
 *
 * Spec §9.1 defines the heuristic:
 *   - topic matches Aave LiquidationCall              → 'liquidation'
 *   - V3 swap with price impact > 0.5%                → 'arbitrage'
 *   - two consecutive same-pool swaps from the same
 *     `from` address within the same block (sandwich)  → 'sandwich'
 *   - V3 swap from non-pool contract with high gas    → 'jit'
 *   - default                                         → 'normal'
 *
 * classifyLog is pure and takes a single log + an optional context
 * (containing gas price, swap amount, decoded prices, etc.).
 * classifyBundle is the block-level summariser used by the
 * `/transactions` route.
 */
import { describe, it, expect } from 'vitest';
import { id, type Log } from 'ethers';
import {
  classifyLog,
  classifyBundle,
  TOPIC_V2_SWAP,
  TOPIC_V3_SWAP,
  TOPIC_AAVE_LIQUIDATION_CALL,
} from '../../src/chain/classify.js';

const POOL_V2 = '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc';
const POOL_V3_USDC = '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640';

function makeLog(overrides: Partial<Log> = {}): Log {
  return {
    address: POOL_V3_USDC,
    blockHash: '0x' + 'aa'.repeat(32),
    blockNumber: 100,
    data: '0x',
    topics: [TOPIC_V3_SWAP],
    transactionHash: '0x' + 'bb'.repeat(32),
    transactionIndex: 0,
    index: 0,
    removed: false,
    ...overrides,
  } as Log;
}

describe('topic constants', () => {
  it('match the canonical keccak hashes', () => {
    expect(TOPIC_V2_SWAP).toBe(id('Swap(address,uint256,uint256,uint256,uint256,address)'));
    expect(TOPIC_V3_SWAP).toBe(
      id('Swap(address,address,int256,int256,uint160,uint128,int24)'),
    );
    expect(TOPIC_AAVE_LIQUIDATION_CALL).toBe(
      id(
        'LiquidationCall(address,address,address,uint256,uint256,address,bool,uint256,uint256,uint256,uint256,uint256)',
      ),
    );
  });
});

describe('classifyLog', () => {
  it('returns "liquidation" for an Aave LiquidationCall event', () => {
    const log = makeLog({
      address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      topics: [TOPIC_AAVE_LIQUIDATION_CALL],
    });
    expect(classifyLog(log)).toBe('liquidation');
  });

  it('returns "arbitrage" for a V3 swap with price impact > 0.5%', () => {
    const log = makeLog({ topics: [TOPIC_V3_SWAP] });
    // priceImpactE18 of 0.6% == 6e15 (because E18-scaled)
    const ctx = { priceImpactE18: 6_000_000_000_000_000n };
    expect(classifyLog(log, ctx)).toBe('arbitrage');
  });

  it('does NOT classify a V3 swap as arbitrage when price impact <= 0.5%', () => {
    const log = makeLog({ topics: [TOPIC_V3_SWAP] });
    const ctx = { priceImpactE18: 5_000_000_000_000_000n }; // exactly 0.5%
    // No sandwich pattern (single log) and no high-gas JIT marker → 'normal'
    expect(classifyLog(log, ctx)).toBe('normal');
  });

  it('returns "jit" for a V3 swap from a non-pool address with high gas price', () => {
    const log = makeLog({ topics: [TOPIC_V3_SWAP] });
    // high gas price (>= 200 gwei) and isPoolContract: false
    const ctx = {
      gasPriceWei: 250_000_000_000n,
      isPoolContract: false,
    };
    expect(classifyLog(log, ctx)).toBe('jit');
  });

  it('does NOT classify a V3 swap as JIT when the from address IS the pool contract', () => {
    const log = makeLog({ topics: [TOPIC_V3_SWAP] });
    const ctx = { gasPriceWei: 250_000_000_000n, isPoolContract: true };
    expect(classifyLog(log, ctx)).toBe('normal');
  });

  it('returns "sandwich" when a preceding swap from the same sender in the same block exists', () => {
    const log = makeLog({ topics: [TOPIC_V3_SWAP] });
    const ctx = { sameSenderPriorSwap: true };
    expect(classifyLog(log, ctx)).toBe('sandwich');
  });

  it('returns "normal" for a V2 swap without any sandwich/arb/jit signal', () => {
    const log = makeLog({
      address: POOL_V2,
      topics: [TOPIC_V2_SWAP],
    });
    expect(classifyLog(log)).toBe('normal');
  });

  it('returns "normal" for an unknown topic', () => {
    const log = makeLog({ topics: ['0x' + 'cd'.repeat(32)] });
    expect(classifyLog(log)).toBe('normal');
  });

  it('precedence: liquidation > sandwich > arbitrage > jit > normal', () => {
    // Aave LiquidationCall event: should win even if context also has
    // sandwich signal.
    const liqLog = makeLog({
      address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
      topics: [TOPIC_AAVE_LIQUIDATION_CALL],
    });
    const ctx = {
      sameSenderPriorSwap: true,
      priceImpactE18: 9_000_000_000_000_000n,
      gasPriceWei: 300_000_000_000n,
      isPoolContract: false,
    };
    expect(classifyLog(liqLog, ctx)).toBe('liquidation');
  });

  it('handles a log with no topics gracefully', () => {
    const log = makeLog({ topics: [] });
    expect(classifyLog(log)).toBe('normal');
  });
});

describe('classifyBundle', () => {
  it('returns zeros for an empty bundle', () => {
    expect(classifyBundle([])).toEqual({
      sandwichCount: 0,
      arbCount: 0,
      jitCount: 0,
      liquidationCount: 0,
      normalCount: 0,
    });
  });

  it('counts a single liquidation event', () => {
    const logs: Log[] = [
      makeLog({
        address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
        topics: [TOPIC_AAVE_LIQUIDATION_CALL],
      }),
    ];
    const result = classifyBundle(logs);
    expect(result.liquidationCount).toBe(1);
    expect(result.normalCount).toBe(0);
  });

  it('counts V3 swaps with price impact > 0.5% as arbitrage', () => {
    const logs: Log[] = [
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: '0x' + '01'.repeat(32) }),
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: '0x' + '02'.repeat(32) }),
    ];
    const result = classifyBundle(logs, { priceImpactE18: 6_000_000_000_000_000n });
    expect(result.arbCount).toBe(2);
  });

  it('counts V2 swaps with no other signal as normal', () => {
    const logs: Log[] = [
      makeLog({
        address: POOL_V2,
        topics: [TOPIC_V2_SWAP],
        transactionHash: '0x' + '03'.repeat(32),
      }),
      makeLog({
        address: POOL_V2,
        topics: [TOPIC_V2_SWAP],
        transactionHash: '0x' + '04'.repeat(32),
      }),
    ];
    const result = classifyBundle(logs);
    expect(result.normalCount).toBe(2);
  });

  it('aggregates a mixed bundle correctly', () => {
    const logs: Log[] = [
      // 2 arbitrage
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: '0x' + '11'.repeat(32) }),
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: '0x' + '12'.repeat(32) }),
      // 1 liquidation
      makeLog({
        address: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',
        topics: [TOPIC_AAVE_LIQUIDATION_CALL],
        transactionHash: '0x' + '13'.repeat(32),
      }),
      // 1 normal V2 swap
      makeLog({
        address: POOL_V2,
        topics: [TOPIC_V2_SWAP],
        transactionHash: '0x' + '14'.repeat(32),
      }),
    ];
    const result = classifyBundle(logs, { priceImpactE18: 6_000_000_000_000_000n });
    expect(result.arbCount).toBe(2);
    expect(result.liquidationCount).toBe(1);
    expect(result.normalCount).toBe(1);
    expect(result.sandwichCount).toBe(0);
    expect(result.jitCount).toBe(0);
  });

  it('produces a stable order: counts are integers >= 0', () => {
    const logs: Log[] = [
      makeLog({ topics: [TOPIC_V3_SWAP], transactionHash: '0x' + 'aa'.repeat(32) }),
      makeLog({
        address: POOL_V2,
        topics: [TOPIC_V2_SWAP],
        transactionHash: '0x' + 'bb'.repeat(32),
      }),
    ];
    const result = classifyBundle(logs);
    for (const v of Object.values(result)) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
