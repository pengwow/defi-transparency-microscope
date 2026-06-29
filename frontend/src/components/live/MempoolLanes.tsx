/**
 * MempoolLanes — scrolling list of live mempool transactions.
 *
 * Each row shows the MEV type, the truncated display hash, the gas
 * price, the originating address (truncated), and the wall-clock
 * timestamp.  Hovering the row reveals a "🔬 放入显微镜" button that
 * invokes the `onEnterMicroscope` prop.
 *
 * Data source priority:
 *   1. **Backend mode** (`useLiveStore.backendConnected === true`):
 *      the list is driven exclusively by the `mempool_tx` WebSocket
 *      topic that `App.tsx` subscribes to.  We do **not** push any
 *      fake `makeTransaction()` data, so the user sees real on-chain
 *      events.
 *   2. **Mock / disconnected mode**: every 2500ms a fresh
 *      `makeTransaction()` is pushed onto the live store so the
 *      panel looks alive.  Sandwich / jit pushes have a 30% chance
 *      of triggering a `pushFlashAlert`, unless the guided demo is
 *      running (so we don't spam the user mid-tour).
 *
 * The "Backend: live" / "Backend: demo" badge in the panel header
 * makes the current data source obvious at a glance.
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
  const backendConnected = useLiveStore((s) => s.backendConnected);
  const pushTx = useLiveStore((s) => s.pushTx);
  const pushFlashAlert = useUiStore((s) => s.pushFlashAlert);
  const onEnterRef = useRef(onEnterMicroscope);
  onEnterRef.current = onEnterMicroscope;

  useEffect(() => {
    // Backend mode: real on-chain `mempool_tx` events drive the
    // list via `App.tsx`'s WS subscription.  We must NOT push
    // synthetic data on top, or the user will see a mix of real
    // and fake transactions that is impossible to distinguish.
    if (backendConnected) return;
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
  }, [backendConnected, pushTx, pushFlashAlert]);

  return (
    <div className="dtm-mempool-lanes" data-testid="mempool-lanes">
      <div
        className={`dtm-mempool-source ${backendConnected ? 'is-live' : 'is-demo'}`}
        data-testid="mempool-source-badge"
        data-source={backendConnected ? 'backend' : 'demo'}
        title={
          backendConnected
            ? '正在接收后端 WebSocket 的 mempool_tx 事件'
            : 'Mock 模式：每 2.5s 生成一笔假交易'
        }
      >
        {backendConnected ? '● Backend: live' : '○ Backend: demo'}
      </div>
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
