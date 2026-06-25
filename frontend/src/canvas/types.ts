/**
 * Canvas engine types.
 *
 * All chart modules in this folder expose a `draw(ctx, size, ...)` function
 * that takes a pre-scaled CanvasRenderingContext2D (DPR applied by the
 * `useCanvas` hook) and a logical `CanvasSize` (in CSS pixels).
 *
 * Keeping the contract uniform means a parent component can swap
 * visualization modules without re-plumbing the render loop.
 */

/** Width and height in logical CSS pixels (NOT multiplied by DPR). */
export interface CanvasSize {
  width: number;
  height: number;
}

/**
 * The shared draw contract every chart implements.
 *
 * `ctx` is the 2D context with `setTransform` already applied so that
 * the chart can draw in CSS-pixel coordinates without thinking about DPR.
 */
export type DrawFn = (ctx: CanvasRenderingContext2D, size: CanvasSize) => void;
