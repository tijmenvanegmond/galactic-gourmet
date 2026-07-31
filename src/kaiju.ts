import { SIM } from './config';
import { planetPos } from './world';
import { rollName } from './voice';
import type {
  Kaiju, KaijuConfig, KaijuMode, KaijuStep, Level, Payload, Planet, Vec2,
} from './types';

export function createKaiju(level: Level, home: Planet, t: number): Kaiju {
  const cfg = level.kaiju;
  const h = planetPos(home, t);
  const angle = Math.atan2(h.y, h.x) + cfg.spawnAngleOffset;
  const x = Math.cos(angle) * cfg.spawnRadius;
  const y = Math.sin(angle) * cfg.spawnRadius;
  const heading = Math.atan2(h.y - y, h.x - x);

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
    patience: cfg.patience,
    arrived: false,
    devouring: false,
    grumbled: false,
  };
}

/**
 * Which mode it is in. Thresholds widen by `loseInterest` once a lock is held,
 * so a dish hovering near the boundary doesn't make it flicker between states.
 */
function modeFor(kaiju: Kaiju, cfg: KaijuConfig, food: number, home: number): KaijuMode {
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
  return home < cfg.loiterRadius * 1.08 ? 'loiter' : 'hunt';
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

  const toHome = Math.hypot(h.x - kaiju.x, h.y - kaiju.y);
  const toFood = pod ? Math.hypot(pod.x - kaiju.x, pod.y - kaiju.y) : Infinity;
  const mode = modeFor(kaiju, cfg, toFood, toHome);
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
    const a = Math.atan2(kaiju.y - h.y, kaiju.x - h.x) + cfg.loiterLead;
    tx = h.x + Math.cos(a) * cfg.loiterRadius;
    ty = h.y + Math.sin(a) * cfg.loiterRadius;
    speed = cfg.loiterSpeed;
    weave = cfg.slitherAmp;
  } else {
    tx = h.x;
    ty = h.y;
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
  if (mode === 'loiter') {
    kaiju.arrived = true;
    kaiju.patience -= dt;
    if (kaiju.patience <= 0) {
      kaiju.patience = 0;
      kaiju.devouring = true;
      kaiju.mode = 'devour';
      committed = true;
    }
  }
  if (!kaiju.grumbled && kaiju.arrived && kaiju.patience < cfg.patience * 0.28) {
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
  kaiju.distance = Math.hypot(h.x - kaiju.x, h.y - kaiju.y);

  return {
    // Only a committed kaiju actually eats the planet; a chase that happens to
    // sweep past Earth is not the end of the run.
    reachedHome: kaiju.mode === 'devour' && kaiju.distance < home.radius + 28,
    spotted: (was === 'hunt' || was === 'loiter') && (mode === 'chase' || mode === 'lunge'),
    lunged: was !== 'lunge' && mode === 'lunge',
    loitered: was !== 'loiter' && mode === 'loiter' && !kaiju.devouring,
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
  if (!kaiju.arrived) {
    const travel = Math.max(0, kaiju.distance - cfg.loiterRadius) / kaiju.speed;
    return { label: 'Kaiju ETA', seconds: wallClock(travel), urgent: false };
  }
  return {
    label: 'Patience',
    seconds: wallClock(kaiju.patience),
    urgent: kaiju.patience < cfg.patience * 0.28,
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
