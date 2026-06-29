/**
 * MevAttribution — five-row breakdown of the live mempool's MEV mix.
 *
 * Each row shows the strategy icon, label, percent of total mempool
 * volume, and the estimated profit captured in the period.
 *
 * Data source:
 *   - Reads the live mempool from `useLiveStore` and groups entries
 *     by `mevType`, then maps the store's `'arb'` token to the
 *     display key `'arbitrage'`.  Percentages and per-row profits
 *     are derived from the actual mempool snapshot, not hard-coded.
 *   - The "Backend: live" / "Backend: demo" badge makes the data
 *     provenance obvious at a glance.
 *
 * Profit calibration:
 *   - Per-bundle USD estimates are a calibrated constant (these are
 *     realistic for the canonical DTM_Demo scenario).  The displayed
 *     profit per row is `perType * count` so the panel tracks the
 *     real mempool composition instead of repeating the demo values.
 */

import { useMemo } from 'react';
import { useLiveStore } from '@/store/liveStore';
import { TX_TYPE_META, TX_TYPE_KEYS, type TxType } from '@/services/demoData';

/** Per-bundle USD profit estimate per MEV type.  Calibrated to the
 *  canonical DTM_Demo numbers ($1240 sandwich, $890 arb, $340 jit,
 *  $320 liquidation, $0 normal).  Kept as a const so the demo
 *  feels grounded even when the mempool is sparse. */
const PROFIT_PER_BUNDLE_USD: Record<TxType, number> = {
  sandwich: 1240,
  arbitrage: 890,
  jit: 340,
  liquidation: 320,
  normal: 0,
};

/** The store's MempoolEntry.mevType uses `'arb'` for arbitrage, while
 *  the UI's display key is `'arbitrage'`.  Normalize once. */
function toDisplayType(mevType: string): TxType {
  if (mevType === 'arb') return 'arbitrage';
  if (mevType === 'sandwich') return 'sandwich';
  if (mevType === 'jit') return 'jit';
  if (mevType === 'liquidation') return 'liquidation';
  return 'normal';
}

function formatUsd(n: number): string {
  if (n <= 0) return '—';
  return `$${Math.round(n).toLocaleString()}`;
}

export function MevAttribution() {
  const mempool = useLiveStore((s) => s.mempool);
  const backendConnected = useLiveStore((s) => s.backendConnected);

  const rows = useMemo(() => {
    const counts: Record<TxType, number> = {
      sandwich: 0,
      arbitrage: 0,
      jit: 0,
      liquidation: 0,
      normal: 0,
    };
    for (const m of mempool) {
      counts[toDisplayType(m.mevType)] += 1;
    }
    const total = mempool.length;
    return TX_TYPE_KEYS.map((type) => {
      const c = counts[type];
      const pct = total > 0 ? Math.round((c / total) * 100) : 0;
      const profitUsd = c * PROFIT_PER_BUNDLE_USD[type];
      return { type, count: c, pct, profitUsd };
    });
  }, [mempool]);

  return (
    <div className="dtm-mev-attribution" data-testid="mev-attribution">
      <div
        className={`dtm-mev-attribution-source ${backendConnected ? 'is-live' : 'is-demo'}`}
        data-testid="mev-attribution-source-badge"
        data-source={backendConnected ? 'backend' : 'demo'}
        title={
          backendConnected
            ? '正在聚合后端 WebSocket 推送的 mempool_tx 事件'
            : 'Mock 模式：基于 useLiveStore.mempool 统计'
        }
      >
        {backendConnected ? '● Backend: live' : '○ Backend: demo'}
      </div>
      {rows.map((r) => {
        const meta = TX_TYPE_META[r.type];
        return (
          <div
            key={r.type}
            className={`dtm-mev-attr-row dtm-${meta.class}`}
            data-testid={`mev-attr-row-${r.type}`}
            data-count={r.count}
          >
            <span
              className="dtm-mev-attr-bar"
              style={{ background: meta.color }}
              aria-hidden="true"
            />
            <span className="dtm-mev-attr-icon">{meta.icon}</span>
            <span className="dtm-mev-attr-label">{meta.label}</span>
            <span className="dtm-mev-attr-pct" style={{ color: meta.color }}>
              {r.pct}%
            </span>
            <span className="dtm-mev-attr-profit">{formatUsd(r.profitUsd)}</span>
          </div>
        );
      })}
    </div>
  );
}
