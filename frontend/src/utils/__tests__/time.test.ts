/**
 * Tests for the time formatting helpers.
 */

import { describe, expect, it } from 'vitest';
import { formatTime, formatDate, relativeTime } from '../time';

describe('formatTime', () => {
  it('returns HH:MM:SS for a known timestamp', () => {
    // 2026-06-25T12:34:56Z — but we use local time, so we just check format
    const ts = 1782382496; // some unix second value
    const out = formatTime(ts);
    expect(out).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it('returns --:--:-- for invalid timestamps', () => {
    expect(formatTime(0)).toBe('--:--:--');
    expect(formatTime(-1)).toBe('--:--:--');
    expect(formatTime(Number.NaN)).toBe('--:--:--');
  });
});

describe('formatDate', () => {
  it('returns yyyy-mm-dd for a known timestamp', () => {
    const out = formatDate(1700000000);
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns placeholder for invalid timestamps', () => {
    expect(formatDate(0)).toBe('----.--.--');
    expect(formatDate(-1)).toBe('----.--.--');
  });
});

describe('relativeTime', () => {
  it('returns "now" for very recent timestamps', () => {
    const now = 1_700_000_000;
    expect(relativeTime(now, now * 1000)).toBe('now');
    expect(relativeTime(now - 1, now * 1000)).toBe('now');
  });

  it('returns seconds for sub-minute diffs', () => {
    const now = 1_700_000_000 * 1000;
    expect(relativeTime(1_700_000_000 - 30, now)).toBe('30s ago');
  });

  it('returns minutes for sub-hour diffs', () => {
    const now = 1_700_000_000 * 1000;
    expect(relativeTime(1_700_000_000 - 90, now)).toBe('1m ago');
    expect(relativeTime(1_700_000_000 - 600, now)).toBe('10m ago');
  });

  it('returns hours for sub-day diffs', () => {
    const now = 1_700_000_000 * 1000;
    expect(relativeTime(1_700_000_000 - 3600, now)).toBe('1h ago');
  });

  it('returns days for sub-week diffs', () => {
    const now = 1_700_000_000 * 1000;
    expect(relativeTime(1_700_000_000 - 86400, now)).toBe('1d ago');
  });

  it('formats future timestamps as "in …"', () => {
    const now = 1_700_000_000 * 1000;
    expect(relativeTime(1_700_000_000 + 90, now)).toBe('in 1m');
  });
});
