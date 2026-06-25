/**
 * In-memory implementation of the DataAPI contract.
 *
 * All data is generated lazily on first access from the `mocks/`
 * package, then cached.  A real backend implementation could replace
 * this class without touching consumers.
 */

import type {
  ExperimentResult,
  LendingPosition,
  Pool,
  Position,
  SandwichScenario,
} from '@/types';
import { generatePools } from '@/mocks/pools';
import { generateTransactions, type MockTransaction } from '@/mocks/transactions';
import { generatePositions } from '@/mocks/positions';
import {
  getAmountOut,
  newReservesAfterSwap,
  priceImpactE18,
  spotPriceE18,
} from '@/algorithms/cpmm';
import {
  simulateSandwich,
  type SandwichResult,
} from '@/algorithms/sandwich';
import { calculateV2IL, calculateV3IL } from '@/algorithms/il';
import {
  attributeProfit,
  type AttributionComponents,
  type AttributionResult,
} from '@/algorithms/attribution';
import type {
  DataAPI,
  ExperimentPreset,
  IlExperimentInput,
  AttributionExperimentInput,
} from './api';
import { listExperiments as listPresets, getExperiment as getPreset } from './experiments';

function summaryFromNumerics(rows: Array<Record<string, number>>): Record<string, number> {
  if (rows.length === 0) return { count: 0 };
  const out: Record<string, number> = { count: rows.length };
  const keys = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) keys.add(k);
  for (const k of keys) {
    const avg = rows.reduce((acc, r) => acc + (r[k] ?? 0), 0) / rows.length;
    out[k] = avg;
  }
  return out;
}

export class MockAPI implements DataAPI {
  private pools?: Pool[];
  private txs?: MockTransaction[];
  private positions?: { lending: LendingPosition[]; lp: Position[] };

  async listPools(): Promise<Pool[]> {
    if (!this.pools) this.pools = generatePools();
    return this.pools;
  }

  async listTransactions(): Promise<MockTransaction[]> {
    if (!this.txs) this.txs = generateTransactions();
    return this.txs;
  }

  async listLendingPositions(): Promise<LendingPosition[]> {
    if (!this.positions) this.positions = generatePositions();
    return this.positions.lending;
  }

  async listLpPositions(): Promise<Position[]> {
    if (!this.positions) this.positions = generatePositions();
    return this.positions.lp;
  }

  async listExperiments(): Promise<ExperimentPreset[]> {
    return listPresets();
  }

  async getExperiment(id: string): Promise<ExperimentPreset> {
    return getPreset(id);
  }

  async runSandwichExperiment(scenario: SandwichScenario): Promise<ExperimentResult> {
    const t0 = performance.now();
    // Run a small jittered sweep so the summary has more than one sample.
    const results: SandwichResult[] = [];
    for (let i = 0; i < 5; i++) {
      const jitter = BigInt(i) * 10n ** 17n;
      results.push(
        simulateSandwich(
          scenario.reserve0 + jitter,
          scenario.reserve1,
          scenario.victimAmountIn,
          scenario.attackerAmountIn,
          BigInt(scenario.fee),
        ),
      );
    }
    const t1 = performance.now();
    return {
      config: {
        name: 'sandwich',
        protocol: 'uniswap_v2',
        reserve0: scenario.reserve0,
        reserve1: scenario.reserve1,
        fee: scenario.fee,
        runs: results.length,
      },
      results: results.map((r) => ({
        attackerProfit: Number(r.attackerProfit) / 1e18,
        victimLoss: Number(r.victimLoss) / 1e18,
      })),
      summary: summaryFromNumerics(
        results.map((r) => ({
          attackerProfit: Number(r.attackerProfit) / 1e18,
          victimLoss: Number(r.victimLoss) / 1e18,
        })),
      ),
      durationMs: t1 - t0,
    };
  }

  async runIlExperiment(input: IlExperimentInput): Promise<ExperimentResult> {
    const t0 = performance.now();
    // Reference price for context (not part of the formula).
    const initialPrice = spotPriceE18(input.reserve0, input.reserve1);
    void initialPrice;
    const ilV2 = calculateV2IL(input.priceRatio);
    const ilV3 = calculateV3IL(input.priceRatio, 0.1, 0.9);
    const t1 = performance.now();
    return {
      config: {
        name: 'il',
        protocol: 'uniswap_v2',
        reserve0: input.reserve0,
        reserve1: input.reserve1,
        fee: 3000,
        runs: 1,
      },
      results: [
        {
          ilV2: ilV2,
          ilV3: ilV3,
          priceRatio: input.priceRatio,
        },
      ],
      summary: { ilV2, ilV3 },
      durationMs: t1 - t0,
    };
  }

  async runAttributionExperiment(input: AttributionExperimentInput): Promise<ExperimentResult> {
    const t0 = performance.now();
    const amountOut = getAmountOut(input.amountIn, input.reserve0, input.reserve1);
    // Impact is the main "price impact" leg of attribution; treat fees as
    // the LP's take, gas as a constant fixed cost, and rebates as 0 for
    // a vanilla mainnet V2 pool (no MEV-blocker, no token rewards).
    const impact = priceImpactE18(input.amountIn, input.reserve0, input.reserve1);
    const fees = (input.amountIn * BigInt(input.fee)) / 1_000_000n;
    const gas = 50_000n * 30n * 10n ** 9n; // 50k gas * 30 gwei
    void newReservesAfterSwap(input.amountIn, amountOut, input.reserve0, input.reserve1);
    const components: AttributionComponents = {
      priceImpact: impact,
      fees,
      gasCost: gas,
      rebates: 0n,
    };
    const r: AttributionResult = attributeProfit(components);
    const t1 = performance.now();
    return {
      config: {
        name: 'attribution',
        protocol: 'uniswap_v2',
        reserve0: input.reserve0,
        reserve1: input.reserve1,
        fee: input.fee,
        runs: 1,
      },
      results: [
        {
          totalE18: Number(r.total) / 1e18,
          priceImpact: Number(r.breakdown.priceImpact) / 1e18,
          fees: Number(r.breakdown.fees) / 1e18,
          gasCost: Number(r.breakdown.gasCost) / 1e18,
          rebates: Number(r.breakdown.rebates) / 1e18,
        },
      ],
      summary: { totalE18: Number(r.total) / 1e18 },
      durationMs: t1 - t0,
    };
  }
}
