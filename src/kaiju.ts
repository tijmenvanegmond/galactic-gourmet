import { SIM } from './config';
import { planetPos } from './world';
import type { Kaiju, Level, Planet } from './types';

export function createKaiju(level: Level, home: Planet, t: number): Kaiju {
  const h = planetPos(home, t);
  const angle = Math.atan2(h.y, h.x) + level.kaiju.spawnAngleOffset;
  return {
    x: Math.cos(angle) * level.kaiju.spawnRadius,
    y: Math.sin(angle) * level.kaiju.spawnRadius,
    speed: level.kaiju.speed,
    mouth: 0,
    distance: level.kaiju.spawnRadius,
    rage: 0,
    chew: 0,
  };
}

/** Homes on the home planet. Returns true if it has arrived (level lost). */
export function stepKaiju(kaiju: Kaiju, t: number, home: Planet): boolean {
  const dt = SIM.dt;
  const h = planetPos(home, t);
  const dx = h.x - kaiju.x, dy = h.y - kaiju.y;
  const d = Math.hypot(dx, dy) || 1;
  kaiju.x += (dx / d) * kaiju.speed * dt;
  kaiju.y += (dy / d) * kaiju.speed * dt;
  kaiju.mouth = 0.5 + 0.5 * Math.sin(t * 0.05);
  kaiju.distance = d;
  kaiju.rage = Math.max(0, kaiju.rage - 0.012);
  kaiju.chew = Math.max(0, kaiju.chew - 0.03);
  return d < home.radius + 28;
}

/** Frames of grace left, converted to wall-clock seconds at 60fps. */
export function etaSeconds(kaiju: Kaiju): number {
  const frames = kaiju.distance / (kaiju.speed * SIM.dt);
  return Math.max(0, Math.round(frames / 60));
}

export function enrage(kaiju: Kaiju, factor: number): void {
  kaiju.speed *= factor;
  kaiju.rage = 1;
}
