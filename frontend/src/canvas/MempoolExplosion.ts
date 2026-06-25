/**
 * MempoolExplosion — short-lived particle bursts rendered on a 2D canvas
 * to highlight an attack transaction in the mempool.
 *
 * Each call to `addExplosion(x, y, color)` queues a single explosion
 * that fans 12 particles outward in evenly-spaced directions.  On
 * `drawExplosions` we clear the canvas, advance every particle by its
 * velocity, fade it out, and remove any that have expired or flown
 * off-screen.
 *
 * State is kept in module-level variables so a single canvas can keep
 * multiple bursts in flight without any per-frame prop drilling.
 */

import type { CanvasSize } from './types';

const PARTICLES_PER_EXPLOSION = 12;
const MAX_AGE_FRAMES = 24;
const PARTICLE_SPEED = 0.8;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  maxAge: number;
  color: string;
}

interface Explosion {
  x: number;
  y: number;
  color: string;
  particles: Particle[];
}

let explosions: Explosion[] = [];

function makeExplosion(x: number, y: number, color: string): Explosion {
  const particles: Particle[] = [];
  for (let i = 0; i < PARTICLES_PER_EXPLOSION; i++) {
    const angle = (i / PARTICLES_PER_EXPLOSION) * Math.PI * 2;
    const speed = PARTICLE_SPEED * (0.5 + Math.random());
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: 0,
      maxAge: MAX_AGE_FRAMES,
      color,
    });
  }
  return { x, y, color, particles };
}

/** Queue a new explosion centred at (x, y) with the given hex color. */
export function addExplosion(x: number, y: number, color: string): void {
  explosions.push(makeExplosion(x, y, color));
}

/** Advance and render every active explosion.  Called once per frame. */
export function drawExplosions(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);

  const survivors: Explosion[] = [];
  for (const e of explosions) {
    const liveParticles: Particle[] = [];
    for (const p of e.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.age += 1;
      // Fade as we age: alpha = 1 - (age/maxAge).
      const alpha = Math.max(0, 1 - p.age / p.maxAge);
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      liveParticles.push(p);
    }
    if (liveParticles.length > 0) {
      e.particles = liveParticles;
      survivors.push(e);
    }
  }
  explosions = survivors;
}

/** Drop all in-flight explosions.  Useful between tests or when the
 *  page unmounts to avoid cross-contamination of particle state. */
export function resetExplosions(): void {
  explosions = [];
}
