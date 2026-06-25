/**
 * NetworkStatus — four-row summary of network-level health on the
 * live page.  Reads `blockNumber` from `useUiStore` and the mempool
 * size from `useLiveStore`.
 */

import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

function fmtBlock(n: number): string {
  return `#${n.toLocaleString()}`;
}

export function NetworkStatus() {
  const blockNumber = useUiStore((s) => s.blockNumber);
  const mempool = useLiveStore((s) => s.mempool);
  // Mock values: gas price and ws latency aren't in any store yet, so
  // we render plausible demo numbers that the user can later wire to
  // real telemetry.
  const gasGwei = 8.2;
  const wsMs = 47;

  return (
    <div className="dtm-network-status" data-testid="network-status">
      <div className="dtm-network-status-row">
        <span className="dtm-network-status-label">区块高度</span>
        <span
          className="dtm-network-status-value"
          style={{ color: 'var(--dtm-cyan)' }}
          data-testid="network-status-block"
        >
          {fmtBlock(blockNumber)}
        </span>
      </div>
      <div className="dtm-network-status-row">
        <span className="dtm-network-status-label">Gas Price</span>
        <span
          className="dtm-network-status-value"
          style={{ color: 'var(--dtm-amber)' }}
        >
          {gasGwei.toFixed(1)} gwei
        </span>
      </div>
      <div className="dtm-network-status-row">
        <span className="dtm-network-status-label">Mempool 待处理</span>
        <span
          className="dtm-network-status-value"
          style={{ color: 'var(--dtm-cyan)' }}
          data-testid="network-status-mempool"
        >
          {mempool.length} tx
        </span>
      </div>
      <div className="dtm-network-status-row">
        <span className="dtm-network-status-label">WS 延迟</span>
        <span
          className="dtm-network-status-value"
          style={{ color: 'var(--dtm-lime)' }}
        >
          {wsMs}ms
        </span>
      </div>
    </div>
  );
}
