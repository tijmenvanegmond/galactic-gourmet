import { SIM, SUN, PHYSICS, STAGES, ORBIT, JUICE } from './config';
import {
  gravityAt, heatRate, heatMultiplier, spiceRingsAt,
  planetPos, planetVel, hasCleared, bandFor,
} from './world';
import type {
  Food, Input, Level, Payload, PayloadHooks, Planet, Stage, StepOutcome,
} from './types';

const FLYING: StepOutcome = { kind: 'flying' };

// Loss reasons are shared so the caller can react to them without matching
// strings it invented itself.
export const LOST_TO_STAR = 'vaporised by the star';
export const LOST_TO_SPACE = 'lost to deep space';

export function createPayload(
  x: number,
  y: number,
  vx: number,
  vy: number,
  ignore: Planet | null,
  food: Food,
): Payload {
  return {
    x, y, vx, vy,
    angle: Math.atan2(vy, vx),
    food,
    heat: 0,
    charred: false,
    stage: 0,
    fuel: STAGES[0].fuel,
    rack: [],
    trail: [],
    orbit: null,
    ignore,
    squash: 0,
    burning: false,
  };
}

export function currentStage(pod: Payload): Stage {
  return STAGES[pod.stage];
}

/**
 * How hard to turn this step, as a fraction of the turn rate.
 *
 * A key is a rudder — hold it and it keeps turning. A drag names a heading
 * instead, and the clamp is what makes that work: the pod turns at full rate
 * until the last step, which is scaled down to land exactly on the heading
 * rather than swinging past it and hunting back.
 */
function steerRate(pod: Payload, input: Input, dt: number): number {
  if (input.heading === null) return input.steer;
  const d = input.heading - pod.angle;
  const shortest = Math.atan2(Math.sin(d), Math.cos(d));
  const step = PHYSICS.turnRate * dt;
  return Math.max(-1, Math.min(1, shortest / step));
}

/** Drops the live stage and arms the next. Remaining fuel is forfeited. */
export function jettison(pod: Payload): boolean {
  if (pod.stage >= STAGES.length - 1) return false;
  pod.stage += 1;
  pod.fuel = STAGES[pod.stage].fuel;
  return true;
}

/**
 * Park the pod in orbit around the planet it just touched. The approach
 * direction sets which way it sweeps, so a grazing pass keeps its handedness.
 */
export function capture(pod: Payload, planet: Planet, t: number): void {
  const c = planetPos(planet, t);
  const pv = planetVel(planet, t);
  const rx = pod.x - c.x, ry = pod.y - c.y;
  const relVx = pod.vx - pv.x, relVy = pod.vy - pv.y;
  const radius = planet.radius + ORBIT.altitude;

  pod.orbit = {
    planet,
    radius,
    angle: Math.atan2(ry, rx),
    dir: rx * relVy - ry * relVx >= 0 ? 1 : -1,
    rate: ORBIT.rate * (ORBIT.refRadius / radius),
  };
  pod.ignore = null;
  pod.squash = 1;
  pod.burning = false;
  placeInOrbit(pod, t);
}

/** Break orbit under a fresh impulse. Costs no payload — same dish, new shot. */
export function relaunch(pod: Payload, vx: number, vy: number): void {
  pod.ignore = pod.orbit ? pod.orbit.planet : null;
  pod.orbit = null;
  pod.vx = vx;
  pod.vy = vy;
  pod.angle = Math.atan2(vy, vx);
}

/** Writes position, facing and velocity from the orbit parameters. */
function placeInOrbit(pod: Payload, t: number): void {
  const o = pod.orbit;
  if (!o) return;
  const c = planetPos(o.planet, t);
  const pv = planetVel(o.planet, t);
  const ca = Math.cos(o.angle), sa = Math.sin(o.angle);

  pod.x = c.x + ca * o.radius;
  pod.y = c.y + sa * o.radius;
  pod.angle = o.angle + o.dir * Math.PI / 2;

  // Reported so the HUD, the camera and a relaunch all inherit the real motion.
  const tangential = o.rate * o.radius * o.dir * ORBIT.inheritVelocity;
  pod.vx = -sa * tangential + pv.x;
  pod.vy = ca * tangential + pv.y;
}

/** Roasting, spice pickup and trail — everything that happens wherever it is. */
function cook(
  pod: Payload,
  t: number,
  level: Level,
  sunDist: number,
  hooks: PayloadHooks,
  dt: number,
): void {
  for (const p of spiceRingsAt(pod.x, pod.y, t, level.planets, level.spiceRing, pod.rack)) {
    pod.rack.push(p.spice);
    hooks.pickup(pod, p);
  }

  pod.heat += heatRate(sunDist) * heatMultiplier(pod.rack) * dt;
  pod.squash *= 0.88;

  // Past the last edible band it is ruined, and it has something to say about
  // that. Latched, because it is only ruined once.
  if (!pod.charred && bandFor(pod.heat).label === 'charcoal') {
    pod.charred = true;
    hooks.charred(pod);
  }

  pod.trail.push({ x: pod.x, y: pod.y });
  if (pod.trail.length > JUICE.trailLength) pod.trail.shift();
}

/**
 * Advance one step. Side effects (particles, pickup messages) are reported via
 * callbacks so the physics stays free of rendering concerns.
 */
export function stepPayload(
  pod: Payload,
  t: number,
  level: Level,
  input: Input,
  hooks: PayloadHooks,
): StepOutcome {
  const dt = SIM.dt;
  const { planets } = level;

  // --- parked in orbit: it still cooks, and the star can still claim it -----
  if (pod.orbit) {
    pod.orbit.angle += pod.orbit.dir * pod.orbit.rate * dt;
    placeInOrbit(pod, t);
    const sunDist = Math.hypot(pod.x, pod.y);
    cook(pod, t, level, sunDist, hooks, dt);
    if (sunDist < SUN.radius) return { kind: 'lost', reason: LOST_TO_STAR };
    return FLYING;
  }

  // --- free flight ---------------------------------------------------------
  const stage = STAGES[pod.stage];
  pod.angle += steerRate(pod, input, dt) * PHYSICS.turnRate * dt;

  pod.burning = (input.thrust || input.burn) && pod.fuel > 0;
  if (pod.burning) {
    pod.vx += Math.cos(pod.angle) * stage.thrust * dt;
    pod.vy += Math.sin(pod.angle) * stage.thrust * dt;
    pod.fuel = Math.max(0, pod.fuel - dt);
    hooks.exhaust(pod);
  }

  if (pod.ignore && hasCleared(pod.x, pod.y, t, pod.ignore)) pod.ignore = null;

  const g = gravityAt(pod.x, pod.y, t, planets, pod.ignore);
  pod.vx += g.ax * dt;
  pod.vy += g.ay * dt;
  pod.x += pod.vx * dt;
  pod.y += pod.vy * dt;

  cook(pod, t, level, g.sunDist, hooks, dt);

  if (g.sunDist < SUN.radius) return { kind: 'lost', reason: LOST_TO_STAR };
  if (g.hit) {
    // A gas giant has no surface to park on — it just swallows the dish.
    if (g.hit.gas) {
      return { kind: 'lost', reason: `crushed in ${g.hit.name}'s atmosphere` };
    }
    capture(pod, g.hit, t);
    return { kind: 'captured', planet: g.hit };
  }
  if (Math.hypot(pod.x, pod.y) > PHYSICS.worldBoundary) {
    return { kind: 'lost', reason: LOST_TO_SPACE };
  }
  return FLYING;
}
