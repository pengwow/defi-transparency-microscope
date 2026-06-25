/**
 * Tests for the HfGauge — half-arc gauge for a single position's HF.
 *
 * Stroke color is tied to the `level` prop:
 *   - 'safe'    → lime
 *   - 'warning' → amber
 *   - 'danger'  → coral
 *   - 'liquidated' → muted gray
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { drawHfGauge, setHfGauge, getHfGauge } from '../HfGauge';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 240, height: 140 };

describe('HfGauge', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('exports setHfGauge and getHfGauge', () => {
    setHfGauge({ value: 1.5, max: 3, level: 'safe' });
    const s = getHfGauge();
    expect(s.value).toBe(1.5);
    expect(s.max).toBe(3);
    expect(s.level).toBe('safe');
  });

  it('draws at least one arc segment', () => {
    setHfGauge({ value: 1.5, max: 3, level: 'safe' });
    drawHfGauge(ctx, size, {});
    expect((ctx.arc as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('changes stroke color when level changes', () => {
    // Build a custom mock that records every value ever assigned to
    // `strokeStyle`, so we can verify the fill-arc stroke (tied to
    // `level`) differs between safe and danger.
    function makeRecordingCtx(): { ctx: ReturnType<typeof makeMockCtx>; strokes: string[] } {
      const strokes: string[] = [];
      const ctx: Record<string, unknown> = {};
      for (const m of [
        'clearRect',
        'fillRect',
        'beginPath',
        'closePath',
        'moveTo',
        'lineTo',
        'stroke',
        'fill',
        'arc',
        'bezierCurveTo',
        'fillText',
        'save',
        'restore',
        'translate',
        'rotate',
        'scale',
        'setLineDash',
      ]) {
        ctx[m] = vi.fn(() => undefined);
      }
      // Override strokeStyle with a setter that records every write.
      const fillValues: string[] = [];
      Object.defineProperty(ctx, 'fillStyle', {
        configurable: true,
        get() {
          return fillValues[fillValues.length - 1] ?? '';
        },
        set(v: string) {
          fillValues.push(v);
        },
      });
      Object.defineProperty(ctx, 'strokeStyle', {
        configurable: true,
        get() {
          return strokes[strokes.length - 1] ?? '';
        },
        set(v: string) {
          strokes.push(v);
        },
      });
      Object.defineProperty(ctx, 'lineWidth', { writable: true, value: 1 });
      Object.defineProperty(ctx, 'font', { writable: true, value: '' });
      Object.defineProperty(ctx, 'textAlign', { writable: true, value: 'start' });
      Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
      return { ctx: ctx as unknown as ReturnType<typeof makeMockCtx>, strokes };
    }

    const a = makeRecordingCtx();
    setHfGauge({ value: 1.5, max: 3, level: 'safe' });
    drawHfGauge(a.ctx, size, {});

    const b = makeRecordingCtx();
    setHfGauge({ value: 0.5, max: 3, level: 'danger' });
    drawHfGauge(b.ctx, size, {});

    // The fill arc stroke should appear in each trace; safe = lime,
    // danger = coral.
    expect(a.strokes).toContain('#69f0ae');
    expect(b.strokes).toContain('#ff5e5e');
  });

  it('renders the numeric value in the centre', () => {
    setHfGauge({ value: 1.39, max: 3, level: 'warning' });
    drawHfGauge(ctx, size, {});
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('1.39'))).toBe(true);
  });
});
