/**
 * Service-layer types.
 *
 * The UI talks to the backend exclusively through the `DataAPI` interface
 * so the implementation can be swapped (mock vs. real fetch) without
 * touching components or stores.
 */

import type {
  ExperimentConfig,
  ExperimentResult,
  LendingPosition,
  Pool,
  Position,
  SandwichScenario,
} from '@/types';
import type { MockTransaction } from '@/mocks/transactions';

export interface IlExperimentInput {
  reserve0: bigint;
  reserve1: bigint;
  /** Ratio of new price to old price (e.g. 1.5 means price went 1.5x). */
  priceRatio: number;
}

export interface AttributionExperimentInput {
  reserve0: bigint;
  reserve1: bigint;
  amountIn: bigint;
  fee: number;
}

export interface ExperimentPreset {
  id: string;
  name: string;
  description: string;
  config: ExperimentConfig;
}

/**
 * The data API contract used by stores and components.
 * All methods are async so the same interface can serve real RPCs later.
 */
export interface DataAPI {
  listPools(): Promise<Pool[]>;
  listTransactions(): Promise<MockTransaction[]>;
  listLendingPositions(): Promise<LendingPosition[]>;
  listLpPositions(): Promise<Position[]>;
  listExperiments(): Promise<ExperimentPreset[]>;
  getExperiment(id: string): Promise<ExperimentPreset>;
  runSandwichExperiment(scenario: SandwichScenario): Promise<ExperimentResult>;
  runIlExperiment(input: IlExperimentInput): Promise<ExperimentResult>;
  runAttributionExperiment(input: AttributionExperimentInput): Promise<ExperimentResult>;
}
