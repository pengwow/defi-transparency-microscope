/**
 * WebSocket topic enum and message union.
 *
 * Spec §8.2 / §8.3 define the protocol:
 *   - clients subscribe to a set of named topics
 *   - server emits typed `WSMessage` envelopes
 *
 * Keep this module pure (no I/O, no class instances) so it can be
 * imported from anywhere — route handler, broadcaster, tests, and the
 * future TypeScript-sharing with the frontend.
 */

/** Available WS topics. */
export enum WSTopic {
  Mempool = 'mempool',
  Liquidations = 'liquidations',
  AmmSync = 'amm_sync',
  BlockConfirm = 'block_confirm',
}

/** Cheap O(1) lookup of all valid topic strings. */
const ALL_TOPICS: ReadonlySet<string> = new Set<string>(Object.values(WSTopic));

/** Returns true when `s` matches one of the defined WSTopic values. */
export function isValidTopic(s: string): boolean {
  return ALL_TOPICS.has(s);
}

/**
 * Mempool transaction payload — one pending tx from the mempool source.
 * The shape mirrors the `Transaction` domain object minus blockNumber
 * (a mempool tx is by definition unconfirmed).
 */
export interface MempoolTxData {
  hash: string;
  from: string;
  to: string;
  value: bigint;
  gasPrice: bigint;
  input: string;
  type: 'normal' | 'sandwich' | 'arbitrage' | 'jit' | 'liquidation';
  timestamp: number;
}

/** Aave V3 liquidation payload. */
export interface LiquidationEventData {
  user: string;
  collateral: string;
  debt: string;
  hf: number;
  protocol: 'aave_v3';
  profit: bigint;
  txHash: string;
  blockNumber: number;
}

/** AMM sync payload (V2 Sync / V3 Swap reduction). */
export interface AmmSyncData {
  pool: string;
  reserve0: bigint;
  reserve1: bigint;
  price: number;
  blockNumber: number;
}

/** Per-block confirmation payload. */
export interface BlockConfirmData {
  number: number;
  timestamp: number;
  txCount: number;
  gasUsed: bigint;
}

/** Server-side error payload. */
export interface WSErrorData {
  message: string;
}

/**
 * Union of every server → client message shape.
 * Discriminate on `.type` at the consumer.
 */
export type WSMessage =
  | { type: 'mempool_tx'; data: MempoolTxData }
  | { type: 'liquidation_event'; data: LiquidationEventData }
  | { type: 'amm_sync'; data: AmmSyncData }
  | { type: 'block_confirm'; data: BlockConfirmData }
  | { type: 'error'; data: WSErrorData };
