/**
 * RealtimeClock — floating demo-style widget that shows the current
 * time, date, and an auto-incrementing "Block #" counter.
 *
 * Ported from DTM_Demo.html.  Visually a fixed pill in the bottom-left
 * corner with a lime pulse dot, the HH:MM:SS, the ISO date, a
 * vertical separator, and the current block number in a mono font.
 *
 * The block number is owned by the uiStore (`blockNumber` slice).
 * We sync the initial value into local state on mount and then bump
 * the store value every `blockIntervalMs` (default 12s for the demo).
 */

import { useEffect, useRef, useState } from 'react';
import { formatDate, formatTime } from '@/utils/time';
import { useUiStore } from '@/store/uiStore';

export interface RealtimeClockProps {
  /** Show seconds in the time string (default true). */
  showSeconds?: boolean;
  /** Aria-label for the wrapper. */
  label?: string;
  /** Override the initial block number (otherwise read from uiStore). */
  block?: number;
  /** How often the block number auto-advances, in ms. */
  blockIntervalMs?: number;
}

export function RealtimeClock({
  showSeconds = true,
  label = 'Realtime clock widget',
  block,
  blockIntervalMs = 12_000,
}: RealtimeClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const storeBlock = useUiStore((s) => s.blockNumber);
  const setStoreBlock = useUiStore((s) => s.setBlockNumber);
  const [localBlock, setLocalBlock] = useState<number | null>(block ?? null);

  // When the caller doesn't pin `block`, we read from the store and
  // also push our auto-increments back into the store.
  const blockValue = block ?? localBlock ?? storeBlock;
  const blockRef = useRef(blockValue);
  blockRef.current = blockValue;

  // Drive the per-second clock.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Auto-advance block every blockIntervalMs.
  useEffect(() => {
    if (block !== undefined) return; // pinned — don't auto-increment
    const id = setInterval(() => {
      const next = (blockRef.current ?? 0) + 1;
      if (localBlock === null) {
        setStoreBlock(next);
      } else {
        setLocalBlock(next);
      }
    }, blockIntervalMs);
    return () => clearInterval(id);
  }, [block, blockIntervalMs, localBlock, setStoreBlock]);

  const ts = Math.floor(now / 1000);
  let timeText = formatTime(ts);
  if (!showSeconds) timeText = timeText.slice(0, 5);
  const dateText = formatDate(ts);

  return (
    <div
      className="dtm-rtc-widget"
      role="group"
      aria-label={label}
      data-testid="realtime-clock"
    >
      <span className="dtm-rtc-pulse" aria-hidden="true" />
      <span className="dtm-rtc-time" data-testid="realtime-clock-time">
        {timeText}
      </span>
      <span className="dtm-rtc-date" data-testid="realtime-clock-date">
        {dateText}
      </span>
      <span className="dtm-rtc-sep" aria-hidden="true" />
      <span className="dtm-rtc-block" data-testid="realtime-clock-block">
        Block #{blockValue.toLocaleString('en-US')}
      </span>
    </div>
  );
}
