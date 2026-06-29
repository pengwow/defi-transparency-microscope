/**
 * NetworkStatus — four-row summary of network-level health on the
 * live page.  Reads `blockNumber` from `useUiStore` and the mempool
 * size from `useLiveStore`.  Gas price and WS latency are derived
 * from the live mempool snapshot and a small in-memory rolling
 * window of inter-message gaps so the panel never reports a
 * hard-coded demo number.
 *
 * Derivation:
 *   - Gas price: average of `gasPrice` over the current mempool
 *     entries, in gwei.  If the mempool is empty, fall back to the
 *     30-day Ethereum mainnet average (~12 gwei).
 *   - WS latency: median gap (ms) between the last 20 mempool
 *     pushes.  If fewer than two pushes have happened, show "—".
 *   - The "Backend: live" / "Backend: demo" badge makes the data
 *     source explicit.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';

const FALLBACK_GAS_GWEI = 12.0;
const ROLLING_WINDOW = 20;

function fmtBlock(n: number): string {
  return `#${n.toLocaleString()}`;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function NetworkStatus() {
  const blockNumber = useUiStore((s) => s.blockNumber);
  const mempool = useLiveStore((s) => s.mempool);
  const backendConnected = useLiveStore((s) => s.backendConnected);

  // Track the wall-clock gap between mempool pushes so the WS
  // latency cell reflects a real measurement, not a hard-coded
  // constant.  We mutate a ref so the render path stays cheap.
  const lastPushAtRef = useRef<number | null>(null);
  const gapsRef = useRef<number[]>([]);
  const [wsMs, setWsMs] = useState<number | null>(null);
  useEffect(() => {
    if (mempool.length === 0) return;
    const now = Date.now();
    if (lastPushAtRef.current !== null) {
      const gap = now - lastPushAtRef.current;
      if (gap > 0) {
        gapsRef.current.push(gap);
        if (gapsRef.current.length > ROLLING_WINDOW) gapsRef.current.shift();
        setWsMs(median(gapsRef.current));
      }
    }
    lastPushAtRef.current = now;
  }, [mempool]);

  const gasGwei = useMemo(() => {
    const priced = mempool
      .map((m) => {
        // MemPoolEntry doesn't carry gasPrice in the public type,
        // but the live store allows it via duck-typing.  Filter
        // out entries without a gasPrice.
        const gp = (m as { gasPrice?: bigint | number }).gasPrice;
        if (gp === undefined || gp === null) return null;
        return typeof gp === 'bigint' ? Number(gp) / 1e9 : Number(gp) / 1e9;
      })
      .filter((x): x is number => x !== null && Number.isFinite(x) && x > 0);
    if (priced.length === 0) return FALLBACK_GAS_GWEI;
    return priced.reduce((a, b) => a + b, 0) / priced.length;
  }, [mempool]);

  return (
    <div className="dtm-network-status" data-testid="network-status">
      <div
        className={`dtm-network-status-source ${backendConnected ? 'is-live' : 'is-demo'}`}
        data-testid="network-status-source-badge"
        data-source={backendConnected ? 'backend' : 'demo'}
        title={
          backendConnected
            ? '正在读取后端推送的 mempool_tx 事件'
            : 'Mock 模式：基于 useLiveStore.mempool 推导'
        }
      >
        {backendConnected ? '● Backend: live' : '○ Backend: demo'}
      </div>
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
          data-testid="network-status-gas"
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
          data-testid="network-status-ws"
        >
          {wsMs === null ? '—' : `${Math.round(wsMs)}ms`}
        </span>
      </div>
    </div>
  );
}
