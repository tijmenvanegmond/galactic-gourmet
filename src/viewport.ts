// ---------------------------------------------------------------------------
// Keeps the canvas backing store, the device pixel ratio and VIEW in step with
// however large CSS has decided the canvas should be.
//
// VIEW is the game's viewport in CSS pixels. Everything that positions in
// screen space — the camera transforms, the panels, the starfield, the pointer
// mapping — reads it live, so resizing shows more or less of the world rather
// than stretching what was already there.
// ---------------------------------------------------------------------------

import { VIEW } from './config';

/** Beyond 2 the extra pixels cost more than they show. */
const MAX_DPR = 2;

export function fitViewport(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const rect = canvas.getBoundingClientRect();
  const cssWidth = Math.max(1, Math.round(rect.width));
  const cssHeight = Math.max(1, Math.round(rect.height));
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

  VIEW.width = cssWidth;
  VIEW.height = cssHeight;

  const backingWidth = Math.round(cssWidth * dpr);
  const backingHeight = Math.round(cssHeight * dpr);
  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  // Assigning width or height resets the context entirely, so the ratio
  // transform is re-applied every fit rather than once at startup. After this
  // every draw call is in CSS pixels.
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/**
 * Fits now and on every subsequent resize. Observing the canvas is safe: its
 * CSS box is set by the stylesheet, so changing the backing store cannot feed
 * back into layout.
 */
export function watchViewport(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const fit = (): void => fitViewport(canvas, ctx);
  fit();

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(fit).observe(canvas);
  } else {
    window.addEventListener('resize', fit);
  }
  // Moving between displays can change the ratio without changing the size.
  window.addEventListener('resize', fit);
}
