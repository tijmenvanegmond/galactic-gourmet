import { SUN, VIEW, PALETTE, SPICES, PHYSICS, JUICE, BANDS } from './config';
import { planetPos, bandFor, bandIndex } from './world';
import { toScreen } from './camera';
import { shakeTransform } from './juice';
import {
  drawSprite, planetSprite, starSprite, kaijuSprite, dishSprite, pipSprite,
} from './sprites';
import type {
  Aim, Camera, GameState, Juice, Kaiju, Particle, Payload, Planet, SpiceName,
} from './types';

const TAU = Math.PI * 2;

type Ctx = CanvasRenderingContext2D;

const mod = (a: number, n: number): number => ((a % n) + n) % n;

// --- parallax starfield -----------------------------------------------------
// Generated once and wrapped modulo the viewport, so it scrolls forever.

interface Star { x: number; y: number; r: number; phase: number; tint: string }

const STARS: Star[] = Array.from({ length: JUICE.starCount }, () => ({
  x: Math.random() * VIEW.width,
  y: Math.random() * VIEW.height,
  r: 0.4 + Math.random() * 1.3,
  phase: Math.random() * TAU,
  tint: Math.random() > 0.85 ? PALETTE.heading : PALETTE.star,
}));

function drawStarfield(ctx: Ctx, cam: Camera, t: number): void {
  const par = JUICE.starParallax;
  for (const s of STARS) {
    const x = mod(s.x - cam.x * par, VIEW.width);
    const y = mod(s.y - cam.y * par, VIEW.height);
    ctx.globalAlpha = 0.22 + 0.30 * (0.5 + 0.5 * Math.sin(t * 0.08 + s.phase));
    ctx.fillStyle = s.tint;
    ctx.beginPath(); ctx.arc(x, y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- world bodies -----------------------------------------------------------

function drawStar(ctx: Ctx, cam: Camera, t: number): void {
  const s = toScreen(cam, SUN.x, SUN.y);
  const z = cam.zoom;
  const pulse = 1 + Math.sin(t * 0.05) * 0.02;

  ctx.fillStyle = PALETTE.sunGlowOuter;
  ctx.beginPath(); ctx.arc(s.x, s.y, SUN.heatRadius * z, 0, TAU); ctx.fill();
  ctx.fillStyle = PALETTE.sunGlowInner;
  ctx.beginPath(); ctx.arc(s.x, s.y, SUN.heatRadius * 0.55 * z * pulse, 0, TAU); ctx.fill();

  ctx.save();
  ctx.strokeStyle = PALETTE.coronaLine;
  ctx.setLineDash([3, 5]);
  ctx.lineWidth = 1;
  ctx.translate(s.x, s.y);
  ctx.rotate(t * 0.004);
  ctx.beginPath(); ctx.arc(0, 0, SUN.heatRadius * 0.38 * z, 0, TAU); ctx.stroke();
  ctx.restore();
  ctx.setLineDash([]);

  drawSprite(ctx, starSprite(), s.x, s.y, z * pulse, t * 0.002);
}

function drawOrbits(ctx: Ctx, cam: Camera, planets: Planet[]): void {
  const s = toScreen(cam, SUN.x, SUN.y);
  ctx.strokeStyle = PALETTE.orbitLine;
  ctx.setLineDash([2, 7]);
  for (const p of planets) {
    ctx.beginPath(); ctx.arc(s.x, s.y, p.orbit * cam.zoom, 0, TAU); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawPlanets(
  ctx: Ctx,
  cam: Camera,
  planets: Planet[],
  t: number,
  ringWidth: number,
  rack: SpiceName[],
): void {
  const z = cam.zoom;
  for (const p of planets) {
    const q = planetPos(p, t);
    const s = toScreen(cam, q.x, q.y);

    if (p.spice && !rack.includes(p.spice)) {
      const pulse = 0.42 + 0.22 * Math.sin(t * 0.09 + p.orbit);
      ctx.strokeStyle = SPICES[p.spice].color;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 1.3;
      ctx.setLineDash([4, 4]);
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(t * 0.01);
      ctx.beginPath(); ctx.arc(0, 0, (p.radius + ringWidth) * z, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // The sprite is lit from +x, so pointing that axis at the star gives each
    // world a terminator that tracks its own orbit.
    drawSprite(ctx, planetSprite(p), s.x, s.y, z, Math.atan2(q.y, q.x) + Math.PI);

    if (z > 0.45) {
      ctx.font = '9px ui-monospace, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.label;
      ctx.fillText(p.name.toUpperCase(), s.x, s.y - (p.radius + ringWidth) * z - 6);
      if (p.spice && !rack.includes(p.spice)) {
        ctx.fillStyle = SPICES[p.spice].color;
        ctx.fillText(p.spice, s.x, s.y + (p.radius + ringWidth) * z + 12);
      }
    }
  }
}

function drawKaiju(ctx: Ctx, cam: Camera, kaiju: Kaiju, t: number): void {
  const s = toScreen(cam, kaiju.x, kaiju.y);
  const z = cam.zoom;
  const bob = Math.sin(t * 0.06) * 2 * z;
  const y = s.y + bob;

  const aura = 0.7 + 0.3 * Math.sin(t * 0.07);
  ctx.fillStyle = PALETTE.kaijuAura;
  ctx.beginPath(); ctx.arc(s.x, y, 46 * z * aura, 0, TAU); ctx.fill();

  const chew = kaiju.chew;
  drawSprite(ctx, kaijuSprite(), s.x, y, z, Math.sin(t * 0.03) * 0.08,
    1, 1 + chew * 0.25, 1 - chew * 0.2);

  // maw
  const open = (4 + 9 * kaiju.mouth + chew * 10) * z;
  ctx.fillStyle = '#1B0A04';
  ctx.beginPath();
  ctx.ellipse(s.x, y + 5 * z, 15 * z, open, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath();
  ctx.ellipse(s.x, y + 5 * z, 15 * z * 0.62, open * 0.5, 0, 0, TAU);
  ctx.fill();

  // teeth
  ctx.fillStyle = '#F1EFE8';
  for (let i = -2; i <= 2; i++) {
    const tx = s.x + i * 5.4 * z;
    const ty = y + 5 * z - open;
    ctx.beginPath();
    ctx.moveTo(tx - 2 * z, ty);
    ctx.lineTo(tx + 2 * z, ty);
    ctx.lineTo(tx, ty + 4 * z);
    ctx.closePath(); ctx.fill();
  }

  // eyes, with a rage tint when it has been insulted
  ctx.fillStyle = kaiju.rage > 0 ? PALETTE.kaijuRage : PALETTE.kaijuEye;
  ctx.beginPath();
  ctx.arc(s.x - 9 * z, y - 9 * z, (3.4 + kaiju.rage * 1.6) * z, 0, TAU);
  ctx.arc(s.x + 9 * z, y - 9 * z, (3.4 + kaiju.rage * 1.6) * z, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#12130F';
  ctx.beginPath();
  ctx.arc(s.x - 9 * z, y - 9 * z, 1.5 * z, 0, TAU);
  ctx.arc(s.x + 9 * z, y - 9 * z, 1.5 * z, 0, TAU);
  ctx.fill();

  if (kaiju.rage > 0) {
    ctx.strokeStyle = PALETTE.kaijuRage;
    ctx.globalAlpha = kaiju.rage * 0.7;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(s.x, y, 30 * z, 0, TAU); ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

// --- aiming -----------------------------------------------------------------

function drawAim(ctx: Ctx, cam: Camera, aim: Aim, t: number): void {
  const pts = aim.points;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const s = toScreen(cam, p.x, p.y);

    if (p.pickup) {
      ctx.globalAlpha = 1;
      drawSprite(ctx, pipSprite(p.pickup), s.x, s.y, 1, t * 0.05);
      continue;
    }
    if (p.capture) {
      // Where the pod gets parked, not where it dies.
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = PALETTE.predictCapture;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(s.x, s.y, 7 + Math.sin(t * 0.2) * 1.5, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, TAU); ctx.stroke();
      continue;
    }
    if (p.terminal) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = PALETTE.predictEnd;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x - 4, s.y - 4); ctx.lineTo(s.x + 4, s.y + 4);
      ctx.moveTo(s.x + 4, s.y - 4); ctx.lineTo(s.x - 4, s.y + 4);
      ctx.stroke();
      continue;
    }

    const heat = p.heat ?? 0;
    ctx.globalAlpha = 0.75 - (i / pts.length) * 0.55;
    ctx.fillStyle = heat > 52 && heat < 78 ? PALETTE.predictGolden : PALETTE.predict;
    ctx.beginPath(); ctx.arc(s.x, s.y, 2.3, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;

  const a = toScreen(cam, aim.originX, aim.originY);
  const b = toScreen(cam, aim.handleX, aim.handleY);

  ctx.strokeStyle = 'rgba(140,138,130,0.75)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.setLineDash([]);

  // power arc around the launch point
  ctx.strokeStyle = aim.power > 0.85 ? PALETTE.predictEnd : PALETTE.exhaust;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(a.x, a.y, 20, -Math.PI / 2, -Math.PI / 2 + TAU * aim.power);
  ctx.stroke();

  // handle
  ctx.strokeStyle = PALETTE.heading;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, TAU); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x - 10, b.y); ctx.lineTo(b.x - 4, b.y);
  ctx.moveTo(b.x + 4, b.y); ctx.lineTo(b.x + 10, b.y);
  ctx.moveTo(b.x, b.y - 10); ctx.lineTo(b.x, b.y - 4);
  ctx.moveTo(b.x, b.y + 4); ctx.lineTo(b.x, b.y + 10);
  ctx.stroke();
}

// --- the payload ------------------------------------------------------------

function drawPayload(ctx: Ctx, cam: Camera, pod: Payload, t: number): void {
  const bi = Math.max(0, bandIndex(bandFor(pod.heat).label));
  const band = BANDS[bi];

  // trail, tapered and tinted by how cooked the dish is
  const trail = pod.trail;
  for (let i = 1; i < trail.length; i++) {
    const p0 = toScreen(cam, trail[i - 1].x, trail[i - 1].y);
    const p1 = toScreen(cam, trail[i].x, trail[i].y);
    const f = i / trail.length;
    ctx.globalAlpha = f * 0.5;
    ctx.strokeStyle = band.fill;
    ctx.lineWidth = 0.4 + f * 2.2;
    ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const s = toScreen(cam, pod.x, pod.y);

  // the orbit it is parked in
  if (pod.orbit) {
    const c = toScreen(cam, planetPos(pod.orbit.planet, t).x, planetPos(pod.orbit.planet, t).y);
    ctx.strokeStyle = PALETTE.predictCapture;
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([3, 5]);
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(c.x, c.y, pod.orbit.radius * cam.zoom, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // heat bloom
  const glow = Math.min(1, pod.heat / 100);
  if (glow > 0.05) {
    const g = ctx.createRadialGradient(s.x, s.y, 2, s.x, s.y, 26);
    g.addColorStop(0, `rgba(239,168,39,${0.35 * glow})`);
    g.addColorStop(1, 'rgba(239,168,39,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, TAU); ctx.fill();
  }

  if (!pod.orbit) {
    ctx.strokeStyle = PALETTE.heading;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(s.x + Math.cos(pod.angle) * 22, s.y + Math.sin(pod.angle) * 22);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // squash on impact, stretch with speed
  const speed = Math.hypot(pod.vx, pod.vy);
  const stretch = Math.min(0.28, speed * 0.022);
  const sq = pod.squash;
  drawSprite(
    ctx, dishSprite(bi), s.x, s.y, 1, pod.angle, 1,
    1 + stretch - sq * 0.42,
    1 - stretch * 0.7 + sq * 0.42,
  );

  pod.rack.forEach((sp, i) => {
    drawSprite(ctx, pipSprite(sp), s.x - 7 + i * 7, s.y - 18, 0.9, Math.sin(t * 0.08 + i) * 0.3);
  });
}

// --- effects ----------------------------------------------------------------

function drawParticles(ctx: Ctx, cam: Camera, particles: Particle[]): void {
  for (const p of particles) {
    const s = toScreen(cam, p.x, p.y);
    const life = Math.max(0, p.life);

    if (p.kind === 'smoke') {
      ctx.globalAlpha = life * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, p.size * (2 - life), 0, TAU); ctx.fill();
      continue;
    }
    if (p.kind === 'debris') {
      ctx.globalAlpha = life;
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x - p.size / 2, s.y - p.size / 2, p.size, p.size);
      continue;
    }
    // spark / ember: bright core, soft halo
    ctx.globalAlpha = life * 0.35;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(s.x, s.y, p.size * 2.2 * life, 0, TAU); ctx.fill();
    ctx.globalAlpha = life;
    ctx.beginPath(); ctx.arc(s.x, s.y, p.size * life, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawJuice(ctx: Ctx, cam: Camera, juice: Juice): void {
  for (const r of juice.rings) {
    const s = toScreen(cam, r.x, r.y);
    ctx.globalAlpha = Math.max(0, r.life) * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * r.life;
    ctx.beginPath(); ctx.arc(s.x, s.y, r.r, 0, TAU); ctx.stroke();
  }

  ctx.textAlign = 'center';
  for (const p of juice.pops) {
    const s = toScreen(cam, p.x, p.y);
    const life = Math.max(0, p.life);
    ctx.globalAlpha = Math.min(1, life * 1.6);
    ctx.font = `700 ${p.size}px ui-monospace, Menlo, monospace`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(18,19,15,0.85)';
    ctx.strokeText(p.text, s.x, s.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, s.x, s.y);
  }
  ctx.globalAlpha = 1;
}

function drawPrompt(ctx: Ctx, cam: Camera, pod: Payload, t: number): void {
  const s = toScreen(cam, pod.x, pod.y);
  // Pushed clear of the planet it is circling, and outlined, so it stays
  // legible against a lit surface.
  const off = (pod.orbit ? pod.orbit.radius * cam.zoom : 0) + 26;
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(t * 0.15);
  ctx.font = '700 10px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(18,19,15,0.9)';
  ctx.strokeText('DRAG TO RELAUNCH', s.x, s.y + off);
  ctx.fillStyle = PALETTE.heading;
  ctx.fillText('DRAG TO RELAUNCH', s.x, s.y + off);
  ctx.globalAlpha = 1;
}

function drawMinimap(ctx: Ctx, state: GameState): void {
  const M = 88, mx = VIEW.width - M - 10, my = 10, half = M / 2;
  const k = half / (PHYSICS.worldBoundary * 0.83);
  const cx = mx + half, cy = my + half;

  ctx.fillStyle = PALETTE.minimapBg;
  ctx.strokeStyle = PALETTE.minimapEdge;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(mx, my, M, M, 6); ctx.fill(); ctx.stroke();

  ctx.save();
  ctx.beginPath(); ctx.roundRect(mx, my, M, M, 6); ctx.clip();

  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();

  for (const p of state.level.planets) {
    const q = planetPos(p, state.t);
    ctx.fillStyle = p.fill;
    ctx.beginPath(); ctx.arc(cx + q.x * k, cy + q.y * k, p.home ? 2.6 : 1.8, 0, TAU); ctx.fill();
  }

  ctx.fillStyle = PALETTE.kaijuBody;
  ctx.beginPath(); ctx.arc(cx + state.kaiju.x * k, cy + state.kaiju.y * k, 3.4, 0, TAU); ctx.fill();

  if (state.pod) {
    const px = cx + state.pod.x * k, py = cy + state.pod.y * k;
    ctx.fillStyle = PALETTE.heading;
    ctx.beginPath(); ctx.arc(px, py, 2, 0, TAU); ctx.fill();
    if (state.pod.orbit) {
      ctx.strokeStyle = PALETTE.predictCapture;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(px, py, 4.5, 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawVignette(ctx: Ctx): void {
  const g = ctx.createRadialGradient(
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35,
    VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

// --- frame ------------------------------------------------------------------

export function render(ctx: Ctx, state: GameState): void {
  const { cam, level, t, pod, aim, kaiju, particles, ghosts, juice } = state;
  ctx.clearRect(0, 0, VIEW.width, VIEW.height);

  const shake = shakeTransform(juice);
  ctx.save();
  if (shake.roll) {
    ctx.translate(VIEW.width / 2, VIEW.height / 2);
    ctx.rotate(shake.roll);
    ctx.translate(-VIEW.width / 2, -VIEW.height / 2);
  }
  ctx.translate(shake.x, shake.y);

  drawStarfield(ctx, cam, t);
  drawStar(ctx, cam, t);
  drawOrbits(ctx, cam, level.planets);
  drawPlanets(ctx, cam, level.planets, t, level.spiceRing, pod ? pod.rack : []);

  for (const g of ghosts) {
    const s = toScreen(cam, g.x, g.y);
    drawSprite(ctx, dishSprite(g.band), s.x, s.y, 0.7, 0, Math.min(1, g.life) * 0.7);
  }

  drawKaiju(ctx, cam, kaiju, t);
  if (aim) drawAim(ctx, cam, aim, t);
  if (pod) drawPayload(ctx, cam, pod, t);
  drawParticles(ctx, cam, particles);
  drawJuice(ctx, cam, juice);
  if (pod && pod.orbit && !aim) drawPrompt(ctx, cam, pod, t);

  ctx.restore();

  drawVignette(ctx);
  drawMinimap(ctx, state);

  if (juice.flash > 0) {
    ctx.globalAlpha = juice.flash * 0.6;
    ctx.fillStyle = juice.flashColor;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.globalAlpha = 1;
  }
}
