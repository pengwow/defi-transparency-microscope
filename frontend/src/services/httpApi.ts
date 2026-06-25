/**
 * HTTP implementation of the DataAPI contract.
 *
 * Maps the 9 DataAPI methods to the backend's `/api/v1/*` REST routes
 * (see design spec §7).  The backend returns bigints as decimal strings
 * — this class rehydrates them to native `bigint` before returning so
 * the rest of the UI code can keep using `bigint` arithmetic.
 *
 * Response shape translation: the backend's domain objects differ from
 * the frontend's historical shapes (e.g. the backend's `Pool.id` is the
 * `Pool.address` the UI expects; backend `Transaction.gasLimit` is the
 * UI's `Transaction.gasUsed`).  Per-method `transform*` helpers adapt
 * the response into the shape `MockAPI` produces, so this class is a
 * drop-in replacement.
 *
 * Errors: any non-2xx response is surfaced as a typed `HttpApiError`
 * carrying the HTTP status and the server's `error` code.  Network
 * failures (fetch rejects) propagate unchanged.
 */

import type {
  DexProtocol,
  ExperimentConfig,
  ExperimentResult,
  Pool,
  Position,
  SandwichScenario,
} from '@/types';
import type { MockTransaction, MevType } from '@/mocks/transactions';
import type { LendingPosition } from '@/types';
import type {
  AttributionExperimentInput,
  DataAPI,
  ExperimentPreset,
  IlExperimentInput,
} from './api';

/** Optional constructor config. */
export interface HttpAPIOptions {
  /** Base URL for the backend, e.g. `http://localhost:8000`. No trailing slash required. */
  baseUrl: string;
  /** Default transaction query params. */
  defaultTxBlocks?: number;
  defaultTxLimit?: number;
}

/** Thrown for any non-2xx response.  Carries the HTTP status and the server's `error` code. */
export class HttpApiError extends Error {
  public readonly name = 'HttpApiError';
  public readonly status: number;
  public readonly code: string;
  public readonly body: unknown;

