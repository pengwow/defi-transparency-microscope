/**
 * HttpAPI — REST backend implementation of the DataAPI contract.
 *
 * This class adapts the backend's JSON shapes (decimal-string bigints,
 * lowercase addresses) to the frontend's typed shapes (bigint reserves,
 * status buckets, V3-only LP positions, etc.).
 *
 * Bigint rehydration: any field that the consumer expects to be a
 * `bigint` arrives as a decimal string per spec §7.  The
 * `bigintOr` helper turns the string into a `bigint` (or returns a
 * caller-supplied fallback when the field is missing/empty).
 *
 * Error handling: any non-2xx response is converted into an
 * `HttpApiError` carrying the HTTP status and the backend's error code
 * (e.g. `not_found`, `internal`, `validation`).  404s are also exposed
 * as `HttpNotFoundError` so callers can branch on the type.
 */

import type {
  ExperimentConfig,
  ExperimentResult,
  LendingPosition,
  Pool,
  PoolToken,
  Position,
  SandwichScenario,
  TxType,
  DexProtocol,
} from '@/types';
import type { MockTransaction, MevType } from '@/mocks/transactions';
import type {
  AttributionExperimentInput,
  DataAPI,
  ExperimentPreset,
  IlExperimentInput,
} from './api';

/** Error thrown for any non-2xx response. */
export class HttpApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpApiError';
  }
}

/** Convenience subclass for 404 responses. */
export class HttpNotFoundError extends HttpApiError {
  constructor(message: string) {
    super(404, 'not_found', message);
    this.name = 'HttpNotFoundError';
  }
}

/** Shape the backend returns for a pool.  Mirrors `backend/src/chain/types.ts`. */
interface BackendPool {
  id: string;
  protocol: 'uniswap_v2' | 'uniswap_v3';
  token0: PoolToken;
  token1: PoolToken;
  reserve0?: string;
  reserve1?: string;
  sqrtPriceX96?: string;
  feeTier?: number;
  liquidity?: string;
  tick?: number;
}

/** Shape the backend returns for a transaction.  Mirrors `backend/src/chain/types.ts`. */
interface BackendTx {
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

/** Shape the backend returns for a lending position. */
interface BackendLending {
  id: string;
  owner: string;
  protocol: 'aave_v3';
  collateral: Record<string, string>;
  debt: Record<string, string>;
  liquidationThresholdE18: string;
  healthFactor: number;
  timestamp: number;
}

/** Shape the backend returns for an LP position. */
interface BackendLp {
  id: string;
  owner: string;
  poolId: string;
  token0: PoolToken;
  token1: PoolToken;
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
  timestamp: number;
}

const MEV_TYPE_MAP: Record<BackendTx['type'], MevType> = {
  arbitrage: 'arb',
  liquidation: 'liquidation',
  sandwich: 'sandwich',
  jit: 'jit',
  normal: 'normal',
};

/**
 * Map an MEV classification to a frontend TxType.  The backend doesn't
 * distinguish swap vs. add_liquidity / remove_liquidity so we default
 * to 'swap' for everything; the MEV type is preserved separately on
 * `mevType`.
 */
function mevToTxType(): TxType {
  return 'swap';
}

/** Derive a LendingPosition.status bucket from a numeric healthFactor. */
function statusFromHealthFactor(hf: number): LendingPosition['status'] {
  if (hf >= 2) return 'safe';
  if (hf >= 1.2) return 'warning';
  if (hf > 1) return 'danger';
  return 'liquidated';
}

/** Strip a trailing slash from a baseUrl so `${baseUrl}/api/v1/...` is canonical. */
function stripTrailingSlash(s: string): string {
  return s.endsWith('/') ? s.slice(0, -1) : s;
}

export class HttpAPI implements DataAPI {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch | undefined;

  constructor(baseUrl: string, fetchImpl?: typeof fetch) {
    this.baseUrl = stripTrailingSlash(baseUrl);
    this.fetchImpl = fetchImpl;
  }

