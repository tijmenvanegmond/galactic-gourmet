import { SIM } from './config';
import { planetPos } from './world';
import { rollName } from './voice';
import type {
  Kaiju, KaijuConfig, KaijuMode, KaijuStep, Level, Payload, Planet, Vec2,
} from './types';

/** How long it will hang around a given world before moving on. */
function dwellFor(planet: Planet, cfg: KaijuConfig): number {
  return planet.home ? cfg.patience : cfg.visitTime;
}

/** The world it is at, or on its way to. */
export function currentStop(kaiju: Kaiju): Planet {
  return kaiju.tour[kaiju.stop];
}

export function createKaiju(level: Level, home: Planet, t: number): Kaiju {
  const cfg = level.kaiju;
  const h = planetPos(home, t);
  const angle = Math.atan2(h.y, h.x) + cfg.spawnAngleOffset;
  const x = Math.cos(angle) * cfg.spawnRadius;
  const y = Math.sin(angle) * cfg.spawnRadius;
  const heading = Math.atan2(h.y - y, h.x - x);

  // It works its way inward through the system and saves home for last, which
  // is both the sensible approach from deep space and the better joke.
  const tour = level.planets.filter(p => !p.home).sort((a, b) => b.orbit - a.orbit);
  tour.push(home);

  // Laid out behind the head so it arrives already stretched out rather than
  // unfurling from a single point.
  const segments: Vec2[] = [];
  for (let i = 1; i <= cfg.segments; i++) {
    segments.push({
      x: x - Math.cos(heading) * cfg.segmentSpacing * i,
      y: y - Math.sin(heading) * cfg.segmentSpacing * i,
    });
  }

  return {
    x, y,
    speed: cfg.speed,
    mouth: 0,
    distance: cfg.spawnRadius,
    rage: 0,
    chew: 0,
    name: rollName(),
    mode: 'hunt',
    heading,
    drool: 0,
    segments,
    phase: 0,
    tour,
    stop: 0,
    patience: dwellFor(tour[0], cfg),
    patienceMax: dwellFor(tour[0], cfg),
    arrived: false,
    devouring: false,
    grumbled: false,
  };
}

/**
 * Which mode it is in. Thresholds widen by `loseInterest` once a lock is held,
 * so a dish hovering near the boundary doesn't make it flicker between states.
 */
function modeFor(kaiju: Kaiju, cfg: KaijuConfig, food: number, stop: number): KaijuMode {
  if (kaiju.devouring) return 'devour';

  const held = kaiju.mode;
  if (food < Infinity) {
    const sense = held === 'hunt' || held === 'loiter'
      ? cfg.senseRadius
      : cfg.senseRadius * cfg.loseInterest;
    if (food < sense) {
      const lunge = held === 'lunge' ? cfg.lungeRadius * cfg.loseInterest : cfg.lungeRadius;
      return food < lunge ? 'lunge' : 'chase';
    }
  }
  return stop < cfg.loiterRadius * 1.08 ? 'loiter' : 'hunt';
}

/** Rope-follow: each link is dragged along to keep its spacing from the last. */
function dragBody(kaiju: Kaiju, cfg: KaijuConfig): void {
  let px = kaiju.x, py = kaiju.y;
  for (const s of kaiju.segments) {
    const dx = px - s.x, dy = py - s.y;
    const d = Math.hypot(dx, dy);
    if (d > cfg.segmentSpacing) {
      const k = (d - cfg.segmentSpacing) / d;
      s.x += dx * k;
      s.y += dy * k;
    }
    px = s.x;
    py = s.y;
  }
}

/**
 * Cruises in, then prowls a ring around the home planet while its patience
 * burns down. Food inside the sense radius interrupts everything — until
 * patience runs out, at which point it commits to the planet and stops caring.
 */
