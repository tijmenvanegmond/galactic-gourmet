import { SIM, SPICES, STAGES } from './config';
import { heatMultiplier, scoreMultiplier, bandByLabel } from './world';
import type { BandLabel, KaijuMode, Order, Payload, SpiceName } from './types';

// ---------------------------------------------------------------------------
// Every hook here is optional. Delete a row from index.html and the readout it
// fed simply stops updating — the game keeps running. Only the canvas itself
// is required, and main.ts checks for that.
// ---------------------------------------------------------------------------

function el<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export const dom = {
  eta: el('eta'),
  etaLabel: el('eta-label'),
  hunger: el('hunger'),
  payloads: el('payloads'),
  score: el('score'),
  ticket: el('ticket'),
  ticketFor: el('ticket-for'),
  ticketDone: el('ticket-done'),
  ticketSpice: el('ticket-spice'),
  kaijuName: el('kaiju-name'),
  kaijuSay: el('kaiju-say'),
  roastTrack: el('roast-track'),
  roastBar: el('roast-bar'),
  roastLabel: el('roast-label'),
  roastWindow: el('roast-window'),
  fuelBar: el('fuel-bar'),
  stageLabel: el('stage-label'),
  rack: el('rack'),
  status: el('status'),
  speed: el<HTMLInputElement>('speed'),
  speedLabel: el('speed-label'),
  mute: el<HTMLButtonElement>('btn-mute'),
};

const setText = (node: HTMLElement | null, value: string): void => {
  if (node) node.textContent = value;
};

const setWidth = (node: HTMLElement | null, percent: number): void => {
  if (node) node.style.width = `${percent}%`;
};

/** Restarts a CSS animation that may already be running. */
function replay(node: HTMLElement | null, className: string): void {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

const bump = (node: HTMLElement | null): void => replay(node, 'bump');

// The score counts up rather than snapping, so a big serve reads as a big serve.
let shownScore = 0;
let targetScore = 0;
const last = { hunger: -1, payloads: -1 };

export function setCounters(
  { hunger, payloads, score }: { hunger: number; payloads: number; score: number },
): void {
  if (hunger !== last.hunger) {
    setText(dom.hunger, String(hunger));
    if (last.hunger >= 0) bump(dom.hunger);
    last.hunger = hunger;
  }
  if (payloads !== last.payloads) {
    setText(dom.payloads, String(payloads));
    if (last.payloads >= 0) bump(dom.payloads);
    last.payloads = payloads;
  }
  targetScore = score;
}

export function resetCounters(): void {
  shownScore = 0;
  targetScore = 0;
  last.hunger = -1;
  last.payloads = -1;
  setText(dom.score, '0');
}

/** Called once per frame to advance the rolling score. */
export function step(): void {
  if (shownScore === targetScore) return;
  const delta = targetScore - shownScore;
  shownScore += Math.abs(delta) < 1 ? delta : delta * 0.18;
  const shown = Math.round(shownScore);
  if (Math.abs(targetScore - shownScore) < 0.5) shownScore = targetScore;
  setText(dom.score, String(shown));
}

/** The diner has a name, and it goes on the ticket. */
export function setKaijuName(name: string): void {
  setText(dom.kaijuName, name);
  setText(dom.ticketFor, name);
}

// Ambient barks fire on state transitions that can land in the same frame, so
// a quiet one is dropped rather than allowed to stomp the line before it.
// Anything the player must read — a verdict, an ending — forces its way in.
let lastSaid = -Infinity;
const SAY_COOLDOWN = 900;

export function say(line: string, force = false): void {
  const now = performance.now();
  if (!force && now - lastSaid < SAY_COOLDOWN) return;
  lastSaid = now;
  setText(dom.kaijuSay, `“${line}”`);
  replay(dom.kaijuSay, 'said');
}

export function setKaijuMood(mode: KaijuMode): void {
  dom.kaijuName?.classList.toggle(
    'hunting', mode === 'chase' || mode === 'lunge' || mode === 'devour',
  );
}

/**
 * One readout, two meanings: time until it turns up, then how long it will
 * tolerate waiting once it has.
 */
export function setClock(label: string, seconds: number, urgent: boolean): void {
  if (dom.etaLabel && dom.etaLabel.textContent !== label) {
    dom.etaLabel.textContent = label;
    bump(dom.eta);
  }
  setText(dom.eta, `${seconds}s`);
  dom.eta?.classList.toggle('urgent', urgent);
}

export function setTicket(order: Order): void {
  setText(dom.ticketDone, order.doneness);
  setText(dom.ticketSpice, order.spice);
  if (dom.ticketSpice) dom.ticketSpice.style.color = SPICES[order.spice].color;

  // Move the target window on the roast gauge to the band that was ordered.
  if (dom.roastWindow) {
    const b = bandByLabel(order.doneness);
    dom.roastWindow.style.left = `${b.lo}%`;
    dom.roastWindow.style.right = `${Math.max(0, 100 - Math.min(100, b.hi))}%`;
  }
  bump(dom.ticket);
}

export function rejectTicket(): void {
  replay(dom.ticket, 'reject');
}

export function setRoast(heat: number, label: BandLabel, onTarget: boolean): void {
  setWidth(dom.roastBar, Math.min(100, heat));
  setText(dom.roastLabel, label);
  dom.roastTrack?.classList.toggle('on-target', onTarget);
}

export function setStage(pod: Payload | null): void {
  if (!pod) {
    setWidth(dom.fuelBar, 100);
    setText(dom.stageLabel, 'stage 1 · booster');
    return;
  }
  const stage = STAGES[pod.stage];
  setWidth(dom.fuelBar, Math.max(0, (pod.fuel / stage.fuel) * 100));
  setText(dom.stageLabel, pod.orbit
    ? `parked · ${pod.orbit.planet.name.toLowerCase()} orbit`
    : `stage ${pod.stage + 1} · ${stage.name}${pod.fuel <= 0 ? ' (dry)' : ''}`);
}

export function setRack(rack: SpiceName[]): void {
  if (!dom.rack) return;
  if (!rack.length) {
    dom.rack.innerHTML = '<span class="muted">rack empty</span>';
    return;
  }
  const chips = rack
    .map(s => `<span class="chip" style="--chip:${SPICES[s].color}">${s}</span>`)
    .join('');
  dom.rack.innerHTML =
    `${chips}<span class="muted">heat ×${heatMultiplier(rack).toFixed(2)} · points ×${scoreMultiplier(rack).toFixed(1)}</span>`;
}

export function setStatus(text: string): void {
  setText(dom.status, text);
}

export function setMuted(muted: boolean): void {
  setText(dom.mute, muted ? 'Sound off' : 'Sound on');
  dom.mute?.classList.toggle('off', muted);
}

export function bindMute(onToggle: () => boolean): void {
  dom.mute?.addEventListener('click', () => setMuted(onToggle()));
}

export function bindSpeed(onChange?: () => void): void {
  const slider = dom.speed;
  if (!slider) return;
  slider.min = String(SIM.dtMin);
  slider.max = String(SIM.dtMax);
  slider.step = '0.05';
  slider.value = String(SIM.dt);
  setText(dom.speedLabel, `${SIM.dt.toFixed(2)}×`);
  slider.addEventListener('input', () => {
    SIM.dt = parseFloat(slider.value);
    setText(dom.speedLabel, `${SIM.dt.toFixed(2)}×`);
    onChange?.();
  });
}
