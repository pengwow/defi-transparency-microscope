/**
 * MempoolLanes — scrolling list of live mempool transactions.
 *
 * Each row shows the MEV type, the truncated display hash, the gas
 * price, the originating address (truncated), and the wall-clock
 * timestamp.  Hovering the row reveals a "🔬 放入显微镜" button that
 * invokes the `onEnterMicroscope` prop.
 *
 * On a 2500ms interval the component generates a new transaction
 * with `makeTransaction` and pushes it onto the live store.  When
 * the new transaction is an attack type, there's a 30% chance the
 * component surfaces a `pushFlashAlert` to the UI store.
 */

import { useEffect, useRef } from 'react';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';
import { makeTransaction, TX_TYPE_META, type TxType } from '@/services/demoData';
import { addExplosion } from '@/canvas/MempoolExplosion';

const POLL_MS = 2500;
const ATTACK_PROBABILITY = 0.3;
const ATTACK_TYPES: TxType[] = ['sandwich', 'jit', 'liquidation', 'arbitrage'];

function truncateHash(hash: string): string {
  return hash.slice(0, 14) + '...' + hash.slice(-6);
}

function truncateAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  const ss = d.getSeconds().toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function formatGas(wei: bigint): string {
  const gwei = Number(wei / 1_000_000_000n) + Number(wei % 1_000_000_000n) / 1e9;
  return `${gwei.toFixed(1)} gwei`;
}

export interface MempoolLanesProps {
  onEnterMicroscope: (hash: string) => void;
}

interface MempoolEntry {
  hash: string;
  from: string;
  timestamp: number;
  mevType: string;
  gasPrice?: bigint;
}

export function MempoolLanes({ onEnterMicroscope }: MempoolLanesProps) {
  const mempool = useLiveStore((s) => s.mempool);
  const pushTx = useLiveStore((s) => s.pushTx);
  const pushFlashAlert = useUiStore((s) => s.pushFlashAlert);
  const onEnterRef = useRef(onEnterMicroscope);
  onEnterRef.current = onEnterMicroscope;

  useEffect(() => {
    const id = setInterval(() => {
      const tx = makeTransaction();
      const entry = {
        hash: tx.hash,
        from: tx.from,
        timestamp: tx.timestamp,
        mevType: tx.mevType,
        gasPrice: tx.gasPrice,
      };
      pushTx(entry);
      // Attack type + 30% chance → surface a flash alert + explosion.
      if (
        ATTACK_TYPES.includes(tx.mevType) &&
        Math.random() < ATTACK_PROBABILITY
      ) {
        pushFlashAlert({
          type: tx.mevType === 'arbitrage' ? 'sandwich' : (tx.mevType as 'sandwich' | 'jit' | 'liquidation'),
          title: `${TX_TYPE_META[tx.mevType].label} 策略检测`,
          body: `${truncateHash(tx.hash)} · ${TX_TYPE_META[tx.mevType].desc}`,
        });
        addExplosion(80, 80, TX_TYPE_META[tx.mevType].color);
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [pushTx, pushFlashAlert]);

  return (
    <div className="dtm-mempool-lanes" data-testid="mempool-lanes">
      {mempool.map((m: MempoolEntry, i: number) => {
        const type = (m.mevType as TxType) ?? 'normal';
        const meta = TX_TYPE_META[type] ?? TX_TYPE_META.normal;
        return (
          <div
            key={`${m.hash}-${i}`}
            className={`dtm-mempool-lane dtm-${meta.class}`}
            data-testid={`mempool-lane-${i}`}
            data-mev-type={type}
          >
            <span
              className="dtm-mempool-lane-bar"
              style={{ background: meta.color }}
              aria-hidden="true"
            />
            <div className="dtm-mempool-lane-body">
              <div className="dtm-mempool-lane-row">
                <span className="dtm-mempool-lane-type" style={{ color: meta.color }}>
                  {meta.icon} {meta.label}
                </span>
                <span className="dtm-mempool-lane-hash">{truncateHash(m.hash)}</span>
              </div>
              <div className="dtm-mempool-lane-row dtm-mempool-lane-meta">
                <span className="dtm-mempool-lane-gas">
                  {formatGas(m.gasPrice ?? 25_000_000_000n)}
                </span>
                <span className="dtm-mempool-lane-addr">{truncateAddr(m.from)}</span>
                <span className="dtm-mempool-lane-time">{formatTime(m.timestamp)}</span>
              </div>
            </div>
            <button
              type="button"
              className="dtm-mempool-lane-action"
              data-testid="mempool-enter-microscope"
              onClick={() => onEnterRef.current(m.hash)}
              aria-label="放入显微镜"
            >
              🔬 放入显微镜
            </button>
          </div>
        );
      })}
    </div>
  );
}