  /**
   * Coerce a value (string | number | null | undefined) into a bigint.
   * Returns the supplied fallback when the value is nullish/empty or
   * unparseable.  Backend bigints are decimal strings per spec §7.
   */
  private bigintOr(value: unknown, fallback: bigint): bigint {
    if (value === null || value === undefined || value === '') return fallback;
    try {
      return BigInt(value as string | number | bigint);
    } catch {
      return fallback;
    }
  }

  /** Lowercase the keys of a `Record<string, string>` bigint map. */
  private lowercasedBigintMap(
    input: Record<string, string>,
  ): Record<string, bigint> {
    const out: Record<string, bigint> = {};
    for (const [k, v] of Object.entries(input)) {
      out[k.toLowerCase()] = this.bigintOr(v, 0n);
    }
    return out;
  }

  /**
   * Issue a JSON request and parse the response.  Non-2xx status is
   * converted into an `HttpApiError` (or `HttpNotFoundError` for 404).
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const init: RequestInit = { method, headers: { accept: 'application/json' } };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      (init.headers as Record<string, string>)['content-type'] = 'application/json';
    }
    // Use the injected fetch if one was provided, otherwise look up
    // `globalThis.fetch` at call time so test stubs that replace the
    // global fetch (via `vi.stubGlobal` or `globalThis.fetch = spy`)
    // are honoured.
    const fetchImpl = this.fetchImpl ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new HttpApiError(0, 'no_fetch', 'no fetch implementation available');
    }
    const res = await fetchImpl(url, init);
    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      const code = errBody.error ?? 'http_error';
      const message = errBody.message ?? `HTTP ${res.status}`;
      if (res.status === 404) throw new HttpNotFoundError(message);
      throw new HttpApiError(res.status, code, message);
    }
    return (await res.json()) as T;
  }

  // ---- DataAPI methods -------------------------------------------

  async listPools(): Promise<Pool[]> {
    const rows = await this.request<BackendPool[]>('GET', '/api/v1/pools');
    const now = Math.floor(Date.now() / 1000);
    return rows.map((p) => ({
      address: p.id,
      protocol: p.protocol as DexProtocol,
      type: p.protocol === 'uniswap_v3' ? 'concentrated' : 'constant_product',
      token0: p.token0,
      token1: p.token1,
      reserve0: this.bigintOr(p.reserve0, 0n),
      reserve1: this.bigintOr(p.reserve1, 0n),
      fee: p.feeTier ?? 3000,
      sqrtPriceX96:
        p.sqrtPriceX96 !== undefined
          ? this.bigintOr(p.sqrtPriceX96, 0n)
          : undefined,
      tick: p.tick,
      blockNumber: 0,
      timestamp: now,
    }));
  }

  async listTransactions(): Promise<MockTransaction[]> {
    const rows = await this.request<BackendTx[]>('GET', '/api/v1/transactions');
    return rows.map((t) => ({
      hash: t.hash,
      blockNumber: t.blockNumber ?? 0,
      timestamp: t.timestamp,
      from: t.from,
      to: t.to,
      gasUsed: this.bigintOr(t.gasLimit, 0n),
      gasPrice: this.bigintOr(t.gasPrice, 0n),
      type: mevToTxType(),
      mevType: MEV_TYPE_MAP[t.type],
    }));
  }

  async listLendingPositions(): Promise<LendingPosition[]> {
    const rows = await this.request<BackendLending[]>(
      'GET',
      '/api/v1/lending-positions',
    );
    return rows.map((p) => ({
      id: p.id,
      owner: p.owner,
      protocol: p.protocol,
      collateral: this.lowercasedBigintMap(p.collateral),
      debt: this.lowercasedBigintMap(p.debt),
      liquidationThresholdE18: this.bigintOr(p.liquidationThresholdE18, 0n),
      timestamp: p.timestamp,
      healthFactor: p.healthFactor,
      status: statusFromHealthFactor(p.healthFactor),
    }));
  }

  async listLpPositions(): Promise<Position[]> {
    const rows = await this.request<BackendLp[]>(
      'GET',
      '/api/v1/lp-positions',
    );
    return rows.map((p) => ({
      id: p.id,
      owner: p.owner,
      poolAddress: p.poolId,
      protocol: 'uniswap_v3' as const,
      status: 'active' as const,
      openedAt: p.timestamp - 30 * 86400,
      tickLower: p.tickLower,
      tickUpper: p.tickUpper,
      liquidity: 0n,
      amount0: this.bigintOr(p.amount0, 0n),
      amount1: this.bigintOr(p.amount1, 0n),
      tokensOwed0: 0n,
      tokensOwed1: 0n,
    }));
  }

  async listExperiments(): Promise<ExperimentPreset[]> {
    const rows = await this.request<ExperimentPreset[]>(
      'GET',
      '/api/v1/experiments',
    );
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      config: {
        ...p.config,
        reserve0: this.bigintOr(p.config.reserve0, 0n),
        reserve1: this.bigintOr(p.config.reserve1, 0n),
      },
    }));
  }

  async getExperiment(id: string): Promise<ExperimentPreset> {
    try {
      const p = await this.request<ExperimentPreset>(
        'GET',
        `/api/v1/experiments/${encodeURIComponent(id)}`,
      );
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        config: {
          ...p.config,
          reserve0: this.bigintOr(p.config.reserve0, 0n),
          reserve1: this.bigintOr(p.config.reserve1, 0n),
        },
      };
    } catch (err) {
      if (err instanceof HttpNotFoundError) {
        throw new Error(`UNKNOWN_EXPERIMENT: ${id}`);
      }
      throw err;
    }
  }

  async runSandwichExperiment(scenario: SandwichScenario): Promise<ExperimentResult> {
    const res = await this.request<{
      durationMs: number;
      result: {
        attackerProfit: string;
        victimLoss: string;
      };
    }>('POST', '/api/v1/experiments/sandwich', {
      scenario: {
        reserve0: scenario.reserve0.toString(),
        reserve1: scenario.reserve1.toString(),
        victimAmountIn: scenario.victimAmountIn.toString(),
        attackerAmountIn: scenario.attackerAmountIn.toString(),
        fee: scenario.fee,
      },
    });
    const attackerProfit = Number(BigInt(res.result.attackerProfit)) / 1e18;
    const victimLoss = Number(BigInt(res.result.victimLoss)) / 1e18;
    return {
      config: {
        name: 'sandwich',
        protocol: 'uniswap_v2',
        reserve0: scenario.reserve0,
        reserve1: scenario.reserve1,
        fee: scenario.fee,
        runs: 1,
      } satisfies ExperimentConfig,
      results: [{ attackerProfit, victimLoss }],
      summary: { attackerProfit, victimLoss },
      durationMs: res.durationMs,
    };
  }

  async runIlExperiment(input: IlExperimentInput): Promise<ExperimentResult> {
    const res = await this.request<{
      durationMs: number;
      result: { il: number; variant: 'v2' | 'v3'; priceRatio: number };
    }>('POST', '/api/v1/experiments/il', {
      reserve0: input.reserve0.toString(),
      reserve1: input.reserve1.toString(),
      priceRatio: input.priceRatio,
    });
    const il = res.result.il;
    return {
      config: {
        name: 'il',
        protocol: 'uniswap_v2',
        reserve0: input.reserve0,
        reserve1: input.reserve1,
        fee: 3000,
        runs: 1,
      } satisfies ExperimentConfig,
      results: [{ ilV2: il, ilV3: il, priceRatio: input.priceRatio }],
      summary: { ilV2: il, ilV3: il },
      durationMs: res.durationMs,
    };
  }

  async runAttributionExperiment(
    input: AttributionExperimentInput,
  ): Promise<ExperimentResult> {
    const res = await this.request<{
      durationMs: number;
      result: { netPnl: string };
    }>('POST', '/api/v1/experiments/attribution', {
      reserve0: input.reserve0.toString(),
      reserve1: input.reserve1.toString(),
      amountIn: input.amountIn.toString(),
      fee: input.fee,
    });
    const totalE18 = Number(BigInt(res.result.netPnl)) / 1e18;
    return {
      config: {
        name: 'attribution',
        protocol: 'uniswap_v2',
        reserve0: input.reserve0,
        reserve1: input.reserve1,
        fee: input.fee,
        runs: 1,
      } satisfies ExperimentConfig,
      results: [{ totalE18 }],
      summary: { totalE18 },
      durationMs: res.durationMs,
    };
  }
}
