/**
 * `useCanvas` — drop-in React hook for a self-managing 2D canvas.
 *
 * Responsibilities:
 *   1. Set up a `<canvas>` ref for the consumer.
 *   2. On mount, size the backing store to `cssSize * devicePixelRatio` and
 *      apply a matching `setTransform` so the `drawFn` can think in
 *      CSS pixels.
 *   3. Drive a `requestAnimationFrame` loop, redrawing whenever `deps`
 *      change or the element resizes.
 *   4. Tear down the rAF handle on unmount.
 *
 * The `drawFn` is intentionally NOT in the dep list.  We pass it as a
 * ref-stored value so callers can close over changing props (e.g. a live
 * timestamp) without restarting the loop.  Data dependencies go in `deps`.
 */

import { useEffect, useRef } from 'react';
import type { DrawFn } from './types';

export interface UseCanvasResult {
  ref: React.RefObject<HTMLCanvasElement>;
}

/**
 * @param drawFn  called every frame with `(ctx, cssSize)`.
 * @param deps    re-create the rAF loop when any of these change.
 */
export function useCanvas(drawFn: DrawFn, deps: ReadonlyArray<unknown>): UseCanvasResult {
  const ref = useRef<HTMLCanvasElement>(null);

  // Keep the latest drawFn in a ref so the rAF loop can call the freshest
  // closure without needing it in the dep list.
  const drawRef = useRef<DrawFn>(drawFn);
  useEffect(() => {
    drawRef.current = drawFn;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let stopped = false;

    const resize = (): { width: number; height: number } => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      // If the element has no layout yet, fall back to attributes.
      const cssWidth = rect.width || canvas.width || 300;
      const cssHeight = rect.height || canvas.height || 150;
      canvas.width = Math.max(1, Math.round(cssWidth * dpr));
      canvas.height = Math.max(1, Math.round(cssHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: cssWidth, height: cssHeight };
    };

    // Respect prefers-reduced-motion: skip the rAF loop entirely so
    // users with motion sensitivity see a single static frame.
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      const size = resize();
      drawRef.current(ctx, size);
      return () => {
        stopped = true;
      };
    }

    const frame = () => {
      if (stopped) return;
      const size = resize();
      drawRef.current(ctx, size);
      rafId = requestAnimationFrame(frame);
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ref };
}
