/**
 * EvmTrace — 6-row EVM execution trace table for the Report tab.
 *
 * Columns: PC | OPCODE | GAS | STACK | 描述
 *
 * The component is a layout-only view: callers pass a `TraceOp[]`
 * and we render the rows.  In a production system, this would
 * come from a debugger or anvil-style trace data.
 */

export interface TraceOp {
  pc: number;
  opcode: string;
  gas: number;
  stack: string;
  desc: string;
}

export interface EvmTraceProps {
  trace: ReadonlyArray<TraceOp>;
  testId?: string;
}

function formatPc(pc: number): string {
  if (!Number.isFinite(pc) || pc < 0) return '000';
  return pc.toString(16).padStart(3, '0');
}

function formatGas(g: number): string {
  if (!Number.isFinite(g) || g < 0) return '0';
  return g.toLocaleString('en-US');
}

export function EvmTrace({ trace, testId = 'evm-trace-panel' }: EvmTraceProps) {
  return (
    <div className="dtm-report-evm-trace" data-testid={testId}>
      <div className="dtm-report-evm-trace-title">⛓️ EVM 执行轨迹</div>
      <div className="dtm-report-evm-trace-table" role="table">
        <div className="dtm-report-evm-trace-head" role="row">
          <span role="columnheader">PC</span>
          <span role="columnheader">OPCODE</span>
          <span role="columnheader">GAS</span>
          <span role="columnheader">STACK</span>
          <span role="columnheader">描述</span>
        </div>
        <ul
          className="dtm-report-evm-trace-body"
          data-testid="evm-trace-body"
        >
          {trace.map((op, i) => (
            <li
              key={`${op.pc}-${op.opcode}-${i}`}
              className="dtm-report-evm-trace-row"
              role="row"
              data-testid={`evm-trace-row-${i + 1}`}
            >
              <span className="dtm-report-evm-trace-cell mono" role="cell">
                {formatPc(op.pc)}
              </span>
              <span className="dtm-report-evm-trace-cell mono" role="cell">
                {op.opcode}
              </span>
              <span className="dtm-report-evm-trace-cell mono" role="cell">
                {formatGas(op.gas)}
              </span>
              <span className="dtm-report-evm-trace-cell mono" role="cell">
                {op.stack}
              </span>
              <span className="dtm-report-evm-trace-cell" role="cell">
                {op.desc}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default EvmTrace;
