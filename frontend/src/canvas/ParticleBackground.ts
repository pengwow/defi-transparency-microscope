/**
 * ParticleBackground — sparse cyan particle field that drifts in the
 * background of the demo, with faint connecting lines between particles
 * closer than ~120px.
 *
 * Ported from DTM_Demo.html lines 1403-1466.  We keep the particle
 * field in module-level state so the same `useCanvas` rAF loop can
 * drive it without re-allocating every frame.  Callers should invoke
 * `resetParticles()` when the canvas resizes drastically so the field
 * re-seeds against the new dimensions.
 */

import type { CanvasSize } from './types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  pulse: number;
}

export interface ParticleConfig {
  /** Number of particles to seed on first draw. */
  count?: number;
  /** Maximum distance (in CSS px) at which two particles are connected. */
  connectDistance?: number;
  /** Particle fill colour, used as the rgba prefix. */
  color?: string;
}

const DEFAULT_COUNT = 80;
const DEFAULT_CONNECT = 120;
const DEFAULT_COLOR = '0, 229, 255';

let particles: Particle[] = [];
let lastW = 0;
let lastH = 0;

function seed(w: number, h: number, count: number): void {
  particles = [];
  for (let i = 0; i < count; i += 1) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.4 + 0.1,
      pulse: Math.random() * Math.PI * 2,
    });
  }
}

/** Clear the in-module particle field.  The next draw call reseeds. */
export function resetParticles(): void {
  particles = [];
  lastW = 0;
  lastH = 0;
}

/**
 * Draw + advance the particle field.
 *
 *  drawParticles(ctx, size)                           // demo defaults
 *  drawParticles(ctx, size, { count: 30, color: '0,229,255' })
 */
export function drawParticles(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  config: ParticleConfig = {},
): void {
  const count = config.count ?? DEFAULT_COUNT;
  const connectDistance = config.connectDistance ?? DEFAULT_CONNECT;
  const color = config.color ?? DEFAULT_COLOR;

  const { width, height } = size;

  // Reseed when the field is empty or the canvas has been resized.
  if (particles.length === 0 || lastW !== width || lastH !== height) {
    seed(width, height, count);
    lastW = width;
    lastH = height;
  }

  ctx.clearRect(0, 0, width, height);

  // Update + draw each particle.
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.pulse += 0.02;
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) {
      p.x = Math.random() * width;
      p.y = Math.random() * height;
    }
    const a = p.alpha * (0.7 + 0.3 * Math.sin(p.pulse));
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${color}, ${a})`;
    ctx.fill();
  }

  // Connecting lines for nearby pairs.
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i += 1) {
    for (let j = i + 1; j < particles.length; j += 1) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < connectDistance) {
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.strokeStyle = `rgba(${color}, ${0.04 * (1 - dist / connectDistance)})`;
        ctx.stroke();
      }
    }
  }
}
