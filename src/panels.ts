// ---------------------------------------------------------------------------
// Screen-space chrome, drawn onto the canvas instead of around it: the diner's
// profile card, the kitchen console, and the minimap. These read game state
// directly — nothing here writes to the DOM.
// ---------------------------------------------------------------------------

import { VIEW, PANELS, PALETTE, PHYSICS, SPICES, STAGES } from './config';
import { planetPos, bandFor, bandByLabel } from './world';
import { kaijuClock } from './kaiju';
import { isMuted } from './audio';
import { drawSprite, kaijuHeadSprite, dishSprite, pipSprite } from './sprites';
import type { GameState, SpiceName } from './types';

const TAU = Math.PI * 2;
const MONO = 'ui-monospace, Menlo, Consolas, monospace';

type Ctx = CanvasRenderingContext2D;

interface TextOptions {
  size?: number;
  color?: string;
  weight?: number;
  align?: CanvasTextAlign;
  alpha?: number;
  spacing?: number;
  italic?: boolean;
}

function label(ctx: Ctx, s: string, x: number, y: number, o: TextOptions = {}): void {
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  ctx.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 400} ${o.size ?? 9}px ${MONO}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.fillStyle = o.color ?? PALETTE.label;
  if (o.spacing) {
    // Canvas has no letter-spacing everywhere, so wide-track small caps are
    // drawn a glyph at a time.
    let cursor = x;
    for (const ch of s) {
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + o.spacing;
    }
  } else {
    ctx.fillText(s, x, y);
  }
  ctx.restore();
}

function panel(ctx: Ctx, x: number, y: number, w: number, h: number, radius = 6): void {
  ctx.fillStyle = 'rgba(18,19,15,0.78)';
  ctx.strokeStyle = 'rgba(140,138,130,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.stroke();
}

/** A track with a fill, and optionally the band of values being aimed for. */
function meter(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  fraction: number,
  color: string,
  window?: { lo: number; hi: number },
): void {
  ctx.fillStyle = 'rgba(36,38,31,0.9)';
  ctx.fillRect(x, y, w, h);

  if (window) {
    const wx = x + (window.lo / 100) * w;
    const ww = ((Math.min(100, window.hi) - window.lo) / 100) * w;
    ctx.fillStyle = 'rgba(216,90,48,0.30)';
    ctx.fillRect(wx, y, ww, h);
    ctx.strokeStyle = PALETTE.char;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(wx + 0.5, y); ctx.lineTo(wx + 0.5, y + h);
    ctx.moveTo(wx + ww - 0.5, y); ctx.lineTo(wx + ww - 0.5, y + h);
    ctx.stroke();
  }

  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, fraction)) * w, h);
  ctx.strokeStyle = 'rgba(53,56,45,0.9)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function truncate(ctx: Ctx, s: string, maxWidth: number): string {
  if (ctx.measureText(s).width <= maxWidth) return s;
  let cut = s;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return `${cut}…`;
}

