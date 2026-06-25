/**
 * Tests for `experiments/sandwich.ts` — sandwich attack simulation.
 *
 * Cases cover:
 *  - 5+ CPMM-fallback scenarios (provider is never called when the
 *    scenario carries explicit reserves; the implementation should
 *    always use CPMM in that case to stay deterministic).
 *  - Provider-backed simulation: a scenario with a `poolAddress`
 *    matching one of the curated pools triggers `provider.call()` for
 *    each step.  The implementation must read reserves via eth_call
 *    and then run the same CPMM math on the observed values.
 *  - Provider-call failure ⇒ fall back to CPMM.
 *  - Attacker profit / victim loss / breakdown shape.
 *  - Sandwich profit grows with attacker size up to a point.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Interface } from 'ethers';

import { runSandwichExperiment } from '../../src/experiments/sandwich.js';
import { POOLS } from '../../src/chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI } from '../../src/chain/abis.js';
import type { ChainProvider } from '../../src/chain/provider.js';

const ONE_E18 = 10n ** 18n;
const ONE_E21 = 10n ** 21n;

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);

function makeProvider(): ChainProvider {
  return {
    getBlockNumber: async () => 1,
    getNetwork: async () => ({ chainId: 1n, name: 'mainnet' }) as never,
    getChainId: async () => 1,
    getBalance: async () => 0n,
    call: vi.fn(async () => '0x'),
    getLogs: async () => [],
    getBlock: async () => null,
    getTransaction: async () => null,
  };
}

describe('experiments/sandwich — CPMM fallback scenarios', () => {
  it('scenario 1: balanced pool produces positive attacker profit', async () => {
    const provider = makeProvider();
    const r = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 10n ** 20n,
      fee: 3000,
    });
    expect(BigInt(r.result.attackerProfit as string)).toBeGreaterThan(0n);
    expect(r.result.usedProvider).toBe(false);
  });

  it('scenario 2: attackerProfit = step3.out - attackerAmountIn', async () => {
    const provider = makeProvider();
    const attackerIn = 10n ** 20n;
    const victimIn = 5n * 10n ** 19n;
    const r = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: victimIn,
      attackerAmountIn: attackerIn,
      fee: 3000,
    });
    const profit = BigInt(r.result.attackerProfit as string);
    const step3 = BigInt(r.result.step3AmountOut as string);
    expect(profit).toBe(step3 - attackerIn);
  });

  it('scenario 3: victim loss is positive when attacker is non-zero', async () => {
    const provider = makeProvider();
    const r = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 10n ** 20n,
      fee: 3000,
    });
    expect(BigInt(r.result.victimLoss as string)).toBeGreaterThan(0n);
  });

  it('scenario 4: zero attacker input ⇒ zero profit and zero step outs', async () => {
    const provider = makeProvider();
    const r = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 10n ** 18n,
      attackerAmountIn: 0n,
      fee: 3000,
    });
    expect(BigInt(r.result.attackerSpent as string)).toBe(0n);
    expect(BigInt(r.result.attackerReceived as string)).toBe(0n);
    expect(BigInt(r.result.attackerProfit as string)).toBe(0n);
    expect(BigInt(r.result.step1AmountOut as string)).toBe(0n);
    expect(BigInt(r.result.step2AmountOut as string)).toBe(0n);
    expect(BigInt(r.result.step3AmountOut as string)).toBe(0n);
  });

  it('scenario 5: throws on invalid reserves', async () => {
    const provider = makeProvider();
    await expect(
      runSandwichExperiment(provider, {
        reserve0: 0n,
        reserve1: ONE_E18,
        victimAmountIn: 1n,
        attackerAmountIn: 1n,
        fee: 3000,
      }),
    ).rejects.toThrow();
    await expect(
      runSandwichExperiment(provider, {
        reserve0: ONE_E18,
        reserve1: 0n,
        victimAmountIn: 1n,
        attackerAmountIn: 1n,
        fee: 3000,
      }),
    ).rejects.toThrow();
  });

  it('scenario 6: ETH/USDC-style mixed decimals (18 vs 6) still computes', async () => {
    const provider = makeProvider();
    // 80k ETH / 160M USDC = ~$320M pool. Use ~1% of pool for the
    // attacker/victim so the sandwich is meaningfully profitable
    // (smaller relative sizes leave the attacker worse off).
    const r = await runSandwichExperiment(provider, {
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * 10n ** 6n,
      victimAmountIn: 400n * ONE_E18,
      attackerAmountIn: 800n * ONE_E18,
      fee: 3000,
    });
    expect(BigInt(r.result.attackerProfit as string)).toBeGreaterThan(0n);
    expect(BigInt(r.result.victimLoss as string)).toBeGreaterThan(0n);
  });

  it('scenario 7: profitability grows with attacker size up to a point', async () => {
    const provider = makeProvider();
    const small = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 10n ** 19n,
      fee: 3000,
    });
    const medium = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 5n * 10n ** 19n,
      fee: 3000,
    });
    const s = BigInt(small.result.attackerProfit as string);
    const m = BigInt(medium.result.attackerProfit as string);
    // Larger attacker = more profit (within sane range) because the
    // back-run exploits the deeper price impact.
    expect(m).toBeGreaterThan(s);
  });
});

describe('experiments/sandwich — provider-backed simulation', () => {
  let provider: ChainProvider;

  beforeEach(() => {
    provider = makeProvider();
  });

  it('reads reserves from the provider for the V2 ETH/USDC pool', async () => {
    // Configure `call` to return a V2 getReserves payload.
    const reserve0 = 80_000n * ONE_E18;
    const reserve1 = 160_000_000n * 10n ** 6n;
    const encoded = v2Iface.encodeFunctionResult('getReserves', [
      reserve0,
      reserve1,
      1_700_000_000n,
    ]);
    (provider.call as ReturnType<typeof vi.fn>).mockResolvedValue(encoded);

    // 1% of pool — see CPMM scenario 6 for the math.
    const r = await runSandwichExperiment(provider, {
      poolAddress: POOLS.V2_WETH_USDC,
      victimAmountIn: 400n * ONE_E18,
      attackerAmountIn: 800n * ONE_E18,
      fee: 3000,
    });
    expect(r.result.usedProvider).toBe(true);
    expect(provider.call).toHaveBeenCalled();
    expect(BigInt(r.result.attackerProfit as string)).toBeGreaterThan(0n);
  });

  it('falls back to CPMM when provider.call() throws', async () => {
    (provider.call as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('rpc down'));
    const r = await runSandwichExperiment(provider, {
      poolAddress: POOLS.V2_WETH_USDC,
      reserve0: 80_000n * ONE_E18,
      reserve1: 160_000_000n * 10n ** 6n,
      victimAmountIn: 400n * ONE_E18,
      attackerAmountIn: 800n * ONE_E18,
      fee: 3000,
    });
    expect(r.result.usedProvider).toBe(false);
    expect(BigInt(r.result.attackerProfit as string)).toBeGreaterThan(0n);
  });

  it('falls back to CPMM when provider.call() returns a non-decodable blob', async () => {
    (provider.call as ReturnType<typeof vi.fn>).mockResolvedValue('0xdeadbeef');
    const r = await runSandwichExperiment(provider, {
      poolAddress: POOLS.V2_WETH_USDC,
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 10n ** 20n,
      fee: 3000,
    });
    expect(r.result.usedProvider).toBe(false);
  });

  it('attackerProfit can be negative when reserves are too thin (sanity)', async () => {
    const r = await runSandwichExperiment(provider, {
      reserve0: 10n ** 9n, // tiny pool
      reserve1: 10n ** 9n,
      victimAmountIn: 10n ** 18n, // huge victim trade
      attackerAmountIn: 10n ** 18n, // huge attacker
      fee: 3000,
    });
    // We don't assert a sign here — the test just confirms the run
    // completes and reports a numeric profit (no NaN, no throw).
    expect(typeof r.result.attackerProfit).toBe('string');
  });
});

describe('experiments/sandwich — result shape', () => {
  it('result contains all expected keys', async () => {
    const provider = makeProvider();
    const r = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 10n ** 20n,
      fee: 3000,
    });
    const keys = [
      'attackerSpent',
      'attackerReceived',
      'attackerProfit',
      'victimLoss',
      'step1AmountOut',
      'step2AmountOut',
      'step3AmountOut',
      'usedProvider',
      'netProfit',
    ];
    for (const k of keys) {
      expect(r.result).toHaveProperty(k);
    }
  });

  it('netProfit = step3.out - attackerAmountIn (alias of attackerProfit)', async () => {
    const provider = makeProvider();
    const r = await runSandwichExperiment(provider, {
      reserve0: ONE_E21,
      reserve1: ONE_E21,
      victimAmountIn: 5n * 10n ** 19n,
      attackerAmountIn: 10n ** 20n,
      fee: 3000,
    });
    const net = BigInt(r.result.netProfit as string);
    const profit = BigInt(r.result.attackerProfit as string);
    expect(net).toBe(profit);
  });
});
