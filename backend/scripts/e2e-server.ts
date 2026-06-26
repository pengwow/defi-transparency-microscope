/**
 * E2E server — boots a real Fastify app on a configurable port with a
 * self-contained `ChainProvider` stub. Designed to be run from the
 * `test:integration` script in the frontend (or manually via
 * `pnpm e2e:server`).
 *
 * No live RPC is contacted. All `provider.call` / `getLogs` / etc. are
 * answered by hand-rolled stubs that return realistic-looking
 * ABI-encoded payloads so the existing route handlers + classifiers run
 * end-to-end. The frontend's `HttpAPI` then consumes the resulting JSON
 * via real HTTP — that is what the integration suite verifies.
 *
 * Env vars:
 *   - E2E_PORT (default 8765) — port to listen on
 *   - E2E_HOST (default 127.0.0.1) — host to bind to
 *   - E2E_LOG_LEVEL (default "warn") — pino log level
 *   - E2E_BLOCK_NUMBER (default 0x1234) — stub block number
 *   - E2E_CHAIN_ID (default 1) — stub chain id
 *
 * The process exits 0 on SIGINT/SIGTERM after Fastify closes.
 */
import {
  Interface,
  getAddress,
  type Block,
  type Log,
  type Network,
  type TransactionResponse,
} from 'ethers';

import {
  AAVE_V3_POOL,
  POOLS,
  TOKENS,
} from '../src/chain/addresses.js';
import { UNISWAP_V2_PAIR_ABI, UNISWAP_V3_POOL_ABI } from '../src/chain/abis.js';
import {
  TOPIC_V2_SWAP,
  TOPIC_V3_SWAP,
  TOPIC_AAVE_LIQUIDATION_CALL,
} from '../src/chain/classify.js';
import { buildServer } from '../src/server.js';
import type { ChainProvider } from '../src/chain/provider.js';

const v2Iface = new Interface(UNISWAP_V2_PAIR_ABI);
const v3Iface = new Interface(UNISWAP_V3_POOL_ABI);