function wrap(ctx: Ctx, s: string, maxWidth: number, maxLines: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (let i = 0; i < words.length; i++) {
    const next = line ? `${line} ${words[i]}` : words[i];
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      // On the last line available, take everything left and clip it.
      if (lines.length === maxLines - 1) {
        return [...lines, truncate(ctx, words.slice(i).join(' '), maxWidth)];
      }
      line = words[i];
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

// --- the diner --------------------------------------------------------------

function drawProfile(ctx: Ctx, state: GameState): void {
  const k = state.kaiju;
  const m = PANELS.margin;
  const w = PANELS.profileWidth;
  const h = PANELS.profileHeight;
  const hunting = k.mode === 'chase' || k.mode === 'lunge';

  panel(ctx, m, m, w, h);

  // portrait, facing right, tinted when it is on the hunt
  const ps = 46;
  const px = m + 8, py = m + 10;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(px, py, ps, ps, 4);
  ctx.clip();
  ctx.fillStyle = hunting ? 'rgba(216,90,48,0.30)' : 'rgba(113,43,19,0.22)';
  ctx.fillRect(px, py, ps, ps);
  drawSprite(ctx, kaijuHeadSprite(), px + ps / 2 + 2, py + ps / 2, 0.66, 0);
  ctx.restore();
  ctx.strokeStyle = 'rgba(140,138,130,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(px + 0.5, py + 0.5, ps - 1, ps - 1, 4);
  ctx.stroke();

  // name, split so a long epithet does not crowd out the part you remember
  const tx = px + ps + 9;
  const room = w - (tx - m) - 10;
  const [first, ...rest] = k.name.split(' ');
  ctx.font = `700 12px ${MONO}`;
  label(ctx, truncate(ctx, first.toUpperCase(), room), tx, m + 21,
    { size: 12, weight: 700, color: hunting ? PALETTE.exhaust : PALETTE.char });
  ctx.font = `400 8px ${MONO}`;
  label(ctx, truncate(ctx, rest.join(' '), room), tx, m + 31,
    { size: 8, color: PALETTE.label, alpha: 0.8 });

  // what it is doing, and for how much longer
  const clock = kaijuClock(k, state.level.kaiju);
  label(ctx, clock.label.toUpperCase(), tx, m + 45, { size: 8, spacing: 0.6, alpha: 0.75 });
  label(ctx, `${clock.seconds}s`, m + w - 10, m + 45,
    { size: 12, weight: 700, align: 'right', color: clock.urgent ? PALETTE.char : PALETTE.heading });

  // hunger is the win condition, so it reads as a meter draining toward zero
  label(ctx, 'HUNGER', tx, m + 58, { size: 7, spacing: 0.5, alpha: 0.7 });
  const hx = tx + 42;
  meter(ctx, hx, m + 51, w - (hx - m) - 10, 7,
    state.hunger / state.level.hunger, PALETTE.kaijuBody);
}

function drawChatter(ctx: Ctx, state: GameState): void {
  const { line, life } = state.chatter;
  if (!line) return;
  const m = PANELS.margin;
  const y = m + PANELS.profileHeight + 14;
  ctx.font = `italic 400 10px ${MONO}`;
  const lines = wrap(ctx, `“${line}”`, PANELS.chatterWidth, 2);
  const alpha = 0.45 + 0.55 * Math.max(0, Math.min(1, life));
  lines.forEach((text, i) => {
    label(ctx, text, m + 2, y + i * 13,
      { size: 10, italic: true, color: PALETTE.label, alpha });
  });
}

// --- the kitchen ------------------------------------------------------------

function drawConsole(ctx: Ctx, state: GameState): void {
  const h = PANELS.consoleHeight;
  const y = VIEW.height - h;
  const pod = state.pod;

  ctx.fillStyle = 'rgba(18,19,15,0.82)';
  ctx.fillRect(0, y, VIEW.width, h);
  ctx.strokeStyle = 'rgba(140,138,130,0.34)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, y + 0.5); ctx.lineTo(VIEW.width, y + 0.5);
  ctx.stroke();

  // --- the order ---
  const order = state.order;
  const ordered = bandByLabel(order.doneness);
  label(ctx, 'ORDER UP', 12, y + 15, { size: 8, spacing: 1.4, alpha: 0.7 });
  label(ctx, order.doneness.toUpperCase(), 12, y + 33,
    { size: 13, weight: 700, color: ordered.fill });
  drawSprite(ctx, pipSprite(order.spice), 17, y + 46, 0.9);
  label(ctx, order.spice, 26, y + 49, { size: 10, color: SPICES[order.spice].color });

  // What the pod is actually carrying, right-aligned in this column so a long
  // doneness ("lightly toasted") can never run into it.
  const rack: SpiceName[] = pod ? pod.rack : [];
  if (rack.length) {
    const right = 200;
    label(ctx, 'ON BOARD', right, y + 36, { size: 7, align: 'right', alpha: 0.6 });
    const start = right - rack.length * 13 + 6;
    rack.forEach((s, i) => drawSprite(ctx, pipSprite(s), start + i * 13, y + 46, 0.85));
  }

  // --- roast and fuel ---
  const gx = 212, gw = 240;
  const heat = pod ? pod.heat : 0;
  const band = bandFor(heat);
  const onTarget = band.label === order.doneness;

  label(ctx, 'ROAST', gx, y + 15, { size: 8, spacing: 1.4, alpha: 0.7 });
  label(ctx, band.label, gx + gw, y + 15,
    { size: 10, align: 'right', color: onTarget ? PALETTE.exhaust : PALETTE.label });
  meter(ctx, gx, y + 20, gw, 9, Math.min(100, heat) / 100, PALETTE.exhaust,
    { lo: ordered.lo, hi: ordered.hi });
  if (onTarget) {
    ctx.strokeStyle = PALETTE.exhaust;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(state.t * 0.25);
    ctx.strokeRect(gx - 2.5, y + 17.5, gw + 5, 14);
    ctx.globalAlpha = 1;
  }

  const stage = pod ? STAGES[pod.stage] : STAGES[0];
  const fuel = pod ? pod.fuel / stage.fuel : 1;
  label(ctx, 'FUEL', gx, y + 47, { size: 8, spacing: 1.4, alpha: 0.7 });
  label(ctx, pod && pod.orbit
    ? `parked · ${pod.orbit.planet.name.toLowerCase()} orbit`
    : `stage ${(pod ? pod.stage : 0) + 1} · ${stage.name}`,
  gx + gw, y + 47, { size: 9, align: 'right', alpha: 0.85 });
  meter(ctx, gx, y + 52, gw, 6, fuel, PALETTE.heading);

  // --- dishes and score ---
  const cx = 470;
  label(ctx, 'DISHES', cx, y + 15, { size: 8, spacing: 1.4, alpha: 0.7 });
  for (let i = 0; i < state.level.payloads; i++) {
    const dx = cx + 9 + i * 20;
    if (i < state.payloads) {
      drawSprite(ctx, dishSprite(0), dx, y + 32, 0.72);
    } else {
      // a cleared place setting
      ctx.strokeStyle = 'rgba(140,138,130,0.30)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(dx, y + 32, 7, 0, TAU);
      ctx.stroke();
    }
  }

  // The mute preference survives a reload, so with no button on the page it
  // has to say so in here or a returning player just gets silence.
  if (isMuted()) {
    label(ctx, 'SOUND OFF · PRESS M', 12, y + 62, { size: 7, spacing: 0.5, alpha: 0.5 });
  }

  label(ctx, 'SCORE', cx, y + 60, { size: 8, spacing: 1.4, alpha: 0.7 });
  label(ctx, String(Math.round(state.shownScore)), VIEW.width - 12, y + 62,
    { size: 16, weight: 700, align: 'right', color: PALETTE.ink });
}

// --- overview ---------------------------------------------------------------

function drawMinimap(ctx: Ctx, state: GameState): void {
  const M = 88;
  const mx = VIEW.width - M - PANELS.margin;
  const my = PANELS.margin;
  const half = M / 2;
  const k = half / (PHYSICS.worldBoundary * 0.83);
  const cx = mx + half, cy = my + half;

  panel(ctx, mx, my, M, M);

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(mx, my, M, M, 6);
  ctx.clip();

  ctx.fillStyle = PALETTE.sun;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();

  for (const p of state.level.planets) {
    const q = planetPos(p, state.t);
    ctx.fillStyle = p.fill;
    ctx.beginPath();
    ctx.arc(cx + q.x * k, cy + q.y * k, p.home ? 2.6 : 1.8, 0, TAU);
    ctx.fill();
  }

  // the serpent, as a tapering string of dots
  const segs = state.kaiju.segments;
  for (let i = segs.length - 1; i >= 0; i--) {
    ctx.fillStyle = PALETTE.kaijuBody;
    ctx.globalAlpha = 0.5 + 0.5 * (1 - i / segs.length);
    ctx.beginPath();
    ctx.arc(cx + segs[i].x * k, cy + segs[i].y * k, 0.8 + 1.4 * (1 - i / segs.length), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = state.kaiju.devouring ? PALETTE.kaijuRage : PALETTE.kaijuBody;
  ctx.beginPath();
  ctx.arc(cx + state.kaiju.x * k, cy + state.kaiju.y * k, 3.4, 0, TAU);
  ctx.fill();

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

/** Draws every panel. Call in screen space, after the world and the shake. */
export function drawPanels(ctx: Ctx, state: GameState): void {
  drawProfile(ctx, state);
  drawChatter(ctx, state);
  drawMinimap(ctx, state);
  drawConsole(ctx, state);
}
