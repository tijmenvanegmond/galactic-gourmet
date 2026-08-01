import { SIM, SUN, PHYSICS, PREDICT } from './config';
import {
  gravityAt, heatRate, heatMultiplier, spiceRingsAt, hasCleared,
} from './world';
import type { Level, Planet, PredictPoint, Prediction, SpiceName } from './types';

/**
 * Forward-integrate a coasting payload using the identical step the live sim
 * uses, so the dotted line and the actual flight agree. Any thrust the player
 * applies afterwards invalidates it — that is intentional.
 *
 * `ignore` is the world being launched from, suppressed until the pod clears
 * it, exactly as in flight.
 */
export function predict(
  vx: number,
  vy: number,
  sx: number,
  sy: number,
  t0: number,
  level: Level,
  ignore: Planet | null,
): Prediction {
  const { planets, spiceRing } = level;
  const dt = SIM.dt;

  let x = sx, y = sy, t = t0;
  let skip = ignore;
  const points: PredictPoint[] = [];
  const held: SpiceName[] = [];
  let heat = 0;

  for (let i = 0; i < PREDICT.steps; i++) {
    if (skip && hasCleared(x, y, t, skip)) skip = null;

    const g = gravityAt(x, y, t, planets, skip);
    vx += g.ax * dt;
    vy += g.ay * dt;
    x += vx * dt;
    y += vy * dt;
    t += dt;

    for (const p of spiceRingsAt(x, y, t, planets, spiceRing, held)) {
      held.push(p.spice);
      points.push({ x, y, pickup: p.spice });
    }

    heat += heatRate(g.sunDist) * heatMultiplier(held) * dt;

    if (g.sunDist < SUN.radius) {
      points.push({ x, y, terminal: true });
      break;
    }
    // Where the pod gets parked — unless the thing it meets is a gas giant,
    // which is still very much a wreck.
    if (g.hit) {
      points.push(g.hit.gas ? { x, y, terminal: true } : { x, y, capture: true });
      break;
    }
    if (Math.hypot(x, y) > PHYSICS.worldBoundary) break;
    if (i % PREDICT.sample === 0) points.push({ x, y, heat });
  }

  return { points, heat, held };
}
