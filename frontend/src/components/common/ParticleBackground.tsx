/**
 * ParticleBackground — full-screen canvas that draws the demo's
 * drifting particle field behind the rest of the UI.
 *
 * Uses the shared `useCanvas` hook to drive the render loop.  The
 * element is `fixed inset-0` with `pointer-events: none` and
 * `z-index: 0` so it sits behind everything else.
 */

import { useCanvas } from '@/canvas/useCanvas';
import { drawParticles } from '@/canvas/ParticleBackground';

export interface ParticleBackgroundProps {
  /** Optional override for the particle count. */
  count?: number;
  /** Optional className passthrough. */
  className?: string;
}

export function ParticleBackground({ count, className }: ParticleBackgroundProps) {
  const { ref } = useCanvas(
    (ctx, size) => {
      drawParticles(ctx, size, count !== undefined ? { count } : undefined);
    },
    [count],
  );

  const cls = ['dtm-particle-bg', className].filter(Boolean).join(' ');

  return (
    <canvas
      ref={ref}
      className={cls}
      data-testid="particle-background"
      aria-hidden="true"
    />
  );
}
