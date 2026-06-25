/**
 * RecentSamples — the right-rail panel on the live page that lists the
 * ten most recent mempool samples.  Pulls straight from
 * `useLiveStore.mempool`; if there are no entries, an empty-state
 * placeholder is shown instead.
 */

import { useLiveStore } from '@/store/liveStore';
import { TX_TYPE_META, type TxType } from '@/services/demoData';

const RECENT_LIMIT = 10;

const STORE_TO_DEMO_TYPE: Record<string, TxType> = {
  sandwich: 'sandwich',
  arb: 'arbitrage',
  arbitrage: 'arbitrage',
  jit: 'jit',
  liquidation: 'liquidation',
  normal: 'normal',
};

function truncateHash(hash: string): string {
  return hash.slice(0, 10) + '…' + hash.slice(-6);
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function RecentSamples() {
  const mempool = useLiveStore((s) => s.mempool);
  const recent = mempool.slice(-RECENT_LIMIT).reverse();

  if (recent.length === 0) {
    return (
      <div className="dtm-recent-samples" data-testid="recent-samples">
        <div className="dtm-recent-empty">暂无采样</div>
      </div>
    );
  }

  return (
    <div className="dtm-recent-samples" data-testid="recent-samples">
      {recent.map((m, i) => {
        const demoType = STORE_TO_DEMO_TYPE[m.mevType] ?? 'normal';
        const meta = TX_TYPE_META[demoType];
        return (
          <div
            key={`${m.hash}-${i}`}
            className={`dtm-recent-sample dtm-${meta.class}`}
            data-testid={`recent-sample-${i}`}
          >
            <span className="dtm-recent-sample-time" style={{ color: meta.color }}>
              📍 {formatTime(m.timestamp)}
            </span>
            <span className="dtm-recent-sample-type">{meta.label}</span>
            <span className="dtm-recent-sample-hash">{truncateHash(m.hash)}</span>
          </div>
        );
      })}
    </div>
  );
}
