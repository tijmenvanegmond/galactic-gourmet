// ---------------------------------------------------------------------------
// Sprites are baked once into offscreen canvases and blitted from then on.
// Nothing is loaded from disk: every frame of art here is drawn by code, so
// the whole game stays a single bundle with no asset pipeline.
//
// Sprite dimensions are in WORLD units. Each canvas is supersampled by Q, so
// blitting at any zoom stays crisp.
// ---------------------------------------------------------------------------

import { PALETTE, SUN, BANDS, SPICES } from './config';
import type { Planet, SpiceName } from './types';

const Q = 4;

export interface Sprite {
  canvas: HTMLCanvasElement;
  /** Width in world units. */
  w: number;
  /** Height in world units. */
  h: number;
}

type Ctx = CanvasRenderingContext2D;

function surface(w: number, h: number): { canvas: HTMLCanvasElement; c: Ctx } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w * Q));
  canvas.height = Math.max(1, Math.ceil(h * Q));
  const c = canvas.getContext('2d');
  if (!c) throw new Error('offscreen 2d context unavailable');
  return { canvas, c };
}

/** Bakes a sprite whose origin (0,0) sits at the centre of the canvas. */
function bake(w: number, h: number, draw: (c: Ctx) => void): Sprite {
  const { canvas, c } = surface(w, h);
  c.scale(Q, Q);
  c.translate(w / 2, h / 2);
  draw(c);
  return { canvas, w, h };
}

export function drawSprite(
  ctx: Ctx,
  s: Sprite,
  x: number,
  y: number,
  scale: number,
  angle = 0,
  alpha = 1,
  squashX = 1,
  squashY = 1,
): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.scale(scale * squashX, scale * squashY);
  ctx.drawImage(s.canvas, -s.w / 2, -s.h / 2, s.w, s.h);
  ctx.restore();
}

// --- colour helpers ---------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** amount > 1 lightens, < 1 darkens. */
function shade(hex: string, amount: number): string {
  const [r, g, b] = rgb(hex).map(v => Math.max(0, Math.min(255, Math.round(v * amount))));
  return `rgb(${r},${g},${b})`;
}

// --- deterministic noise ----------------------------------------------------
// Seeded per sprite so a planet's craters are identical every run.

function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- planets ----------------------------------------------------------------

const RIM = 6;

function rockyFace(c: Ctx, r: number, fill: string, rand: () => number): void {
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r * 0.82;
    const cr = r * (0.10 + rand() * 0.16);
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    c.fillStyle = shade(fill, 0.80);
    c.beginPath(); c.arc(x, y, cr, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(fill, 1.12);
    c.beginPath(); c.arc(x - cr * 0.18, y - cr * 0.18, cr * 0.68, 0, Math.PI * 2); c.fill();
  }
}