  constructor(status: number, code: string, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Backend's Transaction response shape.  Bigints arrive as decimal strings. */
interface BackendTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasLimit: string;
  input: string;
  nonce: number;
  blockNumber?: number;
  timestamp: number;
  type: 'normal' | 'sandwich' | 'arbitrage' | 'jit' | 'liquidation';
  mevProfit?: string;
  victimLoss?: string;
}

/** Backend's Pool response shape. */
interface BackendPool {
  id: string;
  protocol: 'uniswap_v2' | 'uniswap_v3';
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  reserve0?: string;
  reserve1?: string;
  sqrtPriceX96?: string;
  feeTier?: number;
  liquidity?: string;
  tick?: number;
}

/** Backend's LendingPosition shape. */
interface BackendLendingPosition {
  id: string;
  owner: string;
  protocol: 'aave_v3' | string;
  collateral: Record<string, string>;
  debt: Record<string, string>;
  liquidationThresholdE18: string;
  healthFactor?: number;
  timestamp: number;
}

/** Backend's LPPosition shape. */
interface BackendLpPosition {
  id: string;
  owner: string;
  poolId: string;
  token0: { address: string; symbol: string; decimals: number };
  token1: { address: string; symbol: string; decimals: number };
  amount0: string;
  amount1: string;
  tickLower: number;
  tickUpper: number;
  feeTier: number;
  apr: number;
  valueUsd: number;
  feeIncomeE18: string;
  impermanentLossE18: string;
  netPnlE18: string;
  liquidity?: string;
  timestamp: number;
}

/** Backend's ExperimentPreset shape. */
interface BackendExperimentPreset {
  id: string;
  name: string;
  description: string;
  config: {
    name: string;
    description?: string;
    protocol: DexProtocol;
    reserve0: string;
    reserve1: string;
    fee: number;
    tickLower?: number;
    tickUpper?: number;
    runs: number;
  };
}

/** Backend's ExperimentResult shape (note: `result`, not `results`). */
interface BackendExperimentResult<T = unknown> {
  durationMs: number;
  result: T;
}

function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

/** Rehydrate a decimal-string field into a bigint.  Returns 0n for empty/undefined. */
function toBig(v: string | number | bigint | undefined | null): bigint {
  if (v === undefined || v === null) return 0n;
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number') return BigInt(v);
  if (v === '') return 0n;
  return BigInt(v);
}

/** Convert a record of decimal strings to a record of bigints. */
function toBigRecord(r: Record<string, string> | undefined | null): Record<string, bigint> {
  const out: Record<string, bigint> = {};
  if (!r) return out;
  for (const [k, v] of Object.entries(r)) out[k] = BigInt(v);
  return out;
}

function transformPool(b: BackendPool): Pool {
  const protocol: DexProtocol = b.protocol;
  const type: Pool['type'] = protocol === 'uniswap_v2' ? 'constant_product' : 'concentrated';
  // The frontend expects `fee` on every pool; the backend only emits
  // `feeTier` for V3. Default to 0 for V2 (where the fee is in the
  // pool's own contract / not carried in this DTO).
  const fee = b.feeTier ?? 0;
  return {
    address: b.id,
    protocol,
    type,
    token0: { address: b.token0.address, symbol: b.token0.symbol, decimals: b.token0.decimals },
    token1: { address: b.token1.address, symbol: b.token1.symbol, decimals: b.token1.decimals },
    reserve0: toBig(b.reserve0),
    reserve1: toBig(b.reserve1),
    fee,
    ...(b.sqrtPriceX96 ? { sqrtPriceX96: toBig(b.sqrtPriceX96) } : {}),
    ...(b.tick !== undefined ? { tick: b.tick } : {}),
    blockNumber: 0,
    timestamp: 0,
  };
}

/** Map backend's high-level `type` (TxType) → the UI's MockTransaction.mevType. */
function txTypeToMevType(t: BackendTransaction['type']): MevType {
  switch (t) {
    case 'sandwich':
      return 'sandwich';
    case 'arbitrage':
      return 'arb';
    case 'jit':
      return 'jit';
    case 'liquidation':
      return 'liquidation';
    case 'normal':
    default:
      return 'normal';
  }
}

/**
 * Map the backend's MEV classification to the UI's TxType.  The
 * historical UI treats everything except JIT as a generic 'swap' —
 * only liquidity adds/removes are split out.
 */
function txTypeToUiType(t: BackendTransaction['type']): MockTransaction['type'] {
  return t === 'jit' ? 'add_liquidity' : 'swap';
}

function transformTransaction(b: BackendTransaction): MockTransaction {
  return {
    hash: b.hash,
    blockNumber: b.blockNumber ?? 0,
    timestamp: b.timestamp,
    from: b.from,
    to: b.to,
    gasUsed: toBig(b.gasLimit),
    gasPrice: toBig(b.gasPrice),
    type: txTypeToUiType(b.type),
    mevType: txTypeToMevType(b.type),
  };
}

function transformLending(b: BackendLendingPosition): LendingPosition {
  return {
    id: b.id,
    owner: b.owner,
    protocol: b.protocol,
    collateral: toBigRecord(b.collateral),
    debt: toBigRecord(b.debt),
    liquidationThresholdE18: toBig(b.liquidationThresholdE18),
    timestamp: b.timestamp,
  };
}

function transformLp(b: BackendLpPosition): Position {
  // The backend only emits V3 positions; map them onto the V3 shape.
  return {
    id: b.id,
    owner: b.owner,
    poolAddress: b.poolId,
    protocol: 'uniswap_v3',
    status: 'active',
    openedAt: b.timestamp,
    tickLower: b.tickLower,
    tickUpper: b.tickUpper,
    liquidity: toBig(b.liquidity ?? '0'),
    amount0: toBig(b.amount0),
    amount1: toBig(b.amount1),
    tokensOwed0: 0n,
    tokensOwed1: 0n,
  };
}

function transformExperimentConfig(c: BackendExperimentPreset['config']): ExperimentPreset['config'] {
  return {
    name: c.name,
    ...(c.description !== undefined ? { description: c.description } : {}),
    protocol: c.protocol,
    reserve0: toBig(c.reserve0),
    reserve1: toBig(c.reserve1),
    fee: c.fee,
    ...(c.tickLower !== undefined ? { tickLower: c.tickLower } : {}),
    ...(c.tickUpper !== undefined ? { tickUpper: c.tickUpper } : {}),
    runs: c.runs,
  };
}

function transformPreset(b: BackendExperimentPreset): ExperimentPreset {
  return {
    id: b.id,
    name: b.name,
    description: b.description,
    config: transformExperimentConfig(b.config),
  };
}

/** Convert bigint values in a request body to decimal strings. */
function stringifyBigints<T>(obj: T): T {
  if (typeof obj === 'bigint') return obj.toString() as unknown as T;
  if (Array.isArray(obj)) return obj.map(stringifyBigints) as unknown as T;
  if (obj && typeof obj === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out[k] = stringifyBigints(v);
    }
    return out as unknown as T;
  }
  return obj;
}

