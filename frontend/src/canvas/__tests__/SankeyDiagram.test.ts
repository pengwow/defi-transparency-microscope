/**
 * Tests for the SankeyDiagram chart.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { draw } from '../SankeyDiagram';
import type { CanvasSize } from '../types';
import { makeMockCtx } from './_helpers';

const size: CanvasSize = { width: 400, height: 200 };

describe('SankeyDiagram', () => {
  let ctx: ReturnType<typeof makeMockCtx>;

  beforeEach(() => {
    ctx = makeMockCtx();
  });

  it('clears the canvas and paints the background', () => {
    draw(ctx, size, { source: { label: 'src' }, targets: [] });
    expect(ctx.clearRect).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it('draws a bezier ribbon for each target', () => {
    draw(ctx, size, {
      source: { label: 'src' },
      targets: [
        { node: { label: 'a' }, value: 30 },
        { node: { label: 'b' }, value: 70 },
      ],
    });
    // Two ribbons ⇒ two bezierCurveTo groups, each with two calls (top + bottom edges).
    expect((ctx.bezierCurveTo as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(4);
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('renders an empty-state message when there are no targets', () => {
    draw(ctx, size, { source: { label: 'src' }, targets: [] });
    const texts = (ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0] as string,
    );
    expect(texts.some((t) => t.includes('no flow'))).toBe(true);
  });
});
