/**
 * Tests for ws/topics.ts — topic enum, message union, and topic validator.
 *
 * Spec §8.2/§8.3: the WS protocol uses a small set of topics (mempool,
 * liquidations, amm_sync, block_confirm) and a typed union of server-to-
 * client message shapes. `isValidTopic` is used by the route handler to
 * reject unknown topic names from clients.
 */
import { describe, it, expect } from 'vitest';

import {
  WSTopic,
  isValidTopic,
  type WSMessage,
} from '../../src/ws/topics.js';

describe('WSTopic enum', () => {
  it('exposes the four spec topics with the expected string values', () => {
    expect(WSTopic.Mempool).toBe('mempool');
    expect(WSTopic.Liquidations).toBe('liquidations');
    expect(WSTopic.AmmSync).toBe('amm_sync');
    expect(WSTopic.BlockConfirm).toBe('block_confirm');
  });
});

describe('isValidTopic', () => {
  it('returns true for every defined topic', () => {
    expect(isValidTopic('mempool')).toBe(true);
    expect(isValidTopic('liquidations')).toBe(true);
    expect(isValidTopic('amm_sync')).toBe(true);
    expect(isValidTopic('block_confirm')).toBe(true);
  });

  it('returns false for an unknown string', () => {
    expect(isValidTopic('not_a_topic')).toBe(false);
    expect(isValidTopic('MEMPOOL')).toBe(false); // case-sensitive
    expect(isValidTopic('')).toBe(false);
  });

  it('round-trips: WSTopic values are all valid topic strings', () => {
    for (const t of Object.values(WSTopic)) {
      expect(isValidTopic(t)).toBe(true);
    }
  });
});

describe('WSMessage union', () => {
  it('accepts a mempool_tx message shape', () => {
    const m: WSMessage = {
      type: 'mempool_tx',
      data: {
        hash: '0x' + 'ab'.repeat(32),
        from: '0x' + '11'.repeat(20),
        to: '0x' + '22'.repeat(20),
        value: 0n,
        gasPrice: 0n,
        input: '0x',
        type: 'normal',
        timestamp: 0,
      },
    };
    expect(m.type).toBe('mempool_tx');
    expect(m.data.hash).toHaveLength(66);
  });

  it('accepts a liquidation_event message shape', () => {
    const m: WSMessage = {
      type: 'liquidation_event',
      data: {
        user: '0x' + '11'.repeat(20),
        collateral: '0x' + 'aa'.repeat(20),
        debt: '0x' + 'bb'.repeat(20),
        hf: 0.95,
        protocol: 'aave_v3',
        profit: 0n,
        txHash: '0x' + 'cc'.repeat(32),
        blockNumber: 100,
      },
    };
    expect(m.type).toBe('liquidation_event');
    expect(m.data.hf).toBeLessThan(1);
  });

  it('accepts an amm_sync message shape', () => {
    const m: WSMessage = {
      type: 'amm_sync',
      data: {
        pool: '0x' + 'aa'.repeat(20),
        reserve0: 1000n,
        reserve1: 2000n,
        price: 2.0,
        blockNumber: 200,
      },
    };
    expect(m.type).toBe('amm_sync');
    expect(m.data.reserve0).toBeGreaterThan(0n);
  });

  it('accepts a block_confirm message shape', () => {
    const m: WSMessage = {
      type: 'block_confirm',
      data: {
        number: 100,
        timestamp: 1700000000,
        txCount: 200,
        gasUsed: 15_000_000n,
      },
    };
    expect(m.type).toBe('block_confirm');
    expect(m.data.number).toBe(100);
  });

  it('accepts an error message shape', () => {
    const m: WSMessage = {
      type: 'error',
      data: { message: 'something went wrong' },
    };
    expect(m.type).toBe('error');
    expect(m.data.message).toMatch(/something/);
  });
});
