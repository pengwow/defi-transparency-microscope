/**
 * Report store — drives the Report tab.
 *
 * State:
 *   - reportId:        string, default UUID-shaped
 *   - blockNumber:     number
 *   - attackerProfit:  bigint (wei)
 *   - victimLoss:      bigint
 *   - lpFee:           bigint
 *   - validatorTip:    bigint
 *   - protocolFee:     bigint
 *   - strategyBreakdown: 5 pie-chart slices
 *   - riskAxes:        5 radar axes
 *   - evmTrace:        6 EVM trace rows
 *
 * Actions:
 *   - setReportData(payload) — replaces all 10 fields at once
 *   - resetReport() — restores DEFAULT_REPORT
 */

import { create } from 'zustand';

export interface StrategySlice {
  label: string;
  value: number;
  color: string;
}

export interface RiskAxis {
  label: string;
  value: number;
  max: number;
}

export interface TraceOp {
  pc: number;
  opcode: string;
  gas: number;
  stack: string;
  desc: string;
}

export interface ReportPayload {
  reportId: string;
  blockNumber: number;
  attackerProfit: bigint;
  victimLoss: bigint;
  lpFee: bigint;
  validatorTip: bigint;
  protocolFee: bigint;
  strategyBreakdown: StrategySlice[];
  riskAxes: RiskAxis[];
  evmTrace: TraceOp[];
}

export interface ReportState extends ReportPayload {
  setReportData: (payload: ReportPayload) => void;
  resetReport: () => void;
}

/**
 * Default UUID-shaped id used when no payload has been loaded yet.
 * Falls back to a stable constant in environments without
 * `crypto.randomUUID` (e.g. older jsdom in some CI configs).
 */
function defaultReportId(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // fall through
  }
  return 'rpt-00000000-0000-4000-8000-000000000000';
}

export const DEFAULT_REPORT: ReportPayload = {
  reportId: defaultReportId(),
  blockNumber: 0,
  attackerProfit: 0n,
  victimLoss: 0n,
  lpFee: 0n,
  validatorTip: 0n,
  protocolFee: 0n,
  strategyBreakdown: [],
  riskAxes: [],
  evmTrace: [],
};

export const useReportStore = create<ReportState>((set) => ({
  ...DEFAULT_REPORT,

  setReportData: (payload) =>
    set({
      reportId: payload.reportId,
      blockNumber: payload.blockNumber,
      attackerProfit: payload.attackerProfit,
      victimLoss: payload.victimLoss,
      lpFee: payload.lpFee,
      validatorTip: payload.validatorTip,
      protocolFee: payload.protocolFee,
      strategyBreakdown: [...payload.strategyBreakdown],
      riskAxes: [...payload.riskAxes],
      evmTrace: [...payload.evmTrace],
    }),

  resetReport: () => set({ ...DEFAULT_REPORT, reportId: defaultReportId() }),
}));
