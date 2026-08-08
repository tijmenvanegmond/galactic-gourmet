// ---------------------------------------------------------------------------
// The fullscreen toggle. It lives on the canvas like the rest of the HUD, so
// this module owns where the button is and what pressing it does; `panels.ts`
// draws it, because drawing chrome is that module's job.
// ---------------------------------------------------------------------------

import { VIEW, PANELS } from './config';
import type { Vec2 } from './types';

const SIZE = 24;

/** Tucked under the minimap, in the corner the world is least likely to need. */
export function buttonRect(): { x: number; y: number; w: number; h: number } {
  const m = PANELS.margin;
  return {
    x: VIEW.width - m - SIZE,
    y: m + PANELS.minimapSize + 8,
    w: SIZE,
    h: SIZE,
  };
}

/**
 * Not everywhere can do this — iOS Safari will not put anything but a video
 * fullscreen — so the button is only drawn where pressing it would work.
 */
export function isSupported(): boolean {
  return typeof document !== 'undefined' && document.fullscreenEnabled === true;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Hit test in canvas space, with a little slack for a fingertip. */
export function hitsButton(pt: Vec2): boolean {
  if (!isSupported()) return false;
  const r = buttonRect();
  const pad = 6;
  return pt.x >= r.x - pad && pt.x <= r.x + r.w + pad
    && pt.y >= r.y - pad && pt.y <= r.y + r.h + pad;
}

/**
 * Both directions of the toggle reject rather than throw when the browser
 * refuses — a denied request should do nothing, not take the frame loop with
 * it. The canvas resizes itself either way: `viewport.ts` is watching it.
 */
export function toggle(el: HTMLElement): void {
  if (isFullscreen()) {
    void document.exitFullscreen().catch(() => {});
  } else {
    void el.requestFullscreen().catch(() => {});
  }
}
