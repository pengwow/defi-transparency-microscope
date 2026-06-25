/**
 * Public-RPC fallback selector.
 *
 * The design spec §5.3 says: at startup, if `RPC_URL` is unset, probe the
 * built-in list of public RPCs and pick the first that responds within 3s.
 *
 * Implementation: we wrap the probe in a helper that accepts an
 * injectable `createProvider` factory so the same code path can be unit
 * tested without hitting the real network.
 */
import { JsonRpcProvider } from 'ethers';

export const DEFAULT_PUBLIC_RPCS: readonly string[] = [
  'https://eth.llamarpc.com',
  'https://cloudflare-eth.com',
  'https://rpc.ankr.com/eth',
];

export const DEFAULT_TIMEOUT_MS = 3_000;

export interface PickBestRpcOptions {
  /** Per-URL probe timeout in milliseconds. Default 3000. */
  timeoutMs?: number;
  /**
   * Factory for building a `JsonRpcProvider` from a URL. Injected to
   * keep tests offline. Defaults to `new JsonRpcProvider(url)`.
   */
  createProvider?: (url: string) => JsonRpcProvider;
}

const defaultCreateProvider = (url: string): JsonRpcProvider => new JsonRpcProvider(url);

/** Run a probe with a hard timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout probing ${label}`)), ms);
    void promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e instanceof Error ? e : new Error(String(e)));
      });
  });
}

/**
 * Probe each URL in order and return the first one that responds with a
 * block number within `timeoutMs`. Throws if every URL fails or times
 * out.
 */
export async function pickBestRpc(
  urls: readonly string[],
  opts: PickBestRpcOptions = {},
): Promise<string> {
  if (urls.length === 0) {
    throw new Error('pickBestRpc: no URLs provided');
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const createProvider = opts.createProvider ?? defaultCreateProvider;

  const errors: string[] = [];
  for (const url of urls) {
    try {
      const provider = createProvider(url);
      await withTimeout(provider.getBlockNumber(), timeoutMs, url);
      return url;
    } catch (err) {
      errors.push(`${url}: ${(err as Error).message}`);
    }
  }
  throw new Error(`pickBestRpc: all RPCs failed: ${errors.join('; ')}`);
}
