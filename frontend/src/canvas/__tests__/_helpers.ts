/**
 * Shared helpers for the canvas chart tests.
 */

import { vi } from 'vitest';

type CanvasCtx = CanvasRenderingContext2D & Record<string, ReturnType<typeof vi.fn>>;

const METHODS = [
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
];

export function makeMockCtx(): CanvasCtx {
  const ctx: Record<string, unknown> = {};
  for (const m of METHODS) {
    ctx[m] = vi.fn(() => undefined);
  }
  Object.defineProperty(ctx, 'fillStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'strokeStyle', { writable: true, value: '' });
  Object.defineProperty(ctx, 'lineWidth', { writable: true, value: 1 });
  Object.defineProperty(ctx, 'font', { writable: true, value: '' });
  Object.defineProperty(ctx, 'textAlign', { writable: true, value: 'start' });
  Object.defineProperty(ctx, 'globalAlpha', { writable: true, value: 1 });
  return ctx as unknown as CanvasCtx;
}
