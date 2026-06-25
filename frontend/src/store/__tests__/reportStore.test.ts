/**
 * Tests for the `reportStore` — drives the Report tab.
 *
 * State:
 *   - reportId:        string, default UUID
 *   - blockNumber:     number
 *   - attackerProfit:  bigint
 *   - victimLoss:      bigint
 *   - lpFee:           bigint
 *   - validatorTip:    bigint
 *   - protocolFee:     bigint
 *   - strategyBreakdown: 5 chart slices
 *   - riskAxes:          5 radar axes
 *   - evmTrace:          6 EVM trace rows
 *
 * Actions:
 *   - setReportData(payload) — replaces all fields at once
 *   - resetReport() — restores defaults
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
  useReportStore,
  DEFAULT_REPORT,
  type ReportPayload,
  type TraceOp,
} from '../reportStore';

const SAMPLE_EVM: TraceOp[] = [
  { pc: 0, opcode: 'CALL', gas: 21000, stack: '0x', desc: '外层调用' },
  { pc: 1, opcode: 'STATICCALL', gas: 5000, stack: '0x01', desc: '读池子' },
  { pc: 2, opcode: 'DELEGATECALL', gas: 8000, stack: '0x02', desc: '库调用' },
  { pc: 3, opcode: 'SSTORE', gas: 20000, stack: '0x03', desc: '写储备' },
  { pc: 4, opcode: 'MSTORE', gas: 100, stack: '0x04', desc: '写内存' },
  { pc: 5, opcode: 'LOG3', gas: 1500, stack: '0x05', desc: '事件' },
];

const SAMPLE_PAYLOAD: ReportPayload = {
  reportId: 'DTM-RPT-20260625-001',
  blockNumber: 22_180_543,
  attackerProfit: 1_240_500_000_000_000_000n,
  victimLoss: 456_200_000_000_000_000n,
  lpFee: 89_000_000_000_000_000n,
  validatorTip: 45_000_000_000_000_000n,
  protocolFee: 12_000_000_000_000_000n,
  strategyBreakdown: [
    { label: '三明治', value: 42, color: '#ff5e5e' },
    { label: '套利', value: 28, color: '#ffab40' },
    { label: 'JIT', value: 18, color: '#b388ff' },
    { label: '清算', value: 12, color: '#448aff' },
    { label: '前跑', value: 5, color: '#69f0ae' },
  ],
  riskAxes: [
    { label: '频率', value: 80, max: 100 },
    { label: '复杂度', value: 60, max: 100 },
    { label: '单笔利润', value: 90, max: 100 },
    { label: '防御难度', value: 75, max: 100 },
    { label: '检测难度', value: 50, max: 100 },
  ],
  evmTrace: SAMPLE_EVM,
};

describe('reportStore', () => {
  beforeEach(() => {
    useReportStore.getState().resetReport();
  });

  it('starts with default UUID-shaped reportId', () => {
    const id = useReportStore.getState().reportId;
    expect(typeof id).toBe('string');
    // Should look like a UUID (8-4-4-4-12 hex) OR the default fallback.
    expect(id.length).toBeGreaterThanOrEqual(8);
  });

  it('starts with empty bigint fields', () => {
    const s = useReportStore.getState();
    expect(s.attackerProfit).toBe(0n);
    expect(s.victimLoss).toBe(0n);
    expect(s.lpFee).toBe(0n);
    expect(s.validatorTip).toBe(0n);
    expect(s.protocolFee).toBe(0n);
  });

  it('exposes a DEFAULT_REPORT snapshot', () => {
    expect(DEFAULT_REPORT.attackerProfit).toBe(0n);
    expect(DEFAULT_REPORT.strategyBreakdown).toEqual([]);
  });

  it('setReportData replaces all 10 fields in one go', () => {
    useReportStore.getState().setReportData(SAMPLE_PAYLOAD);
    const s = useReportStore.getState();
    expect(s.reportId).toBe(SAMPLE_PAYLOAD.reportId);
    expect(s.blockNumber).toBe(22_180_543);
    expect(s.attackerProfit).toBe(SAMPLE_PAYLOAD.attackerProfit);
    expect(s.victimLoss).toBe(SAMPLE_PAYLOAD.victimLoss);
    expect(s.lpFee).toBe(SAMPLE_PAYLOAD.lpFee);
    expect(s.validatorTip).toBe(SAMPLE_PAYLOAD.validatorTip);
    expect(s.protocolFee).toBe(SAMPLE_PAYLOAD.protocolFee);
    expect(s.strategyBreakdown.length).toBe(5);
    expect(s.riskAxes.length).toBe(5);
    expect(s.evmTrace.length).toBe(6);
  });

  it('resetReport restores defaults', () => {
    useReportStore.getState().setReportData(SAMPLE_PAYLOAD);
    useReportStore.getState().resetReport();
    const s = useReportStore.getState();
    expect(s.attackerProfit).toBe(0n);
    expect(s.strategyBreakdown).toEqual([]);
    expect(s.evmTrace).toEqual([]);
    expect(s.riskAxes).toEqual([]);
  });
});
