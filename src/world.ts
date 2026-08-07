import { SUN, PHYSICS, LAUNCH, SPICES, BANDS } from './config';
import type { Band, BandLabel, Planet, SpiceName, SpicedPlanet, Vec2 } from './types';

export interface GravitySample {
  ax: number;
  ay: number;
  sunDist: number;
  hit: Planet | null;
}

// Planet orbits are kinematic: they are placed on rails rather than integrated.
// See README "Known simplification" for what that costs. A moon rides its
// parent's rail and turns on its own, so both are one level of recursion.
export function planetPos(p: Planet, t: number): Vec2 {
  const a = p.a0 + p.w * t;
  const c = p.parent ? planetPos(p.parent, t) : SUN;
  return { x: c.x + Math.cos(a) * p.orbit, y: c.y + Math.sin(a) * p.orbit };
}

export function planetVel(p: Planet, t: number): Vec2 {
  const a = p.a0 + p.w * t;
  const base = p.parent ? planetVel(p.parent, t) : { x: 0, y: 0 };
  return {
    x: base.x - Math.sin(a) * p.orbit * p.w,
    y: base.y + Math.cos(a) * p.orbit * p.w,
  };
}

/**
 * Net gravitational acceleration at a point, plus collision report.
 * `ignore` suppresses one planet entirely — the world the pod just left — so a
 * fresh launch is not yanked straight back into the surface it lifted off.
 */
export function gravityAt(
  x: number,
  y: number,
  t: number,
  planets: Planet[],
  ignore: Planet | null = null,
): GravitySample {
  let ax = 0, ay = 0;
  let hit: Planet | null = null;

  let dx = SUN.x - x, dy = SUN.y - y;
  let d2 = dx * dx + dy * dy;
  let d = Math.sqrt(d2) || 1;
  const sunDist = d;
  let a = SUN.gm / (d2 + SUN.soft);
  ax += a * dx / d;
  ay += a * dy / d;

  for (const p of planets) {
    if (p === ignore) continue;
    const q = planetPos(p, t);
    dx = q.x - x; dy = q.y - y;
    d2 = dx * dx + dy * dy;
    d = Math.sqrt(d2) || 1;
    a = p.gm / (d2 + PHYSICS.planetSoft);
    ax += a * dx / d;
    ay += a * dy / d;
    if (d < p.radius + 8) hit = p;
  }

  return { ax, ay, sunDist, hit };
}

/**
 * The speed a circular orbit at this distance from the star actually needs,
 * from the same softened field the payload flies in: a = gm/(r²+soft), and a
 * circle needs a = v²/r.
 */
export function orbitalSpeed(r: number): number {
  return Math.sqrt((SUN.gm * r) / (r * r + SUN.soft));
}

/** The outermost body a moon is ultimately riding — whose way round the star. */
function rootOf(p: Planet): Planet {
  return p.parent ? rootOf(p.parent) : p;
}

/**
 * The velocity a launch borrows from its own position: the orbit it ought to
 * already be in, in the same direction its world goes round the star. Retrograde
 * worlds hand out retrograde launches.
 */
export function launchVelocity(x: number, y: number, from: Planet): Vec2 {
  const r = Math.hypot(x, y) || 1;
  const dir = Math.sign(rootOf(from).w) || 1;
  const v = orbitalSpeed(r) * LAUNCH.inheritOrbital * dir;
  return { x: (-y / r) * v, y: (x / r) * v };
}

/** Roast units per sim-second at a given distance from the star. */
export function heatRate(sunDist: number): number {
  const near = Math.max(0, (SUN.heatRadius - sunDist) / SUN.heatRadius);
  return Math.pow(near, SUN.heatFalloff) * SUN.heatRate;
}

/** Normalised 0..1 proximity to the star, for particle/glow effects. */
export function heatProximity(sunDist: number): number {
  return Math.max(0, (SUN.heatRadius - sunDist) / SUN.heatRadius);
}

/** Planets whose spice ring contains this point and whose spice isn't held yet. */
export function spiceRingsAt(
  x: number,
  y: number,
  t: number,
  planets: Planet[],
  ringWidth: number,
  held: SpiceName[],
): SpicedPlanet[] {
  const found: SpicedPlanet[] = [];
  for (const p of planets) {
    if (!p.spice || held.includes(p.spice)) continue;
    const q = planetPos(p, t);
    if (Math.hypot(q.x - x, q.y - y) < p.radius + ringWidth) found.push(p as SpicedPlanet);
  }
  return found;
}

export function heatMultiplier(rack: SpiceName[]): number {
  return rack.reduce((m, s) => m * SPICES[s].heat, 1);
}

export function scoreMultiplier(rack: SpiceName[]): number {
  return rack.reduce((m, s) => m * SPICES[s].score, 1);
}

export function bandFor(heat: number): Band {
  // The bands cover 0..Infinity, so the fallback is only reachable if heat
  // ever went negative — it cannot, but the type demands an answer.
  return BANDS.find(b => heat >= b.lo && heat < b.hi) ?? BANDS[0];
}

export function bandIndex(label: BandLabel): number {
  return BANDS.findIndex(b => b.label === label);
}

export function bandByLabel(label: BandLabel): Band {
  return BANDS[Math.max(0, bandIndex(label))];
}

/** True once the pod has escaped the exclusion bubble of the world it left. */
export function hasCleared(x: number, y: number, t: number, planet: Planet): boolean {
  const q = planetPos(planet, t);
  return Math.hypot(x - q.x, y - q.y) > planet.radius + PHYSICS.clearance;
}

export function homePlanet(planets: Planet[]): Planet {
  const home = planets.find(p => p.home);
  if (!home) throw new Error('level has no home planet');
  return home;
}