export function stepKaiju(
  kaiju: Kaiju,
  t: number,
  home: Planet,
  pod: Payload | null,
  cfg: KaijuConfig,
): KaijuStep {
  const dt = SIM.dt;
  const h = planetPos(home, t);
  const was = kaiju.mode;
  const wasImpatient = kaiju.grumbled;

  const dest = currentStop(kaiju);
  const dp = planetPos(dest, t);
  const toStop = Math.hypot(dp.x - kaiju.x, dp.y - kaiju.y);
  const toFood = pod ? Math.hypot(pod.x - kaiju.x, pod.y - kaiju.y) : Infinity;
  const mode = modeFor(kaiju, cfg, toFood, toStop);
  kaiju.mode = mode;

  let tx: number, ty: number, speed: number, weave: number;

  if (pod && (mode === 'lunge' || mode === 'chase')) {
    tx = pod.x;
    ty = pod.y;
    speed = mode === 'lunge' ? cfg.lungeSpeed : cfg.chaseSpeed;
    weave = mode === 'lunge' ? cfg.slitherStrike : cfg.slitherChase;
  } else if (mode === 'loiter') {
    // Aim at a point a little further round the ring than where it is now.
    // Circling falls out of that, and the radius self-corrects.
    const a = Math.atan2(kaiju.y - dp.y, kaiju.x - dp.x) + cfg.loiterLead;
    tx = dp.x + Math.cos(a) * cfg.loiterRadius;
    ty = dp.y + Math.sin(a) * cfg.loiterRadius;
    speed = cfg.loiterSpeed;
    weave = cfg.slitherAmp;
  } else {
    // Travelling to the next world on the tour, or charging the last one.
    tx = dp.x;
    ty = dp.y;
    speed = mode === 'devour' ? cfg.devourSpeed : kaiju.speed;
    weave = mode === 'devour' ? cfg.slitherChase : cfg.slitherAmp;
  }

  // The weave is what makes it slither: it never quite swims at its target.
  kaiju.phase += cfg.slitherFreq * dt * (mode === 'hunt' || mode === 'loiter' ? 1 : 1.9);
  const bearing = Math.atan2(ty - kaiju.y, tx - kaiju.x);
  kaiju.heading = bearing + Math.sin(kaiju.phase) * weave;

  kaiju.x += Math.cos(kaiju.heading) * speed * dt;
  kaiju.y += Math.sin(kaiju.heading) * speed * dt;
  dragBody(kaiju, cfg);

  // Patience only burns while it is waiting. Food is a distraction, and a
  // distracted kaiju is not counting down.
  let committed = false;
  let loitered = false;
  let movedOn = false;
  if (mode === 'loiter') {
    if (!kaiju.arrived) {
      kaiju.arrived = true;
      loitered = true;
    }
    kaiju.patience -= dt;
    if (kaiju.patience <= 0) {
      if (dest.home) {
        // Last stop. Nothing left to be polite about.
        kaiju.patience = 0;
        kaiju.devouring = true;
        kaiju.mode = 'devour';
        committed = true;
      } else {
        kaiju.stop = Math.min(kaiju.stop + 1, kaiju.tour.length - 1);
        kaiju.patience = dwellFor(currentStop(kaiju), cfg);
        kaiju.patienceMax = kaiju.patience;
        kaiju.arrived = false;
        kaiju.grumbled = false;
        movedOn = true;
      }
    }
  }
  // Only the countdown that actually ends the run is worth grumbling about.
  if (!kaiju.grumbled && kaiju.arrived && dest.home
      && kaiju.patience < kaiju.patienceMax * 0.28) {
    kaiju.grumbled = true;
  }

  // Excitement eases in, so the maw and the drool lag the decision slightly.
  const want = mode === 'lunge' ? 1 : mode === 'chase' ? 0.55 : mode === 'devour' ? 0.7 : 0;
  kaiju.drool += (want - kaiju.drool) * 0.12;
  kaiju.mouth = mode === 'hunt' || mode === 'loiter'
    ? 0.5 + 0.5 * Math.sin(t * 0.05)
    : Math.min(1, 0.5 + kaiju.drool * 0.7);

  kaiju.rage = Math.max(0, kaiju.rage - 0.012);
  kaiju.chew = Math.max(0, kaiju.chew - 0.03);
  // Reported as the distance to whatever it is currently heading for, which is
  // what the clock in the HUD is counting down.
  kaiju.distance = Math.hypot(dp.x - kaiju.x, dp.y - kaiju.y);

  return {
    // Only a committed kaiju actually eats the planet; a chase that happens to
    // sweep past Earth is not the end of the run.
    reachedHome: kaiju.mode === 'devour'
      && Math.hypot(h.x - kaiju.x, h.y - kaiju.y) < home.radius + 28,
    spotted: (was === 'hunt' || was === 'loiter') && (mode === 'chase' || mode === 'lunge'),
    lunged: was !== 'lunge' && mode === 'lunge',
    loitered,
    movedOn,
    impatient: !wasImpatient && kaiju.grumbled,
    committed,
  };
}

/** How far it can actually snatch from — it reaches further mid-lunge. */
export function grabRadius(kaiju: Kaiju, cfg: KaijuConfig): number {
  return cfg.captureRadius + (kaiju.mode === 'lunge' ? cfg.grabReach * kaiju.drool : 0);
}

/** Sim-seconds to wall-clock seconds at the current time scale. */
function wallClock(simSeconds: number): number {
  return Math.max(0, Math.round(simSeconds / (60 * SIM.dt)));
}

/**
 * The one number the player needs: how long until it arrives, or once it is
 * here, how long it will tolerate waiting.
 */
export function kaijuClock(
  kaiju: Kaiju,
  cfg: KaijuConfig,
): { label: string; seconds: number; urgent: boolean } {
  if (kaiju.devouring) {
    return {
      label: 'Incoming',
      seconds: wallClock(kaiju.distance / cfg.devourSpeed),
      urgent: true,
    };
  }
  const dest = currentStop(kaiju);
  if (!kaiju.arrived) {
    const travel = Math.max(0, kaiju.distance - cfg.loiterRadius) / kaiju.speed;
    return { label: `To ${dest.name}`, seconds: wallClock(travel), urgent: false };
  }
  return {
    // At the last stop the countdown is the run itself, so it gets the
    // sharper word — and the pulse.
    label: dest.home ? 'Patience' : `At ${dest.name}`,
    seconds: wallClock(kaiju.patience),
    urgent: dest.home === true && kaiju.patience < kaiju.patienceMax * 0.28,
  };
}

/** A dish it liked buys time. */
export function appease(kaiju: Kaiju, cfg: KaijuConfig): number {
  const before = kaiju.patience;
  kaiju.patience = Math.min(cfg.patience, kaiju.patience + cfg.patienceServe);
  kaiju.chew = 1;
  return wallClock(kaiju.patience - before);
}

/** A dish it hated costs time, and makes it faster for the rest of the run. */
export function enrage(kaiju: Kaiju, cfg: KaijuConfig): number {
  const before = kaiju.patience;
  kaiju.speed *= cfg.rejectSpeedup;
  kaiju.patience = Math.max(0, kaiju.patience - cfg.patienceReject);
  kaiju.rage = 1;
  kaiju.chew = 1;
  return wallClock(before - kaiju.patience);
}