function readNumber(env: string, fallback: number): number {
  const raw = process.env[env];
  if (!raw) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${env} must be finite, got: ${raw}`);
  return n;
}

const E2E_BLOCK_NUMBER = readNumber('E2E_BLOCK_NUMBER', 0x1234);
const E2E_CHAIN_ID = readNumber('E2E_CHAIN_ID', 1);
const E2E_PORT = readNumber('E2E_PORT', 8765);
const E2E_HOST = process.env.E2E_HOST ?? '127.0.0.1';
const E2E_LOG_LEVEL = process.env.E2E_LOG_LEVEL ?? 'warn';
const E2E_TIMESTAMP = readNumber('E2E_TIMESTAMP', 0x65a0a1b2);

/**
 * Self-contained ChainProvider stub. Each method recognises the call
 * shape it gets and answers with ABI-encoded hex / canned objects.
 */
function makeStubProvider(): ChainProvider {
  // Realistic-looking reserves / slot0 values.
  const V2_RESERVE0 = 200_000_000n * 10n ** 6n; // 200M USDC
  const V2_RESERVE1 = 80_000n * 10n ** 18n; // 80k WETH
  const V2_TIMESTAMP_LAST = E2E_TIMESTAMP & 0xffffffff;

  const V3_SQRT_PRICE_X96 = 79_228_162_514_264_337_593_543_950_336n; // ~sqrt(1) in X96
  const V3_TICK = 200_000;
  const V3_LIQUIDITY = 50_000_000_000_000_000_000_000n;

  function encodedV2GetReserves(): string {
    return v2Iface.encodeFunctionResult('getReserves', [
      V2_RESERVE0,
      V2_RESERVE1,
      V2_TIMESTAMP_LAST,
    ]);
  }

  function encodedV3Slot0(): string {
    return v3Iface.encodeFunctionResult('slot0', [
      V3_SQRT_PRICE_X96,
      V3_TICK,
      0, // observationIndex
      1, // observationCardinality
      1, // observationCardinalityNext
      0, // feeProtocol
      true, // unlocked
    ]);
  }

  function encodedV3Liquidity(): string {
    return v3Iface.encodeFunctionResult('liquidity', [V3_LIQUIDITY]);
  }

  function isV2Call(to: string | undefined): boolean {
    if (!to) return false;
    try {
      return getAddress(to) === getAddress(POOLS.V2_WETH_USDC);
    } catch {
      return false;
    }
  }

  function isV3Call(to: string | undefined): boolean {
    if (!to) return false;
    try {
      const t = getAddress(to);
      return (
        t === getAddress(POOLS.V3_WETH_USDC_3000) ||
        t === getAddress(POOLS.V3_WETH_USDT_3000)
      );
    } catch {
      return false;
    }
  }

  // Three synthetic logs (one V2 Swap, one V3 Swap, one Aave LiquidationCall)
  // so the transactions route has something to classify.
  const sampleHashV2 = '0x' + 'a1'.repeat(32);
  const sampleHashV3 = '0x' + 'b2'.repeat(32);
  const sampleHashLiq = '0x' + 'd4'.repeat(32);

  // `Log` is a class with private fields; we cast our plain objects via
  // `unknown` because the route layer only reads the data-shaped fields.
  const SAMPLE_LOGS: Log[] = ([
    {
      address: POOLS.V2_WETH_USDC,
      blockHash: '0x' + 'c3'.repeat(32),
      blockNumber: E2E_BLOCK_NUMBER,
      data: '0x' + '0'.repeat(256),
      index: 0,
      topics: [TOPIC_V2_SWAP],
      transactionHash: sampleHashV2,
      transactionIndex: 0,
      removed: false,
    },
    {
      address: POOLS.V3_WETH_USDC_3000,
      blockHash: '0x' + 'c3'.repeat(32),
      blockNumber: E2E_BLOCK_NUMBER,
      data: '0x' + '0'.repeat(256),
      index: 1,
      topics: [TOPIC_V3_SWAP],
      transactionHash: sampleHashV3,
      transactionIndex: 1,
      removed: false,
    },
    {
      address: AAVE_V3_POOL,
      blockHash: '0x' + 'c3'.repeat(32),
      blockNumber: E2E_BLOCK_NUMBER,
      data: '0x' + '0'.repeat(192),
      index: 2,
      topics: [TOPIC_AAVE_LIQUIDATION_CALL],
      transactionHash: sampleHashLiq,
      transactionIndex: 2,
      removed: false,
    },
  ] as unknown) as Log[];

  // `Block` is similarly a class with private fields. Cast through unknown.
  const SAMPLE_BLOCK = ({
    number: E2E_BLOCK_NUMBER,
    hash: '0x' + 'c3'.repeat(32),
    parentHash: '0x' + '00'.repeat(32),
    timestamp: E2E_TIMESTAMP,
    gasLimit: 30_000_000n,
    gasUsed: 12_000_000n,
    miner: '0x' + '22'.repeat(20),
    transactions: [],
    baseFeePerGas: 30_000_000_000n,
    nonce: '0x0000000000000000',
    difficulty: 0n,
    totalDifficulty: 0n,
    extraData: '0x',
    logsBloom: '0x' + '0'.repeat(512),
    sha3Uncles: '0x' + '0'.repeat(32),
    size: 0,
    uncles: [],
    receiptsRoot: '0x' + '0'.repeat(32),
    stateRoot: '0x' + '0'.repeat(32),
    transactionsRoot: '0x' + '0'.repeat(32),
  } as unknown) as Block;

  function makeTx(hash: string): TransactionResponse {
    return ({
      hash,
      blockHash: '0x' + 'c3'.repeat(32),
      blockNumber: E2E_BLOCK_NUMBER,
      from: '0x' + '44'.repeat(20),
      to: '0x' + '55'.repeat(20),
      value: 0n,
      gasLimit: 250_000n,
      gasPrice: 30_000_000_000n,
      nonce: 1,
      input: '0x',
      type: 2,
      chainId: BigInt(E2E_CHAIN_ID),
    } as unknown) as TransactionResponse;
  }

  return {
    async getBlockNumber() {
      return E2E_BLOCK_NUMBER;
    },
    async getNetwork(): Promise<Network> {
      return ({
        chainId: BigInt(E2E_CHAIN_ID),
        name: 'mainnet',
        ensAddress: undefined,
      } as unknown) as Network;
    },
    async getChainId() {
      return E2E_CHAIN_ID;
    },
    async getBalance() {
      return 1000n * 10n ** 18n;
    },
    async call({ to, data }) {
      const toStr: string | undefined = typeof to === 'string' ? to : undefined;
      if (isV2Call(toStr)) return encodedV2GetReserves();
      if (isV3Call(toStr)) {
        const sel = (data ?? '').slice(0, 10);
        if (sel === v3Iface.getFunction('slot0')!.selector) return encodedV3Slot0();
        if (sel === v3Iface.getFunction('liquidity')!.selector) return encodedV3Liquidity();
      }
      return '0x' + '0'.repeat(64);
    },
    async getLogs() {
      return SAMPLE_LOGS;
    },
    async getBlock() {
      return SAMPLE_BLOCK;
    },
    async getTransaction(hash: string) {
      return makeTx(hash);
    },
    async send() {
      return null;
    },
  };
}

async function main(): Promise<void> {
  const provider = makeStubProvider();
  const config = {
    rpcUrl: 'e2e://stub',
    rpcWsUrl: null,
    port: E2E_PORT,
    chainId: E2E_CHAIN_ID,
    logLevel: E2E_LOG_LEVEL,
    cacheTtlMs: 0,
    liquidationPollMs: 60_000,
    liquidationLookback: 5,
    ammSyncPollMs: 60_000,
    ammSyncLookback: 5,
    ammSyncDebounceMs: 50,
    // E2E runs on localhost; the Vite dev server (5173) and the
    // Node-side smoke harness both need to hit it.  Use the dev
    // defaults rather than `*` so the assertions match prod paths.
    corsOrigins: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    corsAllowAll: false,
  };
  const app = await buildServer({ config, provider });
  // Suppress unused-import lint: TOKENS is referenced so the curated
  // registry stays in scope if future e2e data needs a token symbol.
  void TOKENS;

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'e2e-server shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'e2e-server shutdown error');
      process.exit(1);
    }
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: E2E_PORT, host: E2E_HOST });
  // One-line banner so the integration test can grep for readiness.
  // eslint-disable-next-line no-console
  console.log(`[e2e-server] listening on http://${E2E_HOST}:${E2E_PORT}`);
}

void main();
