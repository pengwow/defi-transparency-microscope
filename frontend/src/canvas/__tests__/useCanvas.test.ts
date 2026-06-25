/**
 * Tests for the `useCanvas` hook.
 *
 * The hook is fundamentally a side-effect: it sets up an rAF loop on
 * mount, sizes the backing store, and tears down on unmount.  We mock
 * the relevant Web APIs (getContext, getBoundingClientRect, rAF) and
 * assert on the resulting canvas properties.
 */

import React from 'react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useCanvas } from '../useCanvas';

type RafCallback = (time: number) => void;

function setupCanvasEnv() {
  const setTransform = vi.fn();
  const ctx: { setTransform: ReturnType<typeof vi.fn> } = { setTransform };
  const getContext = vi.fn().mockReturnValue(ctx);
  const getBoundingClientRect = vi.fn().mockReturnValue({
    width: 200,
    height: 100,
    top: 0,
    left: 0,
    right: 200,
    bottom: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });

  HTMLCanvasElement.prototype.getContext = getContext as unknown as typeof HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getBoundingClientRect = getBoundingClientRect as unknown as typeof HTMLCanvasElement.prototype.getBoundingClientRect;

  return { setTransform, getContext, getBoundingClientRect };
}

let rafCallbacks: RafCallback[] = [];
let rafId = 0;
const originalRaf = globalThis.requestAnimationFrame;
const originalCaf = globalThis.cancelAnimationFrame;
const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');

beforeEach(() => {
  rafCallbacks = [];
  rafId = 0;
  globalThis.requestAnimationFrame = vi.fn((cb: RafCallback) => {
    rafCallbacks.push(cb);
    return ++rafId;
  }) as unknown as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = vi.fn() as unknown as typeof cancelAnimationFrame;
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = originalRaf;
  globalThis.cancelAnimationFrame = originalCaf;
  if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
});

interface MountHandle {
  unmount: () => void;
  canvas: HTMLCanvasElement;
  drawFn: ReturnType<typeof vi.fn>;
}

function mountProbe(initial: { width?: number; height?: number } = {}): MountHandle {
  const draw = vi.fn();
  const probeRef = { current: null as HTMLCanvasElement | null };
  function Probe() {
    const { ref } = useCanvas(draw, [draw]);
    // Capture the canvas DOM node so tests can assert on its properties.
    probeRef.current = ref.current;
    return React.createElement('canvas', { ref, 'data-testid': 'probe' });
  }
  const view = render(React.createElement(Probe));
  const canvas = view.getByTestId('probe') as HTMLCanvasElement;
  // width/height attribute defaults to 300/150 in jsdom, but getBoundingClientRect
  // returns whatever we mocked (200x100).  Back the CSS box with style.
  if (initial.width !== undefined) canvas.style.width = `${initial.width}px`;
  if (initial.height !== undefined) canvas.style.height = `${initial.height}px`;
  return { unmount: view.unmount, canvas, drawFn: draw };
}

describe('useCanvas', () => {
  it('schedules a requestAnimationFrame on mount', () => {
    setupCanvasEnv();
    const handle = mountProbe();
    handle.unmount();
    expect(globalThis.requestAnimationFrame).toHaveBeenCalled();
  });

  it('cancels the rAF on unmount', () => {
    setupCanvasEnv();
    const handle = mountProbe();
    handle.unmount();
    expect(globalThis.cancelAnimationFrame).toHaveBeenCalled();
  });

  it('calls drawFn with the context and size each frame', () => {
    setupCanvasEnv();
    const handle = mountProbe();
    // The first frame is scheduled but not run yet.
    expect(rafCallbacks.length).toBeGreaterThanOrEqual(1);
    act(() => {
      rafCallbacks[0](0);
    });
    expect(handle.drawFn).toHaveBeenCalledTimes(1);
    const args = handle.drawFn.mock.calls[0];
    const sizeArg = args[1] as { width: number; height: number };
    expect(sizeArg.width).toBe(200);
    expect(sizeArg.height).toBe(100);
    handle.unmount();
  });

  it('applies the devicePixelRatio transform', () => {
    const { setTransform } = setupCanvasEnv();
    const handle = mountProbe();
    act(() => {
      rafCallbacks[0](0);
    });
    // dpr=2 ⇒ setTransform(2, 0, 0, 2, 0, 0).
    expect(setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    handle.unmount();
  });

  it('multiplies the backing store size by the devicePixelRatio', () => {
    const { getBoundingClientRect } = setupCanvasEnv();
    getBoundingClientRect.mockReturnValue({
      width: 250,
      height: 150,
      top: 0,
      left: 0,
      right: 250,
      bottom: 150,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    const handle = mountProbe();
    act(() => {
      rafCallbacks[0](0);
    });
    expect(handle.canvas.width).toBe(250 * 2);
    expect(handle.canvas.height).toBe(150 * 2);
    handle.unmount();
  });
});
