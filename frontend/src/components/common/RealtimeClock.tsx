/**
 * RealtimeClock — display the current time, updated each second.
 *
 * Uses a `setInterval` driven by a ref so we never miss a tick when
 * the component re-renders for other reasons.  Cleans up on unmount.
 */

import { useEffect, useRef, useState } from 'react';
import { formatTime } from '@/utils/time';

export interface RealtimeClockProps {
  /** Show seconds (default true). */
  showSeconds?: boolean;
  /** Optional aria-label. */
  label?: string;
}

export function RealtimeClock({ showSeconds = true, label = 'Current time' }: RealtimeClockProps) {
  const [now, setNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const ts = Math.floor(now / 1000);
  let display = formatTime(ts);
  if (!showSeconds) display = display.slice(0, 5);

  return (
    <time
      className="dtm-realtime-clock"
      aria-label={label}
      dateTime={new Date(now).toISOString()}
      data-testid="realtime-clock"
    >
      {display}
    </time>
  );
}