function bandedFace(c: Ctx, r: number, fill: string, rand: () => number): void {
  c.rotate(-0.35);
  for (let i = -3; i <= 3; i++) {
    const y = (i / 3.6) * r;
    const h = r * (0.10 + rand() * 0.09);
    c.fillStyle = rgba(i % 2 === 0 ? shade(fill, 0.84) : shade(fill, 1.10), 0.55);
    c.beginPath();
    c.ellipse(rand() * r * 0.12, y, r * (0.96 - Math.abs(i) * 0.06), h, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.rotate(0.35);
}

function giantFace(c: Ctx, r: number, fill: string, edge: string, rand: () => number): void {
  c.rotate(-0.18);
  // Many more, thinner bands than a rocky world's haze, plus a storm.
  for (let i = -5; i <= 5; i++) {
    const y = (i / 5.6) * r;
    const h = r * (0.06 + rand() * 0.07);
    const tone = i % 2 === 0 ? shade(fill, 0.82) : shade(fill, 1.12);
    c.fillStyle = rgba(tone, 0.6);
    c.beginPath();
    c.ellipse(0, y, r * Math.sqrt(Math.max(0.05, 1 - (y / r) ** 2)) * 1.02, h, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.fillStyle = rgba(edge, 0.45);
  c.beginPath();
  c.ellipse(-r * 0.28, r * 0.24, r * 0.26, r * 0.13, 0.1, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.16)';
  c.beginPath();
  c.ellipse(-r * 0.30, r * 0.22, r * 0.15, r * 0.07, 0.1, 0, Math.PI * 2);
  c.fill();
  c.rotate(0.18);
}

function iceFace(c: Ctx, r: number, fill: string, rand: () => number): void {
  c.rotate(-0.10);
  for (let i = -2; i <= 2; i++) {
    const y = (i / 2.8) * r;
    c.fillStyle = rgba(shade(fill, i % 2 === 0 ? 0.9 : 1.08), 0.35);
    c.beginPath();
    c.ellipse(0, y, r * 0.98, r * (0.10 + rand() * 0.06), 0, 0, Math.PI * 2);
    c.fill();
  }
  c.rotate(0.10);
  // a cold, bright limb
  c.strokeStyle = 'rgba(255,255,255,0.30)';
  c.lineWidth = Math.max(0.7, r * 0.07);
  c.beginPath();
  c.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  c.stroke();
}

function terranFace(c: Ctx, r: number, edge: string, rand: () => number): void {
  c.fillStyle = rgba(edge, 0.62);
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r * 0.55;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    c.beginPath();
    for (let k = 0; k < 5; k++) {
      const ka = (k / 5) * Math.PI * 2;
      const kr = r * (0.16 + rand() * 0.22);
      const px = x + Math.cos(ka) * kr, py = y + Math.sin(ka) * kr;
      k ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath(); c.fill();
  }
  // polar caps
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.beginPath(); c.ellipse(0, -r * 0.92, r * 0.42, r * 0.16, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(0, r * 0.92, r * 0.34, r * 0.13, 0, 0, Math.PI * 2); c.fill();
}

/**
 * Baked with the light coming from +x. The renderer rotates the sprite so that
 * axis points at the star, which gives every planet a free day/night terminator
 * that tracks its own orbit.
 */
function makePlanet(p: Planet): Sprite {
  const r = p.radius;
  const size = (r + RIM) * 2;

  return bake(size, size, c => {
    const rand = rng(seedOf(p.name));

    // atmosphere halo
    const halo = c.createRadialGradient(0, 0, r * 0.9, 0, 0, r + RIM);
    halo.addColorStop(0, rgba(p.fill, 0.30));
    halo.addColorStop(1, rgba(p.fill, 0));
    c.fillStyle = halo;
    c.beginPath(); c.arc(0, 0, r + RIM, 0, Math.PI * 2); c.fill();

    c.save();
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();

    c.fillStyle = p.fill;
    c.fillRect(-r, -r, r * 2, r * 2);

    if (p.style === 'rocky') rockyFace(c, r, p.fill, rand);
    else if (p.style === 'banded') bandedFace(c, r, p.fill, rand);
    else if (p.style === 'giant') giantFace(c, r, p.fill, p.edge, rand);
    else if (p.style === 'ice') iceFace(c, r, p.fill, rand);
    else terranFace(c, r, p.edge, rand);

    // day/night terminator
    const lit = c.createRadialGradient(r * 0.5, -r * 0.35, r * 0.08, 0, 0, r * 1.3);
    lit.addColorStop(0, 'rgba(255,255,255,0.26)');
    lit.addColorStop(0.42, 'rgba(255,255,255,0)');
    lit.addColorStop(0.72, 'rgba(0,0,0,0.20)');
    lit.addColorStop(1, 'rgba(0,0,0,0.66)');
    c.fillStyle = lit;
    c.fillRect(-r, -r, r * 2, r * 2);

    // rim light on the star side
    c.strokeStyle = 'rgba(255,255,255,0.40)';
    c.lineWidth = Math.max(0.8, r * 0.10);
    c.beginPath(); c.arc(0, 0, r * 0.95, -1.0, 1.0); c.stroke();

    c.restore();

    c.strokeStyle = p.edge;
    c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
  });
}

// --- star -------------------------------------------------------------------

function makeStar(): Sprite {
  const r = SUN.radius;
  const size = r * 2.6;

  return bake(size, size, c => {
    const rand = rng(seedOf('sol'));

    const glow = c.createRadialGradient(0, 0, r * 0.6, 0, 0, size / 2);
    glow.addColorStop(0, rgba(PALETTE.sun, 0.55));
    glow.addColorStop(1, rgba(PALETTE.sun, 0));
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, size / 2, 0, Math.PI * 2); c.fill();

    c.save();
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.clip();

    const body = c.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
    body.addColorStop(0, PALETTE.sunCore);
    body.addColorStop(0.55, PALETTE.sun);
    body.addColorStop(1, shade(PALETTE.sun, 0.80));
    c.fillStyle = body;
    c.fillRect(-r, -r, r * 2, r * 2);

    // granulation
    for (let i = 0; i < 60; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      const cr = r * (0.04 + rand() * 0.10);
      c.fillStyle = rand() > 0.5
        ? 'rgba(255,255,255,0.10)'
        : 'rgba(120,60,0,0.10)';
      c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, cr, 0, Math.PI * 2); c.fill();
    }
    c.restore();

    c.strokeStyle = rgba(PALETTE.sunCore, 0.55);
    c.lineWidth = r * 0.05;
    c.beginPath(); c.arc(0, 0, r * 0.98, 0, Math.PI * 2); c.stroke();
  });
}

// --- kaiju ------------------------------------------------------------------
// A serpent: one head sprite and one body-link sprite, both drawn nose-first
// along +x so the renderer can point them down the chain. The maw, eyes and
// rage tint animate, so the renderer draws those on top.

/** Nominal radius the body link is baked at; the renderer scales from this. */
export const SEGMENT_UNIT = 16;

function makeKaijuHead(): Sprite {
  const w = 62, h = 46;

  return bake(w, h, c => {
    const rand = rng(seedOf('kaiju-head'));
    const skin = c.createRadialGradient(-4, -8, 3, 0, 0, 30);
    skin.addColorStop(0, shade(PALETTE.kaijuBody, 1.5));
    skin.addColorStop(0.6, PALETTE.kaijuBody);
    skin.addColorStop(1, shade(PALETTE.kaijuBody, 0.6));

    // swept-back horns
    c.fillStyle = shade(PALETTE.kaijuBody, 0.66);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(-4, side * 12);
      c.quadraticCurveTo(-18, side * 24, -27, side * 20);
      c.quadraticCurveTo(-16, side * 12, -6, side * 8);
      c.closePath(); c.fill();
    }

    // skull: wide at the back, tapering to a snout
    c.beginPath();
    c.moveTo(26, 0);
    c.quadraticCurveTo(20, -12, 6, -16);
    c.quadraticCurveTo(-12, -19, -22, -11);
    c.quadraticCurveTo(-27, 0, -22, 11);
    c.quadraticCurveTo(-12, 19, 6, 16);
    c.quadraticCurveTo(20, 12, 26, 0);
    c.closePath();
    c.fillStyle = skin;
    c.fill();
    c.strokeStyle = PALETTE.kaijuEdge;
    c.lineWidth = 1.1;
    c.stroke();

    // brow ridges
    c.fillStyle = rgba(PALETTE.kaijuEdge, 0.40);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(-3, side * 11, 9, 3.4, side * 0.24, 0, Math.PI * 2);
      c.fill();
    }

    // scales
    c.fillStyle = rgba(PALETTE.kaijuEdge, 0.28);
    for (let i = 0; i < 12; i++) {
      const x = -20 + rand() * 36;
      const y = (rand() * 2 - 1) * 12;
      c.beginPath();
      c.arc(x, y, 0.8 + rand() * 1.5, 0, Math.PI * 2);
      c.fill();
    }

    // nostrils
    c.fillStyle = rgba(PALETTE.kaijuEdge, 0.75);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.ellipse(19, side * 4.5, 1.6, 1.1, 0, 0, Math.PI * 2);
      c.fill();
    }
  });
}

