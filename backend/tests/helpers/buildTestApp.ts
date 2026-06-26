/**
 * Test helper: build a Fastify app wired to a stub ethers provider.
 *
 * Wraps the ethers `JsonRpcProvider` from `makeStubProvider` in an
 * `EthersChainProvider` so it satisfies the `ChainProvider` interface
 * that `buildServer` requires. Tests can then mutate the returned
 * `stub.mocks.*` to control the chain layer's behavior.
 */
import { EthersChainProvider } from '../../src/chain/provider.js';
import { buildServer, type BuildServerOptions } from '../../src/server.js';
import { makeStubProvider, type StubProviderHandle, type StubProviderOptions } from './stubProvider.js';

export interface BuildTestAppOptions {
  /** Provider stub configuration forwarded to `makeStubProvider`. */
  stub?: StubProviderOptions;
  /** Override the WS health source. */
  wsHealth?: { isWebSocketConnected(): boolean };
  /** Override the chain id reported by /api/v1/health. */
  chainId?: number;
  /** Forward additional options to `buildServer` (config etc.). */
  server?: Omit<BuildServerOptions, 'provider' | 'wsHealth' | 'config'>;
}

export interface BuildTestAppResult {
  app: Awaited<ReturnType<typeof buildServer>>;
  stub: StubProviderHandle;
}

export async function buildTestApp(opts: BuildTestAppOptions = {}): Promise<BuildTestAppResult> {
  const stub = makeStubProvider(opts.stub ?? {});
  const provider = new EthersChainProvider(stub.provider);
  const wsHealth = opts.wsHealth ?? { isWebSocketConnected: () => false };
  const config = {
    rpcUrl: 'https://example.invalid',
    rpcWsUrl: null,
    port: 8000,
    chainId: opts.chainId ?? 1,
    logLevel: 'silent',
    cacheTtlMs: 5000,
    liquidationPollMs: 1000,
    liquidationLookback: 10,
    ammSyncPollMs: 1000,
    ammSyncLookback: 10,
    ammSyncDebounceMs: 50,
    // Tests don't need CORS gating; default to permissive wildcard so
    // route assertions are free of preflight noise.
    corsOrigins: ['*'],
    corsAllowAll: true,
  };
  const app = await buildServer({ config, provider, wsHealth, ...(opts.server ?? {}) });
  await app.ready();
  return { app, stub };
}
