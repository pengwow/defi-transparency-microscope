/**
 * ParticleSystem — animated confetti-style visualization of transactions.
 *
 * Each transaction becomes a particle that fades in from the top of the
 * canvas and falls toward the bottom.  Particle colour is determined by
 * transaction type, and a small label is rendered for high-value trades
 * (top 10% by gas cost).
 *
 * The animation is driven by the parent `useCanvas` rAF loop.  This
 * module keeps a tiny piece of in-module state (the live particles) and
 * reseeds it whenever the input `transactions` reference changes.
 *
 * NOTE: The module-level `lastRef` is intentional.  The whole point of
 * the canvas engine is to be self-contained; alternative is for the
 * hook to manage per-chart state, which it doesn't.
 */

import type { CanvasSize } from './types';
import type { Transaction } from '@/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // 0..1
  hue: number;
  size: number;
  label?: string;
  hot: boolean;
}

let particles: Particle[] = [];
let lastRef: ReadonlyArray<Transaction> | null = null;

/** Reset the particle field, e.g. when the input set changes drastically. */
export function resetParticles(): void {
  particles = [];
  lastRef = null;
}

function makeParticle(t: Transaction, w: number, _h: number): Particle {
  // Color by type: swap=warm, add=green, remove=orange, transfer=blue, approve=violet.
  let hue = 200;
  switch (t.type) {
    case 'swap':
      hue = 20;
      break;
    case 'add_liquidity':
      hue = 130;
      break;
    case 'remove_liquidity':
      hue = 35;
      break;
    case 'transfer':
      hue = 210;
      break;
    case 'approve':
      hue = 280;
      break;
  }
  return {
    x: Math.random() * w,
    y: -10,
    vx: (Math.random() - 0.5) * 30,
    vy: 20 + Math.random() * 50,
    life: 1,
    hue,
    size: 2 + Math.random() * 3,
    label: undefined,
    hot: false,
  };
}

/** Draw + advance the particle field. */
export function draw(
  ctx: CanvasRenderingContext2D,
  size: CanvasSize,
  transactions: Transaction[],
): void {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, width, height);

  // Reseed particles when the input list reference changes.
  if (lastRef !== transactions) {
    lastRef = transactions;
    // Compute the threshold for "hot" transactions (top 10% by gas cost).
    const sorted = [...transactions].sort((a, b) => Number(b.gasUsed - a.gasUsed));
    const cutoffIndex = Math.max(0, Math.floor(sorted.length * 0.1) - 1);
    const cutoffGas = sorted[cutoffIndex]?.gasUsed ?? 0n;
    particles = sorted.map((t) => {
      const p = makeParticle(t, width, height);
      const hot = t.gasUsed >= cutoffGas && cutoffGas > 0n;
      p.hot = hot;
      if (hot) p.label = t.hash.slice(0, 6);
      return p;
    });
  }

  // Advance + render.
  const dt = 1 / 60;
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 0.3;
  }
  // Remove dead or off-screen particles, and respawn from the top.
  particles = particles.filter((p) => p.life > 0 && p.y < height + 20);
  while (particles.length < Math.min(120, transactions.length * 4 + 20)) {
    if (transactions.length === 0) break;
    const t = transactions[Math.floor(Math.random() * transactions.length)];
    particles.push(makeParticle(t, width, height));
  }

  // Draw particles.
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = `hsl(${p.hue}, 80%, 60%)`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    if (p.hot && p.label) {
      ctx.fillStyle = '#fff';
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(p.label, p.x + 6, p.y - 6);
    }
  }
  ctx.globalAlpha = 1;

  // HUD with particle count.
  ctx.fillStyle = '#e6e8ef';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText(`particles: ${particles.length}`, 8, 14);
}