function makeKaijuSegment(): Sprite {
  const r = SEGMENT_UNIT;
  const size = r * 2.9;

  return bake(size, size, c => {
    const rand = rng(seedOf('kaiju-segment'));

    // dorsal spikes, swept back
    c.fillStyle = shade(PALETTE.kaijuBody, 0.66);
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(2, side * r * 0.7);
      c.lineTo(-r * 0.5, side * r * 1.5);
      c.lineTo(-r * 0.6, side * r * 0.5);
      c.closePath(); c.fill();
    }

    // the link itself, slightly longer than it is wide
    c.beginPath();
    c.ellipse(0, 0, r * 1.06, r * 0.94, 0, 0, Math.PI * 2);
    const skin = c.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.1, 0, 0, r * 1.15);
    skin.addColorStop(0, shade(PALETTE.kaijuBody, 1.42));
    skin.addColorStop(0.6, PALETTE.kaijuBody);
    skin.addColorStop(1, shade(PALETTE.kaijuBody, 0.58));
    c.fillStyle = skin;
    c.fill();
    c.strokeStyle = PALETTE.kaijuEdge;
    c.lineWidth = 1.1;
    c.stroke();

    // spine ridge running down the back, seen from above
    c.fillStyle = rgba(PALETTE.kaijuEye, 0.14);
    c.beginPath();
    c.ellipse(0, 0, r * 0.78, r * 0.30, 0, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = rgba(PALETTE.kaijuEdge, 0.30);
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r * 0.75;
      c.beginPath();
      c.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.05 + rand() * 0.07), 0, Math.PI * 2);
      c.fill();
    }
  });
}

// --- dishes -----------------------------------------------------------------
// One plated sprite per roast band. Drawn at a fixed screen size rather than
// scaled by zoom, so the thing you are aiming never shrinks out of sight.

