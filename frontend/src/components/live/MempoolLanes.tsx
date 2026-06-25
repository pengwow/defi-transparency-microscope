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
 * the new transaction is an attack type (sandwich / jit), there's a
 * 30% chance the component surfaces a `pushFlashAlert` to the UI
 * store — unless the demo is currently running (we don't want to
 * spam the user with attack alerts mid-tour).
 */

import { useEffect, useRef } from 'react';
import { useLiveStore } from '@/store/liveStore';
import { useUiStore } from '@/store/uiStore';
import { makeTransaction, TX_TYPE_META, type TxType } from '@/services/demoData';
import { addExplosion } from '@/canvas/MempoolExplosion';

const POLL_MS = 2500;
/** Tx types that produce a FlashAlert.  Narrower than the visual
 *  attack-type palette — liquidation / arbitrage don't trigger
 *  the on-screen "sampled an attack" alert. */
const FLASH_TYPES: TxType[] = ['sandwich', 'jit'];
const FLASH_PROBABILITY = 0.3; // Math.random() > 0.7

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
      // Map the demo "arbitrage" type into the store's "arb" token.
      const storeType: 'sandwich' | 'arb' | 'jit' | 'liquidation' | 'normal' =
        tx.mevType === 'arbitrage' ? 'arb' : (tx.mevType as 'sandwich' | 'jit' | 'liquidation' | 'normal');
      const entry = {
        hash: tx.hash,
        from: tx.from,
        timestamp: tx.timestamp,
        mevType: storeType,
        gasPrice: tx.gasPrice,
      };
      pushTx(entry);
      // FlashAlert gate: only sandwich / jit, ~30% chance, and not
      // while the demo tour is in flight.
      if (
        FLASH_TYPES.includes(tx.mevType) &&
        !useUiStore.getState().demoRunning &&
        Math.random() > 1 - FLASH_PROBABILITY
      ) {
        const isSandwich = tx.mevType === 'sandwich';
        pushFlashAlert({
          type: isSandwich ? 'sandwich' : 'jit',
          title: isSandwich ? '🚨 采样到三明治！' : '🎯 检测到 JIT 注入',
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
