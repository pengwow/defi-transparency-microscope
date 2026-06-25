/**
 * Time formatting helpers.
 *
 * Everything works in unix seconds (the unit used by the rest of the
 * app).  We expose:
 *   - formatTime       → "12:34:56"   (HH:MM:SS, 24h)
 *   - formatDate       → "2026-06-25" (ISO yyyy-mm-dd)
 *   - relativeTime     → "3m ago"     ("now", "Ns", "Nm", "Nh", "Nd" ago)
 */

const SECOND = 1;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Pad a number to two digits. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Format a unix-second timestamp as a time-of-day string (HH:MM:SS).
 *
 * Negative or zero timestamps are returned as `--:--:--`.
 */
export function formatTime(timestampSeconds: number): string {
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return '--:--:--';
  }
  const d = new Date(timestampSeconds * 1000);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

/** Format a unix-second timestamp as an ISO-style date (yyyy-mm-dd). */
export function formatDate(timestampSeconds: number): string {
  if (!Number.isFinite(timestampSeconds) || timestampSeconds <= 0) {
    return '----.--.--';
  }
  const d = new Date(timestampSeconds * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Format a timestamp as a relative offset from a reference time.
 *
 *   relativeTime(0,  0)         -> "now"
 *   relativeTime(0,  30)        -> "30s ago"
 *   relativeTime(0,  90)        -> "1m ago"
 *   relativeTime(0,  60*60)     -> "1h ago"
 *   relativeTime(0,  60*60*24)  -> "1d ago"
 *
 * Negative offsets (future events) are formatted as "in …".
 */
export function relativeTime(timestampSeconds: number, now: number = Date.now()): string {
  const diff = Math.floor(now / 1000) - timestampSeconds;
  const abs = Math.abs(diff);
  const future = diff < 0;

  if (abs < 5) return 'now';
  let value: number;
  let unit: string;
  if (abs < MINUTE) {
    value = abs;
    unit = 's';
  } else if (abs < HOUR) {
    value = Math.floor(abs / MINUTE);
    unit = 'm';
  } else if (abs < DAY) {
    value = Math.floor(abs / HOUR);
    unit = 'h';
  } else if (abs < WEEK) {
    value = Math.floor(abs / DAY);
    unit = 'd';
  } else {
    value = Math.floor(abs / WEEK);
    unit = 'w';
  }
  const body = `${value}${unit}`;
  return future ? `in ${body}` : `${body} ago`;
}