function makeDish(bandIndex: number): Sprite {
  const b = BANDS[bandIndex];
  const size = 24;

  return bake(size, size, c => {
    const rand = rng(seedOf(`dish${bandIndex}`));

    // plate
    c.fillStyle = '#EFEADA';
    c.strokeStyle = '#8C8A82';
    c.lineWidth = 0.7;
    c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(35,36,30,0.16)';
    c.lineWidth = 0.6;
    c.beginPath(); c.arc(0, 0, 7.6, 0, Math.PI * 2); c.stroke();

    // the food itself
    const food = c.createRadialGradient(-1.6, -2.2, 0.6, 0, 0, 6.6);
    food.addColorStop(0, shade(b.fill, 1.22));
    food.addColorStop(0.65, b.fill);
    food.addColorStop(1, shade(b.fill, 0.82));
    c.fillStyle = food;
    c.strokeStyle = b.edge;
    c.lineWidth = 0.8;
    c.beginPath();
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const rr = 6.2 + Math.sin(a * 3) * 0.5;
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.94;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath(); c.fill(); c.stroke();

    // char specks accumulate with doneness
    const specks = bandIndex * 4;
    c.fillStyle = rgba(b.edge, 0.75);
    for (let i = 0; i < specks; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * 5.4;
      c.beginPath();
      c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.35 + rand() * 0.5, 0, Math.PI * 2);
      c.fill();
    }

    // gloss
    c.fillStyle = 'rgba(255,255,255,0.34)';
    c.beginPath(); c.ellipse(-2.1, -2.6, 2.1, 1.2, -0.6, 0, Math.PI * 2); c.fill();

    // garnish, because presentation matters
    c.fillStyle = PALETTE.heading;
    c.beginPath(); c.ellipse(3.4, -3.6, 1.5, 0.8, -0.7, 0, Math.PI * 2); c.fill();
  });
}

// --- spice pips -------------------------------------------------------------

function makePip(spice: SpiceName): Sprite {
  const color = SPICES[spice].color;
  return bake(8, 8, c => {
    c.fillStyle = color;
    c.strokeStyle = 'rgba(18,19,15,0.55)';
    c.lineWidth = 0.5;
    c.beginPath();
    c.moveTo(0, -3); c.lineTo(2.6, 0); c.lineTo(0, 3); c.lineTo(-2.6, 0);
    c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.65)';
    c.beginPath(); c.moveTo(-0.4, -1.9); c.lineTo(1, -0.4); c.lineTo(-0.4, 0.1);
    c.closePath(); c.fill();
  });
}

// --- food -------------------------------------------------------------------
// A dish is drawn as the thing it is, so the sprite is its own emoji. Baked
// like everything else — one glyph render per dish, blitted thereafter.

const EMOJI_SIZE = 19;

function makeEmoji(ch: string, scorched: boolean): Sprite {
  const box = EMOJI_SIZE + 6;
  return bake(box, box, c => {
    c.font = `${EMOJI_SIZE}px "Apple Color Emoji", "Segoe UI Emoji", `
      + `"Noto Color Emoji", sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(ch, 0, 1);
    if (scorched) {
      // Painted over the glyph only, so it blackens in its own shape rather
      // than sitting behind a square. Cross-faded over the clean one at draw
      // time, which is what makes the roast visible on the dish itself.
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = '#1E1A16';
      c.fillRect(-box, -box, box * 2, box * 2);
    }
  });
}

// --- cache ------------------------------------------------------------------

const emojis = new Map<string, Sprite>();
const planets = new Map<string, Sprite>();
const dishes = new Map<number, Sprite>();
const pips = new Map<SpiceName, Sprite>();
let star: Sprite | null = null;
let kaijuHead: Sprite | null = null;
let kaijuSegment: Sprite | null = null;

export function planetSprite(p: Planet): Sprite {
  let s = planets.get(p.name);
  if (!s) { s = makePlanet(p); planets.set(p.name, s); }
  return s;
}

export function starSprite(): Sprite {
  if (!star) star = makeStar();
  return star;
}

export function kaijuHeadSprite(): Sprite {
  if (!kaijuHead) kaijuHead = makeKaijuHead();
  return kaijuHead;
}

export function kaijuSegmentSprite(): Sprite {
  if (!kaijuSegment) kaijuSegment = makeKaijuSegment();
  return kaijuSegment;
}

export function dishSprite(bandIndex: number): Sprite {
  const i = Math.max(0, Math.min(BANDS.length - 1, bandIndex));
  let s = dishes.get(i);
  if (!s) { s = makeDish(i); dishes.set(i, s); }
  return s;
}

/** The dish itself. `scorched` is the burnt copy, faded in over the clean one. */
export function foodSprite(emoji: string, scorched = false): Sprite {
  const key = scorched ? `${emoji}!` : emoji;
  let s = emojis.get(key);
  if (!s) { s = makeEmoji(emoji, scorched); emojis.set(key, s); }
  return s;
}

export function pipSprite(spice: SpiceName): Sprite {
  let s = pips.get(spice);
  if (!s) { s = makePip(spice); pips.set(spice, s); }
  return s;
}
