// ---------------------------------------------------------------------------
// Feedback that carries no game state: screen shake, hit-stop, full-frame
// flashes, shockwave rings and floating score text. Gameplay code fires these
// and never reads them back.
// ---------------------------------------------------------------------------

import { JUICE } from './config';
import type { Juice } from './types';

export function createJuice(): Juice {
  return { shake: 0, freeze: 0, flash: 0, flashColor: '#FFFFFF', rings: [], pops: [] };
}

/** Trauma is additive and clamped; the renderer squares it, so small is subtle. */
export function shake(j: Juice, amount: number): void {
  j.shake = Math.min(1, j.shake + amount);
}

/** Hit-stop. The sim holds still for a few frames while the screen keeps shaking. */
export function freeze(j: Juice, frames: number): void {
  j.freeze = Math.max(j.freeze, frames);
}

export function flash(j: Juice, color: string, amount = 0.5): void {
  j.flash = Math.min(1, Math.max(j.flash, amount));
  j.flashColor = color;
}

export function ring(
  j: Juice,
  x: number,
  y: number,
  color: string,
  vr = 3.2,
  width = 2.4,
  decay = 0.035,
): void {
  j.rings.push({ x, y, r: 2, vr, life: 1, decay, width, color });
}

export function pop(
  j: Juice,
  x: number,
  y: number,
  text: string,
  color: string,
  size = 13,
  // A number is read at a glance; a sentence is not, so anything wordier
  // asks for a slower one.
  decay = 0.011,
): void {
  j.pops.push({ x, y, text, color, size, life: 1, decay, vy: -0.55 });
}

export function stepJuice(j: Juice): void {
  j.shake = Math.max(0, j.shake - JUICE.shakeDecay);
  j.flash = Math.max(0, j.flash - JUICE.flashDecay);

  for (const r of j.rings) {
    r.r += r.vr;
    r.vr *= 0.94;
    r.life -= r.decay;
  }
  j.rings = j.rings.filter(r => r.life > 0);

  for (const p of j.pops) {
    p.y += p.vy;
    p.vy *= 0.96;
    p.life -= p.decay;
  }
  j.pops = j.pops.filter(p => p.life > 0);
}

/** Screen offset and roll for the current trauma. */
export function shakeTransform(j: Juice): { x: number; y: number; roll: number } {
  if (j.shake <= 0) return { x: 0, y: 0, roll: 0 };
  const t = j.shake * j.shake;
  return {
    x: (Math.random() * 2 - 1) * JUICE.shakePixels * t,
    y: (Math.random() * 2 - 1) * JUICE.shakePixels * t,
    roll: (Math.random() * 2 - 1) * JUICE.shakeRoll * t,
  };
}
