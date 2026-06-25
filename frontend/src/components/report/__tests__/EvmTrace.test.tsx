/**
 * Tests for the EvmTrace component.
 *
 * EvmTrace renders a 6-row EVM execution trace table.
 * Columns: PC / OPCODE / GAS / STACK / 描述
 */

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EvmTrace, type TraceOp } from '../EvmTrace';

const TRACE: TraceOp[] = [
  { pc: 0, opcode: 'CALL', gas: 21_000, stack: '0x', desc: '外层调用' },
  { pc: 1, opcode: 'STATICCALL', gas: 5_000, stack: '0x01', desc: '读池子' },
  { pc: 2, opcode: 'DELEGATECALL', gas: 8_000, stack: '0x02', desc: '库调用' },
  { pc: 3, opcode: 'SSTORE', gas: 20_000, stack: '0x03', desc: '写储备' },
  { pc: 4, opcode: 'MSTORE', gas: 100, stack: '0x04', desc: '写内存' },
  { pc: 5, opcode: 'LOG3', gas: 1_500, stack: '0x05', desc: '事件' },
];

describe('EvmTrace', () => {
  it('renders the panel root', () => {
    render(<EvmTrace trace={TRACE} />);
    expect(screen.getByTestId('evm-trace-panel')).toBeInTheDocument();
  });

  it('renders exactly 6 rows', () => {
    render(<EvmTrace trace={TRACE} />);
    const rows = screen.getAllByTestId(/^evm-trace-row-\d+$/);
    expect(rows.length).toBe(6);
  });

  it('shows each opcode as a row entry', () => {
    render(<EvmTrace trace={TRACE} />);
    for (const op of TRACE) {
      const matches = screen.getAllByText((_, node) => {
        if (!node || !node.textContent) return false;
        return node.textContent.includes(op.opcode);
      });
      expect(matches.length).toBeGreaterThan(0);
    }
  });
});