export class HttpAPI implements DataAPI {
  private readonly baseUrl: string;
  private readonly defaultTxBlocks: number;
  private readonly defaultTxLimit: number;

  constructor(opts: HttpAPIOptions) {
    this.baseUrl = stripTrailingSlash(opts.baseUrl);
    this.defaultTxBlocks = opts.defaultTxBlocks ?? 10;
    this.defaultTxLimit = opts.defaultTxLimit ?? 100;
  }

  /**
   * Low-level fetch wrapper.  Throws `HttpApiError` on non-2xx.
   * Returns the parsed JSON body (typed as `unknown`).
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: { 'content-type': 'application/json' },
    };
    if (body !== undefined) {
      init.body = JSON.stringify(stringifyBigints(body));
    }
    const resp = await fetch(url, init);
    if (!resp.ok) {
      let payload: { error?: string; message?: string } = {};
      try {
        payload = (await resp.json()) as { error?: string; message?: string };
      } catch {
        // Non-JSON body — keep the generic message.
      }
      throw new HttpApiError(
        resp.status,
        payload.error ?? 'http_error',
        payload.message ?? `HTTP ${resp.status}`,
        payload,
      );
    }
    return (await resp.json()) as T;
  }

  async listPools(): Promise<Pool[]> {
    const pools = await this.request<BackendPool[]>('GET', '/api/v1/pools');
    return pools.map(transformPool);
  }

  async listTransactions(): Promise<MockTransaction[]> {
    const qs = `?blocks=${this.defaultTxBlocks}&limit=${this.defaultTxLimit}`;
    const txs = await this.request<BackendTransaction[]>(
      'GET',
      `/api/v1/transactions${qs}`,
    );
    return txs.map(transformTransaction);
  }

  async listLendingPositions(): Promise<LendingPosition[]> {
    const positions = await this.request<BackendLendingPosition[]>(
      'GET',
      '/api/v1/lending-positions',
    );
    return positions.map(transformLending);
  }

  async listLpPositions(): Promise<Position[]> {
    const positions = await this.request<BackendLpPosition[]>(
      'GET',
      '/api/v1/lp-positions',
    );
    return positions.map(transformLp);
  }

  async listExperiments(): Promise<ExperimentPreset[]> {
    const presets = await this.request<BackendExperimentPreset[]>(
      'GET',
      '/api/v1/experiments',
    );
    return presets.map(transformPreset);
  }

  async getExperiment(id: string): Promise<ExperimentPreset> {
    const preset = await this.request<BackendExperimentPreset>(
      'GET',
      `/api/v1/experiments/${encodeURIComponent(id)}`,
    );
    return transformPreset(preset);
  }

  async runSandwichExperiment(scenario: SandwichScenario): Promise<ExperimentResult> {
    const raw = await this.request<BackendExperimentResult<{
      attackerSpent: string;
      attackerReceived: string;
      attackerProfit: string;
      victimLoss: string;
      step1AmountOut: string;
      step2AmountOut: string;
      step3AmountOut: string;
      netProfit: string;
      usedProvider: boolean;
      feeHundredthsBip: number;
    }>>('POST', '/api/v1/experiments/sandwich', { scenario });
    // Project the backend's `result` into the UI's results/summary shape.
    const r = raw.result;
    const attackerProfit = Number(BigInt(r.attackerProfit)) / 1e18;
    const victimLoss = Number(BigInt(r.victimLoss)) / 1e18;
    const step1AmountOut = Number(BigInt(r.step1AmountOut)) / 1e18;
    const step2AmountOut = Number(BigInt(r.step2AmountOut)) / 1e18;
    const step3AmountOut = Number(BigInt(r.step3AmountOut)) / 1e18;
    const config: ExperimentConfig = {
      name: 'sandwich',
      protocol: 'uniswap_v2' as DexProtocol,
      reserve0: scenario.reserve0,
      reserve1: scenario.reserve1,
      fee: scenario.fee,
      runs: 1,
    };
    const results: Array<Record<string, number>> = [
      { attackerProfit, victimLoss, step1AmountOut, step2AmountOut, step3AmountOut },
    ];
    const summary: Record<string, number> = {
      attackerProfit,
      victimLoss,
      count: 1,
    };
    return { config, results, summary, durationMs: raw.durationMs };
  }

  async runIlExperiment(input: IlExperimentInput): Promise<ExperimentResult> {
    const raw = await this.request<BackendExperimentResult<{
      il: number;
      variant: 'v2' | 'v3';
      reserve0: string;
      reserve1: string;
      priceRatio: number;
    }>>('POST', '/api/v1/experiments/il', {
      reserve0: input.reserve0,
      reserve1: input.reserve1,
      priceRatio: input.priceRatio,
    });
    const r = raw.result;
    const config: ExperimentConfig = {
      name: 'il',
      protocol: 'uniswap_v2' as DexProtocol,
      reserve0: input.reserve0,
      reserve1: input.reserve1,
      fee: 3000,
      runs: 1,
    };
    const results: Array<Record<string, number>> = [
      { il: r.il, priceRatio: r.priceRatio, variantV2: r.variant === 'v2' ? 1 : 0 },
    ];
    // The UI exposes the same IL value under both v2 and v3 summary
    // keys so the CompareView's three branches all read the same data.
    const summary: Record<string, number> = {
      ilV2: r.il,
      ilV3: r.il,
      il: r.il,
    };
    return { config, results, summary, durationMs: raw.durationMs };
  }

  async runAttributionExperiment(
    input: AttributionExperimentInput,
  ): Promise<ExperimentResult> {
    const raw = await this.request<BackendExperimentResult<{
      priceImpact: string;
      fees: string;
      gasCost: string;
      rebates: string;
      netPnl: string;
      percentages: { priceImpact: number; fees: number; gasCost: number; rebates: number };
      reserve0: string;
      reserve1: string;
      amountIn: string;
      feeHundredthsBip: number;
    }>>('POST', '/api/v1/experiments/attribution', {
      reserve0: input.reserve0,
      reserve1: input.reserve1,
      amountIn: input.amountIn,
      fee: input.fee,
    });
    const r = raw.result;
    const totalE18 = Number(BigInt(r.netPnl)) / 1e18;
    const priceImpact = Number(BigInt(r.priceImpact)) / 1e18;
    const fees = Number(BigInt(r.fees)) / 1e18;
    const gasCost = Number(BigInt(r.gasCost)) / 1e18;
    const rebates = Number(BigInt(r.rebates)) / 1e18;
    const config: ExperimentConfig = {
      name: 'attribution',
      protocol: 'uniswap_v2' as DexProtocol,
      reserve0: input.reserve0,
      reserve1: input.reserve1,
      fee: input.fee,
      runs: 1,
    };
    const results: Array<Record<string, number>> = [
      { totalE18, priceImpact, fees, gasCost, rebates },
    ];
    const summary: Record<string, number> = {
      totalE18,
      priceImpact,
      fees,
      gasCost,
      rebates,
    };
    return { config, results, summary, durationMs: raw.durationMs };
  }
}
