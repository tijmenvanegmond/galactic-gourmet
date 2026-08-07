// ---------------------------------------------------------------------------
// The end of a run, printed as the check. Drawn over everything else once the
// phase is 'won' or 'lost'; reads game state and writes nothing.
// ---------------------------------------------------------------------------

import { VIEW, END, PALETTE } from './config';
import { shortName } from './voice';
import type { Ending, GameState } from './types';

const MONO = 'ui-monospace, Menlo, Consolas, monospace';
const PAPER = '#EDE8D8';
const PAPER_EDGE = '#C9C2AC';
const PRINT = '#2C2C2A';
const PRINT_DIM = '#6E6A5E';

type Ctx = CanvasRenderingContext2D;

interface Copy {
  title: string;
  stamp: string;
  stampColor: string;
  line: (state: GameState) => string;
}

// One card, three endings. The two losses share a title on purpose — it is the
// same outcome to the player — and differ only in what went wrong.
const COPY: Record<Ending, Copy> = {
  satisfied: {
    title: 'SATISFIED',
    stamp: 'PAID',
    stampColor: '#2F7D62',
    line: s => `${shortName(s.kaiju.name)} is full. ${s.level.name} keeps its planets.`,
  },
  starved: {
    title: 'GAME OVER',
    stamp: 'UNPAID',
    stampColor: '#A8321A',
    line: s => `Out of dishes, and ${shortName(s.kaiju.name)} is still hungry.`,
  },
  eaten: {
    title: 'GAME OVER',
    stamp: 'EATEN',
    stampColor: '#A8321A',
    line: s => `${shortName(s.kaiju.name)} got bored and ate the kitchen.`,
  },
};

function text(
  ctx: Ctx,
  s: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = 'left',
  weight = 400,
  italic = false,
): void {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${MONO}`;
  ctx.textAlign = align;
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

/** A row of the check: caption left, value right, leader dots between. */
function row(ctx: Ctx, label: string, value: string, x: number, y: number, w: number): void {
  text(ctx, label, x, y, 9, PRINT_DIM);
  text(ctx, value, x + w, y, 10, PRINT, 'right');

  ctx.font = `400 9px ${MONO}`;
  const from = x + ctx.measureText(label).width + 4;
  ctx.font = `400 10px ${MONO}`;
  const to = x + w - ctx.measureText(value).width - 4;
  if (to > from) {
    ctx.strokeStyle = 'rgba(110,106,94,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(from, y - 3);
    ctx.lineTo(to, y - 3);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function rule(ctx: Ctx, x: number, y: number, w: number, dashed = false): void {
  ctx.strokeStyle = 'rgba(110,106,94,0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash(dashed ? [3, 3] : []);
  ctx.beginPath();
  ctx.moveTo(x, y + 0.5);
  ctx.lineTo(x + w, y + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Paper with a torn bottom edge, which is what makes it read as a receipt. */
function paper(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  const teeth = Math.max(6, Math.round(w / 12));
  const step = w / teeth;

  ctx.beginPath();
  ctx.moveTo(x, y + 4);
  ctx.quadraticCurveTo(x, y, x + 4, y);
  ctx.lineTo(x + w - 4, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + 4);
  ctx.lineTo(x + w, y + h - END.tear);
  for (let i = teeth - 1; i >= 0; i--) {
    ctx.lineTo(x + step * (i + 0.5), y + h);
    ctx.lineTo(x + step * i, y + h - END.tear);
  }
  ctx.closePath();

  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.strokeStyle = PAPER_EDGE;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Rotated rubber stamp across the total. */
function stamp(ctx: Ctx, label: string, color: string, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.22);
  ctx.globalAlpha = 0.75;

  ctx.font = `700 17px ${MONO}`;
  ctx.textAlign = 'center';
  const w = ctx.measureText(label).width + 22;

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -15, w, 30, 4);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillText(label, 0, 6);
  ctx.restore();
}

export function drawEndCard(ctx: Ctx, state: GameState): void {
  if (!state.ending) return;
  const copy = COPY[state.ending];
  const won = state.ending === 'satisfied';

  // Everything eases on the same 0..1, so the card arrives as one movement.
  const k = Math.min(1, state.over / END.fadeIn);
  const ease = 1 - Math.pow(1 - k, 3);

  ctx.save();
  ctx.globalAlpha = ease * 0.72;
  ctx.fillStyle = '#0B0B0B';
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  ctx.globalAlpha = 1;

  const w = Math.min(END.width, VIEW.width - 40);
  const used = state.level.payloads - state.payloads;
  const lost = Math.max(0, used - state.served - state.rejected);
  const fed = Math.round((1 - state.hunger / state.level.hunger) * 100);

  // Height is fixed: the rows are always the same rows, so a card that grew
  // and shrank with the numbers would only wobble.
  const h = 246;
  const x = Math.round((VIEW.width - w) / 2);
  const y = Math.round((VIEW.height - h) / 2 - 10 + (1 - ease) * 14);
  const pad = 18;
  const inner = w - pad * 2;
  const cx = x + w / 2;

  ctx.globalAlpha = ease;
  paper(ctx, x, y, w, h);

  let cursor = y + 30;
  text(ctx, 'GALACTIC GOURMET', cx, cursor, 9, PRINT_DIM, 'center');
  cursor += 26;
  text(ctx, copy.title, cx, cursor, 24, won ? '#2F7D62' : '#A8321A', 'center', 700);
  cursor += 18;
  text(ctx, copy.line(state), cx, cursor, 9, PRINT_DIM, 'center');

  cursor += 16;
  rule(ctx, x + pad, cursor, inner, true);

  cursor += 20;
  row(ctx, 'DINER', state.kaiju.name, x + pad, cursor, inner);
  cursor += 17;
  row(ctx, 'SERVED', `${state.served}`, x + pad, cursor, inner);
  cursor += 17;
  row(ctx, 'SENT BACK', `${state.rejected}`, x + pad, cursor, inner);
  cursor += 17;
  row(ctx, 'DISHES LOST', `${lost}`, x + pad, cursor, inner);
  cursor += 17;
  row(ctx, 'HUNGER MET', `${fed}%`, x + pad, cursor, inner);

  cursor += 12;
  rule(ctx, x + pad, cursor, inner);

  cursor += 26;
  text(ctx, 'TOTAL', x + pad, cursor, 11, PRINT, 'left', 700);
  text(ctx, String(state.score), x + pad + inner, cursor, 22, PRINT, 'right', 700);

  // The stamp lands after the numbers have settled, so it reads as a verdict
  // on them rather than as part of the card arriving.
  const late = Math.max(0, Math.min(1, (state.over - END.fadeIn * 0.7) / (END.fadeIn * 0.5)));
  if (late > 0) {
    ctx.save();
    // Slams down: oversized at first, settling to true size.
    const scale = 1 + (1 - late) * 0.5;
    ctx.globalAlpha = ease * late;
    ctx.translate(x + w - 62, cursor - 6);
    ctx.scale(scale, scale);
    stamp(ctx, copy.stamp, copy.stampColor, 0, 0);
    ctx.restore();
  }

  if (state.chatter.line) {
    text(ctx, `“${state.chatter.line}”`, cx, y + h + 24, 10,
      PALETTE.label, 'center', 400, true);
  }

  // Only offered once a tap will actually be honoured.
  if (state.over > END.armAfter) {
    ctx.globalAlpha = ease * (0.5 + 0.5 * Math.sin(state.over * 0.06));
    text(ctx, 'TAP OR PRESS R TO COOK AGAIN', cx, y + h + 46, 9,
      PALETTE.ink, 'center', 700);
  }

  ctx.restore();
}
